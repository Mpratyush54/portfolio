import { TestBed } from '@angular/core/testing';
import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { QuotationAdminComponent } from './quotation-admin';
import { Quotation } from './quotation';
const builder = () => ({
  version: 1,
  provider: { name: 'Provider', email: 'provider@example.com' },
  features: ['website'],
  exclusions: [],
  responsibilities: ['content'],
  clauses: [{ id: 'review', title: 'Review', text: 'Complete standard clause' }],
});
const defaults = () => ({
  builder: builder(),
  catalog: {
    features: [{ id: 'website', label: 'Website' }],
    exclusions: [],
    responsibilities: [],
  },
});
describe('Guided quotation editor', () => {
  let c: QuotationAdminComponent, http: HttpTestingController;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [QuotationAdminComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(QuotationAdminComponent);
    c = fixture.componentInstance;
    c.headers = new HttpHeaders({ 'x-admin-password': 'test' });
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/admin/quotations')).flush([]);
    await fixture.whenStable();
  });
  afterEach(() => http.verify());
  it('starts with populated agreement sections and reuses prior provider details', async () => {
    c.rows.set([
      {
        builder: { provider: { name: 'Previous Provider', email: 'previous@example.com' } },
      } as Quotation,
    ]);
    const pending = c.newDraft();
    http.expectOne((r) => r.url.endsWith('/defaults')).flush(defaults());
    await pending;
    expect(c.editor.builder.provider.name).toBe('Previous Provider');
    expect(c.editor.builder.clauses[0].text).toBe('Complete standard clause');
    expect(c.editor.terms).toBe('');
  });
  it('adds and removes checkbox choices without duplicating them', () => {
    c.editor = { builder: builder() };
    c.toggle('features', 'booking', true);
    c.toggle('features', 'booking', true);
    expect(c.editor.builder.features).toEqual(['website', 'booking']);
    c.toggle('features', 'website', false);
    expect(c.editor.builder.features).toEqual(['booking']);
  });
  it('autosaves incomplete structured choices and leaves the editor open', async () => {
    const opening = c.newDraft();
    http.expectOne((r) => r.url.endsWith('/defaults')).flush(defaults());
    await opening;
    c.editor.title = 'Project\u200b';
    const pending = c.save();
    const request = http.expectOne((r) => r.url.endsWith('/admin/quotation-drafts'));
    expect(request.request.body.editor.builder.features).toEqual(['website']);
    expect(request.request.body.editor.title).toBe('Project');
    request.flush({ _id: 'q', __v: 0, draftReady: false });
    await pending;
    expect(c.editor).not.toBeNull();
    expect(c.editingId).toBe('q');
    expect(c.dirty()).toBe(false);
  });
  it('retries a failed save with the same mutation ID and then saves newer edits', async () => {
    const opening = c.newDraft();
    http.expectOne((r) => r.url.endsWith('/defaults')).flush(defaults());
    await opening;
    c.editor.title = 'First';
    const first = c.save();
    const req = http.expectOne((r) => r.method === 'POST');
    const mutation = req.request.body.mutationId;
    req.flush({ error: 'Offline' }, { status: 503, statusText: 'Unavailable' });
    await first;
    expect(c.dirty()).toBe(true);
    c.editor.title = 'Second';
    const retry = c.save();
    const old = http.expectOne((r) => r.method === 'POST');
    expect(old.request.body.mutationId).toBe(mutation);
    old.flush({ _id: 'q', __v: 0 });
    await new Promise((r) => setTimeout(r, 0));
    const next = http.expectOne((r) => r.method === 'POST');
    expect(next.request.body.editor.title).toBe('Second');
    expect(next.request.body.version).toBe(0);
    next.flush({ _id: 'q', __v: 1 });
    await retry;
    expect(c.dirty()).toBe(false);
  });
  it('retains changes and stops autosave when another editor changed the draft', async () => {
    c.catalog = defaults().catalog;
    c.edit({
      _id: 'q',
      __v: 1,
      totalPaise: 10000,
      validUntil: '2026-12-01',
      draftEditor: { title: 'Restored partial title' },
    } as Quotation);
    expect(c.editor.title).toBe('Restored partial title');
    c.editor.title = 'Local';
    const saving = c.save();
    http
      .expectOne((r) => r.method === 'POST')
      .flush({ error: 'Changed elsewhere' }, { status: 409, statusText: 'Conflict' });
    await saving;
    expect(c.conflict()).toBe(true);
    expect(c.editor.title).toBe('Local');
    await c.save();
    http.expectNone((r) => r.method === 'POST');
  });
  it('flushes changes before leaving admin and blocks navigation if saving fails', async () => {
    c.catalog = defaults().catalog;
    c.edit({
      _id: 'q',
      __v: 0,
      title: 'Saved',
      totalPaise: 10000,
      validUntil: '2026-12-01',
    } as Quotation);
    c.editor.title = 'Leaving';
    c.changed();
    await Promise.resolve();
    const leaving = c.canLeave();
    const request = http.expectOne((r) => r.method === 'POST');
    request.flush({ error: 'Offline' }, { status: 503, statusText: 'Unavailable' });
    expect(await leaving).toBe(false);
    const retry = c.canLeave();
    http.expectOne((r) => r.method === 'POST').flush({ _id: 'q', __v: 1 });
    expect(await retry).toBe(true);
  });
  it('loads checkbox choices when reopening an incomplete guided draft after reload', async () => {
    c.edit({
      _id: 'q',
      __v: 0,
      totalPaise: 0,
      validUntil: '2026-12-01',
      draftEditor: { builder: builder() },
    } as Quotation);
    http.expectOne((r) => r.url.endsWith('/defaults')).flush(defaults());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(c.editor.builder.features).toEqual(['website']);
    expect(c.catalog.features.length).toBe(1);
  });
  it('preserves existing text-only drafts and isolates unsaved builder edits', () => {
    const q = {
      _id: 'q',
      __v: 1,
      totalPaise: 100000,
      validUntil: '2026-12-01',
      terms: 'Previously negotiated text',
    } as Quotation;
    c.edit(q);
    expect(c.editor.terms).toBe('Previously negotiated text');
    expect(c.editor.builder).toBeUndefined();
    c.catalog = defaults().catalog;
    const guided = { ...q, builder: builder() };
    c.edit(guided);
    c.editor.builder.provider.name = 'Unsaved';
    expect(guided.builder.provider.name).toBe('Provider');
  });
});
