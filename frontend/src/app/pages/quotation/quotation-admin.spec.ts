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
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QuotationAdminComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    c = TestBed.createComponent(QuotationAdminComponent).componentInstance;
    c.headers = new HttpHeaders({ 'x-admin-password': 'test' });
    http = TestBed.inject(HttpTestingController);
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
  it('saves structured selections for server generation without stale text overrides', async () => {
    c.editor = {
      builder: builder(),
      title: 'Project',
      seller: 'stale',
      scope: 'stale',
      exclusions: 'stale',
      timeline: 'stale',
      terms: 'stale',
      totalRupees: 1000,
      validDate: '2026-12-01',
    };
    const pending = c.save();
    const request = http.expectOne((r) => r.method === 'POST');
    expect(request.request.body.builder.features).toEqual(['website']);
    expect(request.request.body.terms).toBeUndefined();
    expect(request.request.body.seller).toBeUndefined();
    request.flush({});
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne((r) => r.method === 'GET').flush([]);
    await pending;
    expect(c.editor).toBeNull();
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
