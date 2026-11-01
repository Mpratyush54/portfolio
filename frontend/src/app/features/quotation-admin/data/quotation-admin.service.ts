import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Quotation, quotationRef } from '../../quotation/models/quotation.model';
import { cleanDraftText, downloadQuotationFile } from '../../quotation/utils/quotation-files';
import { apiBase } from '../../../core/api/api-base';

@Injectable()
export class QuotationAdminService {

  headers!: HttpHeaders;
  quotationId = '';
  mode: 'list' | 'new' | 'detail' | 'edit' = 'list';
  private http = inject(HttpClient);
  private router = inject(Router, { optional: true });
  private destroyRef = inject(DestroyRef);
  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.saveTimer);
    });
  }
  private routeReady = false;
  private appliedRoute = '';
  rows = signal<Quotation[]>([]);
  selected = signal<Quotation | null>(null);
  closeSelection(navigate = true) {
    this.selected.set(null);
    this.inviteUrl.set('');
    this.invitationRows.set([]);
    this.paymentEmails.set([]);
    this.planDraft = null;
    this.notice.set('');
    if (navigate && this.useRoutes() && this.mode !== 'list') {
      void this.router!.navigate(['/admin/quotations']);
      return;
    }
    this.scrollTop();
  }
  invitationRows = signal<any[]>([]);
  paymentEmails = signal<any[]>([]);
  notice = signal('');
  planDraft: any[] | null = null;
  canChangePlan(q: Quotation) {
    return (
      (q.status === 'invited' || q.status === 'accepted') &&
      !q.milestones.some(
        (m) =>
          m.paidPaise ||
          m.paidAt ||
          m.orderId ||
          m.payments?.length ||
          m.collectionPaise ||
          m.collections?.length,
      )
    );
  }
  startPlan(q: Quotation) {
    if (!this.canChangePlan(q)) {
      this.error.set('Payments or payment arrangements have started for this quotation.');
      return;
    }
    this.notice.set('');
    this.planDraft = q.milestones.map((m, i) => ({
      percent: m.percent,
      timing: m.timing || (i ? 'after' : 'before'),
    }));
  }
  cancelPlan() {
    this.planDraft = null;
  }
  planTotal() {
    return (
      this.planDraft?.reduce((sum, phase) => sum + Number(phase.percent || 0), 0) || 0
    );
  }
  async savePlan(q: Quotation) {
    if (!this.planDraft || this.planTotal() !== 100) {
      this.error.set('Phase percentages must total 100%.');
      return;
    }
    await this.run(async () => {
      const updated = await this.request('patch', `/${q._id}/schedule`, {
        version: q.__v,
        paymentSchedule: this.planDraft,
      });
      this.planDraft = null;
      this.selected.set(updated);
      this.rows.set(await this.request('get'));
      this.notice.set(
        'Payment plan updated in place. Existing invitation links now show the new amounts; ask the client to reload an open copy.',
      );
      this.scrollTop();
    });
  }
  async receiptPdf(q: Quotation, paymentId: string) {
    await this.run(() => downloadQuotationFile(this.http, `${apiBase()}/admin/quotations/${q._id}/receipts/${paymentId}/pdf`, this.headers, `receipt-${paymentId}.pdf`));
  }
  async retryReceipt(q: Quotation, paymentId: string) {
    await this.run(async () => { await this.request('post', `/${q._id}/receipts/${paymentId}/retry`, {}); this.paymentEmails.set(await this.request('get', `/${q._id}/receipts`)); });
  }
  invitationLabel = ''; emailInvitation = true;
  async loadInvitations(q: Quotation) {
    await this.run(async () => this.invitationRows.set(await this.request('get', `/${q._id}/invitations`)));
  }
  async linkAction(q: Quotation, link: any, action: 'copy' | 'email' | 'revoke') {
    await this.run(async () => {
      const result = await this.request('post', `/${q._id}/invitations/${link._id}/${action}`, {});
      if (result.token) { this.inviteUrl.set(`${location.origin}/proposal#${result.token}`); await this.copy(); }
      this.invitationRows.set(await this.request('get', `/${q._id}/invitations`));
    });
  }
  page = 1; pages = 1; total = 0; search = ''; status = ''; from = ''; to = '';
  readonly reference = quotationRef;
  phaseLabels = ['Onboarding', 'MVP', 'Development complete', 'Deployment'];
  scheduleTotal() { return this.editor?.paymentSchedule?.reduce((s: number, m: any) => s + Number(m.percent || 0), 0) || 0; }
  onboardingAmount() {
    const totalPaise = Math.round(Number(this.editor?.totalRupees || 0) * 100);
    const percent = Number(this.editor?.paymentSchedule?.[0]?.percent || 0);
    return Math.floor((totalPaise * percent) / 100);
  }
  minimumError(): string {
    const value = this.editor?.minimumOnboardingRupees;
    if (value === undefined || value === null || value === '') return '';
    const minimum = Number(value);
    const totalPaise = Math.round(Number(this.editor?.totalRupees || 0) * 100);
    if (!Number.isFinite(minimum) || minimum < 0) return 'Enter a valid minimum onboarding amount.';
    if (!minimum) return '';
    if (!totalPaise) return 'Enter the final total before setting a minimum.';
    if (Math.round(minimum * 100) > totalPaise)
      return `The minimum cannot exceed the quotation total (${(totalPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}).`;
    if (this.onboardingAmount() < Math.round(minimum * 100) - 1)
      return 'The initial phase is below the minimum. Lower the minimum or raise the initial share.';
    return '';
  }
  minimumChanged() {
    if (!this.editor) return;
    const minimum = Number(this.editor.minimumOnboardingRupees);
    const total = Number(this.editor.totalRupees);
    if (!Number.isFinite(minimum) || minimum <= 0 || !Number.isFinite(total) || total <= 0 || minimum > total) {
      this.changed();
      return;
    }
    const needed = Math.ceil((minimum * 100) / total - 1e-9);
    const current = Number(this.editor.paymentSchedule?.[0]?.percent || 1);
    if (needed > current) this.initialPercent(Math.min(97, needed));
    else this.changed();
  }
  pageItems(current: number, total: number): (number | string)[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const items: (number | string)[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) items.push('…');
    for (let page = start; page <= end; page++) items.push(page);
    if (end < total - 1) items.push('…');
    items.push(total);
    return items;
  }
  goPage(page: number | string) {
    const target = Number(page);
    if (!Number.isInteger(target) || target < 1 || target > this.pages || target === this.page) return;
    this.page = target;
    void this.load();
  }
  whatsappUrl(q: Quotation, url: string) {
    const total = (q.totalPaise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
    const valid = new Date(q.validUntil).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const text = `Hi ${q.clientName}, sharing proposal ${quotationRef(q)} for ${q.title}. Total ${total}, valid until ${valid}. Review and accept here: ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }
  shareWhatsApp(q: Quotation, url = '') {
    if (!url) {
      this.error.set('Create or open an invitation link first, then share it on WhatsApp.');
      return;
    }
    window.open(this.whatsappUrl(q, url), '_blank', 'noopener,noreferrer');
  }
  async shareLink(q: Quotation, link: any) {
    const popup = window.open('', '_blank');
    try {
      this.busy.set(true);
      this.error.set('');
      const result = await this.request('post', `/${q._id}/invitations/${link._id}/copy`, {});
      if (!result.token) throw new Error('Could not prepare this invitation link.');
      const url = `${location.origin}/proposal#${result.token}`;
      this.inviteUrl.set(url);
      this.copied.set(false);
      if (popup) popup.location.replace(this.whatsappUrl(q, url));
      else this.error.set('Allow pop-ups to open WhatsApp, or copy the link shown above.');
    } catch (e: any) {
      popup?.close();
      this.error.set(e.error?.error || e.message || 'Could not share this invitation.');
    } finally {
      this.busy.set(false);
    }
  }
  initialPercent(value: number) {
    const left = 100 - Number(value), rest = this.editor.paymentSchedule.slice(1);
    const weight = rest.reduce((s: number, m: any) => s + Number(m.percent || 1), 0);
    let allocated = 0;
    rest.forEach((m: any, i: number) => {
      m.percent = i === 2 ? left - allocated : Math.max(1, Math.min(left - allocated - (2 - i), Math.round(left * (Number(m.percent || 1) / weight))));
      allocated += m.percent;
    });
    this.editor.paymentSchedule[0].percent = Number(value); this.changed();
  }
  movePage(delta: number) { this.page += delta; void this.load(); }
  async open(row: Quotation) {
    if (this.useRoutes()) {
      await this.router!.navigate(['/admin/quotations', row._id]);
      return;
    }
    await this.openById(row._id);
  }
  private async openById(id: string) {
    await this.run(async () => {
      this.inviteUrl.set('');
      this.invitationRows.set([]); this.paymentEmails.set([]);
      this.planDraft = null;
      this.notice.set('');
      const q = await this.request('get', `/${id}`);
      this.selected.set(q);
      this.invitationLabel = this.defaultInvitationLabel(q);
      const [links, receipts] = await Promise.all([this.request('get', `/${id}/invitations`), this.request('get', `/${id}/receipts`)]);
      this.invitationRows.set(links); this.paymentEmails.set(receipts);
      this.scrollTop();
    });
  }
  private defaultInvitationLabel(q: Quotation | null) {
    return String(q?.title || '').trim().slice(0, 100);
  }
  busy = signal(false);
  error = signal('');
  inviteUrl = signal('');
  copied = signal(false);
  editor: any = null;
  editingId = '';
  currentQuote = signal<Quotation | null>(null);
  savingDraft = signal(false);
  dirty = signal(false);
  saveError = signal('');
  conflict = signal(false);
  private draftId = crypto.randomUUID();
  private savedSnapshot = '';
  private pending: any = null;
  private savePromise: Promise<void> | null = null;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private useRoutes() {
    return !!this.router && this.router.url.startsWith('/admin');
  }
  private scrollTop() {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
  private snapshot() {
    const keys = [
      'title',
      'clientName',
      'clientEmail',
      'builder',
      'totalRupees',
      'minimumOnboardingRupees',
      'validDate',
      'paymentSchedule',
      ...(!this.editor.builder ? ['seller', 'scope', 'exclusions', 'timeline', 'terms'] : []),
    ];
    return cleanDraftText(
      Object.fromEntries(
        keys.filter((k) => this.editor[k] !== undefined).map((k) => [k, this.editor[k]]),
      ),
    );
  }
  cleanField(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (
      !['INPUT', 'TEXTAREA'].includes(target.tagName) ||
      ['file', 'checkbox', 'number', 'date'].includes(target.type)
    )
      return;
    const cleaned = cleanDraftText(target.value);
    if (cleaned !== target.value) {
      target.value = cleaned;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  changed(event?: Event) {
    if ((event?.target as HTMLInputElement)?.type === 'file') return;
    queueMicrotask(() => {
      if (!this.editor || this.destroyed) return;
      this.dirty.set(JSON.stringify(this.snapshot()) !== this.savedSnapshot);
      clearTimeout(this.saveTimer);
      if (this.dirty() && !this.conflict() && !this.saveError())
        this.saveTimer = setTimeout(() => {
          if (!this.busy()) void this.save();
        }, 1000);
    });
  }
  private startEditor(q: Quotation | null) {
    this.currentQuote.set(q);
    this.selected.set(q);
    this.draftId = crypto.randomUUID();
    this.pending = null;
    this.savedSnapshot = JSON.stringify(this.snapshot());
    this.dirty.set(false);
    this.saveError.set('');
    this.conflict.set(false);
    this.scrollTop();
  }
  saveStateLabel() {
    if (this.conflict()) return 'Reload needed';
    if (this.savingDraft()) return 'Saving…';
    if (this.saveError()) return 'Save failed';
    if (this.dirty()) return 'Unsaved changes';
    if (!this.editingId) return 'Not saved yet';
    return 'All changes saved';
  }
  editorReference() {
    const q = this.currentQuote();
    return q ? `${this.reference(q)} · revision ${q.revision}` : 'Not saved yet';
  }
  private updateQuote(q: Quotation) {
    this.editingId = q._id;
    this.editor.version = q.__v;
    this.currentQuote.set(q);
    this.selected.set(q);
    this.rows.update((rows) => [q, ...rows.filter((r) => r._id !== q._id)]);
  }
  async canLeave() {
    if (this.busy()) return false;
    if (this.dirty() || this.savingDraft()) await this.save();
    return !this.dirty() && !this.savingDraft();
  }
  async closeEditor(returnTo: 'detail' | 'list' = 'detail') {
    clearTimeout(this.saveTimer);
    if (this.dirty() || this.saveError()) await this.save();
    if (this.dirty() || this.savingDraft() || this.saveError()) return;
    const id = this.editingId;
    this.editor = null;
    this.currentQuote.set(null);
    if (returnTo === 'list' || !id) {
      this.closeSelection();
      return;
    }
    if (this.useRoutes()) {
      await this.router!.navigate(['/admin/quotations', id]);
      return;
    }
    this.invitationLabel = this.defaultInvitationLabel(this.selected());
    this.scrollTop();
  }
  async deleteDraft(q: Quotation) {
    if (this.busy()) return;
    const name = q.title || 'Untitled quotation';
    if (!window.confirm(`Delete the draft "${name}"? This permanently removes it and any uploaded SRS files.`)) return;
    const goList = this.selected()?._id === q._id && this.useRoutes() && this.mode !== 'list';
    await this.run(async () => {
      await this.request('delete', `/${q._id}`);
      if (this.selected()?._id === q._id) this.closeSelection(false);
      this.rows.set(await this.request('get'));
      this.scrollTop();
    });
    if (goList) await this.router!.navigate(['/admin/quotations']);
  }
  async reloadDraft() {
    await this.run(async () => {
      const q = await this.request('get', `/${this.editingId}`);
      if (!q || q.status !== 'draft') {
        this.editor = null;
        this.dirty.set(false);
        this.saveError.set('');
      } else this.edit(q);
    });
  }

  catalog: any = { features: [], exclusions: [], responsibilities: [] };
  previewText = signal<{ title: string; text: string }[] | null>(null);
  evidence: Record<string, string> = {};
  bindRoute(mode: 'list' | 'new' | 'detail' | 'edit', quotationId: string) {
    this.mode = mode;
    this.quotationId = quotationId;
  }
  markRouteReady() {
    this.routeReady = true;
  }
  async applyRoute(force = false) {
    const key = `${this.mode}:${this.quotationId}`;
    if (!force && key === this.appliedRoute) return;
    this.appliedRoute = key;
    if (this.mode === 'list') {
      this.editor = null;
      this.currentQuote.set(null);
      this.selected.set(null);
      this.inviteUrl.set('');
      this.invitationRows.set([]);
      this.paymentEmails.set([]);
      this.planDraft = null;
      this.notice.set('');
      await this.load();
      this.scrollTop();
      return;
    }
    if (this.mode === 'new') {
      if (this.editor && !this.editingId) return;
      await this.startNewDraft();
      return;
    }
    if (!this.quotationId) {
      await this.openList();
      return;
    }
    if (this.mode === 'edit') {
      if (this.editor && this.editingId === this.quotationId) return;
      let redirect = '';
      await this.run(async () => {
        const q = await this.request('get', `/${this.quotationId}`);
        if (q.status !== 'draft') {
          this.editor = null;
          this.selected.set(q);
          redirect = q._id;
          return;
        }
        this.edit(q);
      });
      if (redirect && this.useRoutes())
        await this.router!.navigate(['/admin/quotations', redirect]);
      return;
    }
    await this.openById(this.quotationId);
  }
  private async openList() {
    if (this.useRoutes()) {
      await this.router!.navigate(['/admin/quotations']);
      return;
    }
    this.mode = 'list';
    this.appliedRoute = 'list:';
    await this.applyRoute(true);
  }
  private async request(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path = '', body?: any): Promise<any> {
    const result: any = await firstValueFrom(
      this.http.request(method.toUpperCase(), `${apiBase()}/admin/quotations${path}`, {
        body,
        headers: this.headers,
        ...(method === 'get' && !path ? { params: { page: this.page, pageSize: 25, q: this.search, status: this.status, from: this.from, to: this.to } } : {}),
      }),
    );
    if (method === 'get' && !path) {
      if (Array.isArray(result)) return result;
      this.page = result.page; this.pages = result.pages; this.total = result.total;
      if (this.selected() && !this.editor) {
        this.selected.set(await this.request('get', `/${this.selected()!._id}`));
      }
      return result.rows;
    }
    return result;
  }
  private async run(fn: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await fn();
    } catch (e: any) {
      this.error.set(e.error?.error || 'Request failed. Refresh and try again.');
    } finally {
      this.busy.set(false);
      if (this.editor && this.dirty() && !this.saveError()) this.changed();
    }
  }
  async load() {
    await this.run(async () => this.rows.set(await this.request('get')));
  }
  async newDraft() {
    if (this.useRoutes()) {
      await this.router!.navigate(['/admin/quotations', 'new']);
      return;
    }
    await this.startNewDraft();
  }
  private async startNewDraft() {
    await this.run(async () => {
      this.inviteUrl.set('');
      const d = await this.request('get', '/defaults');
      this.catalog = d.catalog;
      const previous = this.rows().find((q) => q.builder)?.builder;
      if (previous) d.builder.provider = structuredClone(previous.provider);
      this.previewText.set(null);
      this.editingId = '';
      this.editor = {
        title: '',
        clientName: '',
        clientEmail: '',
        seller: '',
        scope: '',
        exclusions: '',
        timeline: '',
        terms: '',
        builder: d.builder,
        paymentSchedule: [25, 25, 40, 10].map((percent, i) => ({ percent, timing: i ? 'after' : 'before' })),
        totalRupees: 0,
        minimumOnboardingRupees: undefined,
        validDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      };
      this.startEditor(null);
    });
  }
  edit(q: Quotation) {
    this.previewText.set(null);
    if ((q.draftEditor?.builder || q.builder) && !this.catalog.features.length)
      void this.loadCatalog();
    this.editingId = q._id;
    this.editor = {
      ...structuredClone(q),
      version: q.__v,
      totalRupees: q.totalPaise / 100,
      validDate: q.validUntil.slice(0, 10),
      ...structuredClone(q.draftEditor || {}),
    };
    if (this.editor.builder) this.editor.paymentSchedule ||= q.milestones?.length === 4
      ? q.milestones.map((m, i) => ({ percent: m.percent, timing: m.timing || (i ? 'after' : 'before') }))
      : [25, 25, 40, 10].map((percent, i) => ({ percent, timing: i ? 'after' : 'before' }));
    if (this.editor.builder && this.editor.minimumOnboardingRupees === undefined && q.minimumOnboardingPaise)
      this.editor.minimumOnboardingRupees = q.minimumOnboardingPaise / 100;
    this.startEditor(q);
  }
  async openEdit(q: Quotation) {
    if (this.useRoutes()) {
      await this.router!.navigate(['/admin/quotations', q._id, 'edit']);
      return;
    }
    this.edit(q);
  }
  private async loadCatalog() {
    try {
      const d = await this.request('get', '/defaults');
      this.catalog = d.catalog;
    } catch {
      this.error.set('Could not load the builder choices. Close and reopen this draft.');
    }
  }
  toggle(key: 'features' | 'exclusions' | 'responsibilities', id: string, enabled: boolean) {
    const selected: string[] = this.editor.builder[key];
    this.editor.builder[key] = enabled
      ? [...new Set([...selected, id])]
      : selected.filter((x) => x !== id);
    this.changed();
  }
  async preview() {
    await this.run(async () => {
      const p = await this.request('post', '/preview', { builder: this.editor.builder, paymentSchedule: this.editor.paymentSchedule });
      this.previewText.set(
        ['seller', 'scope', 'exclusions', 'timeline', 'terms'].map((key, i) => ({
          title: [
            'Provider',
            'Scope and acceptance',
            'Exclusions and revisions',
            'Timeline and responsibilities',
            'Full agreement',
          ][i],
          text: p[key],
        })),
      );
    });
  }
  async save(force = false): Promise<void> {
    clearTimeout(this.saveTimer);
    if (!this.editor || this.conflict()) return;
    if (this.savePromise) {
      await this.savePromise;
      if (this.dirty() && !this.saveError()) return this.save(force);
      return;
    }
    this.saveError.set('');
    this.savingDraft.set(true);
    this.savePromise = (async () => {
      try {
        do {
          const snapshot = this.pending?.editor || this.snapshot();
          if (!this.pending && this.editingId && JSON.stringify(snapshot) === this.savedSnapshot)
            break;
          this.pending ||= {
            id: this.editingId || undefined,
            version: this.editor.version,
            clientDraftId: this.draftId,
            mutationId: crypto.randomUUID(),
            editor: snapshot,
          };
          const q = await firstValueFrom(
            this.http.post<Quotation>(`${apiBase()}/admin/quotation-drafts`, this.pending, {
              headers: this.headers,
            }),
          );
          this.savedSnapshot = JSON.stringify(snapshot);
          this.pending = null;
          this.updateQuote(q);
          this.dirty.set(JSON.stringify(this.snapshot()) !== this.savedSnapshot);
        } while (this.dirty() && !this.destroyed);
      } catch (e: any) {
        this.dirty.set(true);
        this.conflict.set(e.status === 409);
        this.saveError.set(
          e.error?.error ||
            'Autosave failed. Your changes are still in this editor. Retry before leaving.',
        );
      } finally {
        this.savingDraft.set(false);
      }
    })();
    await this.savePromise;
    this.savePromise = null;
  }
  async uploadSrs(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.run(async () => {
      if (!/\.(pdf|docx)$/i.test(file.name) || file.size > 5 * 1024 * 1024)
        throw { error: { error: 'Choose a PDF or DOCX file up to 5 MB.' } };
      await this.save(true);
      if (this.saveError()) return;
      const q = await firstValueFrom(
        this.http.post<Quotation>(`${apiBase()}/admin/quotations/${this.editingId}/srs`, file, {
          headers: this.headers
            .set('Content-Type', 'application/octet-stream')
            .set('x-file-name', encodeURIComponent(file.name))
            .set('x-quote-version', String(this.editor.version)),
        }),
      );
      this.updateQuote(q);
    });
    this.changed();
  }
  async removeSrs(fileId: string) {
    await this.run(async () => {
      await this.save();
      if (this.saveError()) return;
      const q = await firstValueFrom(
        this.http.delete<Quotation>(
          `${apiBase()}/admin/quotations/${this.editingId}/srs/${fileId}`,
          { headers: this.headers, body: { version: this.editor.version } },
        ),
      );
      this.updateQuote(q);
    });
    this.changed();
  }
  async download(q: Quotation, format: 'pdf' | 'docx') {
    await this.run(() =>
      downloadQuotationFile(
        this.http,
        `${apiBase()}/admin/quotations/${q._id}/export/${format}`,
        this.headers,
        `quotation-revision-${q.revision}.${format}`,
      ),
    );
  }
  async downloadSrs(q: Quotation, file: { fileId: string; name: string }) {
    await this.run(() =>
      downloadQuotationFile(
        this.http,
        `${apiBase()}/admin/quotations/${q._id}/srs/${file.fileId}`,
        this.headers,
        file.name,
      ),
    );
  }
  async invite(q: Quotation) {
    await this.run(async () => {
      const label = this.invitationLabel.trim() || this.defaultInvitationLabel(q);
      const result = await this.request('post', `/${q._id}/invite`, { version: q.__v, label, sendEmail: this.emailInvitation });
      this.invitationLabel = label;
      this.inviteUrl.set(`${location.origin}/proposal#${result.token}`);
      this.copied.set(false);
      this.invitationRows.set(await this.request('get', `/${q._id}/invitations`));
      this.rows.set(await this.request('get'));
    });
  }
  async revise(q: Quotation) {
    let revisedId = '';
    await this.run(async () => {
      const revised: Quotation = await this.request('post', `/${q._id}/revise`, {});
      revisedId = revised._id;
      this.inviteUrl.set('');
      if (!this.useRoutes()) {
        this.edit(revised);
        this.rows.set(await this.request('get'));
      }
    });
    if (revisedId && this.useRoutes())
      await this.router!.navigate(['/admin/quotations', revisedId, 'edit']);
  }
  async revoke(q: Quotation) {
    await this.run(async () => {
      await this.request('post', `/${q._id}/revoke`, {});
      this.inviteUrl.set('');
      this.rows.set(await this.request('get'));
    });
  }
  async release(q: Quotation, i: number) {
    await this.run(async () => {
      await this.request('post', `/${q._id}/release/${i}`, { evidence: this.evidence[q._id + i] });
      this.rows.set(await this.request('get'));
    });
  }
  collectionAmounts: Record<string, number> = {};
  collectionReasons: Record<string, string> = {};
  async setCollection(q: Quotation, i: number) {
    const paise = Number(this.collectionAmounts[q._id + i]) * 100;
    if (!Number.isFinite(paise) || Math.abs(paise - Math.round(paise)) > 0.000001) {
      this.error.set('Enter an amount in whole paise.');
      return;
    }
    await this.run(async () => {
      await this.request('post', `/${q._id}/collection/${i}`, {
        version: q.__v, amountPaise: Math.round(paise), reason: this.collectionReasons[q._id + i],
      });
      this.rows.set(await this.request('get'));
    });
  }
  select(event: Event) {
    (event.target as HTMLInputElement).select();
  }
  async copy() {
    try {
      await navigator.clipboard.writeText(this.inviteUrl());
      this.copied.set(true);
    } catch {
      this.error.set('Select and copy the invitation field.');
    }
  }

}
