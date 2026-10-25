import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { quoteApi, Quotation } from './quotation';

@Component({
  selector: 'app-quotation-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="quotes-admin">
      <h2>Project quotations and invitations</h2>
      <p>
        Create a custom agreement, preview its full terms, then copy a private invite to share with
        the client. Inviting freezes its terms.
      </p>
      <div class="actions">
        <button [disabled]="busy()" (click)="newDraft()">New quotation</button
        ><button [disabled]="busy()" (click)="load()">Refresh</button>
      </div>
      @if (error()) {
        <p role="alert" class="error">{{ error() }}</p>
      }
      @if (inviteUrl()) {
        <label
          >Private invitation — anyone holding this link can access this client's project. Share
          only with the client.<input
            readonly
            [value]="inviteUrl()"
            (click)="select($event)" /></label
        ><button (click)="copy()">{{ copied() ? 'Copied' : 'Copy invitation' }}</button>
      }
      @if (editor) {
        <div class="editor">
          <h3>{{ editingId ? 'Edit draft' : 'New draft' }}</h3>
          <label>Project title<input [(ngModel)]="editor.title" maxlength="160" /></label>
          <div class="fields">
            <label>Client name<input [(ngModel)]="editor.clientName" maxlength="120" /></label
            ><label
              >Client email<input type="email" [(ngModel)]="editor.clientEmail" maxlength="254"
            /></label>
            <label
              >Final total payable (INR, include applicable taxes)<input
                type="number"
                min="100"
                max="1000000"
                step="0.01"
                [(ngModel)]="editor.totalRupees" /></label
            ><label>Valid until<input type="date" [(ngModel)]="editor.validDate" /></label>
          </div>
          <label
            >Provider legal name, contact email, address, GST/tax treatment and dispute
            venue<textarea [(ngModel)]="editor.seller" maxlength="1500"></textarea>
          </label>
          <label
            >Scope, deliverables and measurable acceptance criteria<textarea
              [(ngModel)]="editor.scope"
              maxlength="7000"
            ></textarea>
          </label>
          <label
            >Exclusions, revision limits and third-party costs<textarea
              [(ngModel)]="editor.exclusions"
              maxlength="3000"
            ></textarea>
          </label>
          <label
            >Timeline, dependencies and client responsibilities<textarea
              [(ngModel)]="editor.timeline"
              maxlength="3000"
            ></textarea>
          </label>
          <label
            >Full agreement (editable per client)<textarea
              class="terms-edit"
              [(ngModel)]="editor.terms"
              maxlength="14000"
            ></textarea>
          </label>
          <p>
            Default support: 30 calendar days of agreed-scope bug fixes from deployment. Review
            every clause and your business/tax details before sharing. The final price is split 25%
            / 25% / 40% / 10%.
          </p>
          <button [disabled]="busy()" (click)="save()">Save draft</button
          ><button [disabled]="busy()" (click)="editor = null">Close editor</button>
        </div>
      }
      @for (q of rows(); track q._id) {
        <article>
          <h3>{{ q.title }} · revision {{ q.revision }}</h3>
          <p>
            {{ q.clientName }} · {{ q.clientEmail }} · {{ q.status }} ·
            {{ q.totalPaise / 100 | currency: 'INR' }}
          </p>
          <details>
            <summary>Preview full quotation</summary>
            <h4>Provider</h4>
            <p class="preserve">{{ q.seller }}</p>
            <h4>Scope</h4>
            <p class="preserve">{{ q.scope }}</p>
            <h4>Exclusions</h4>
            <p class="preserve">{{ q.exclusions }}</p>
            <h4>Timeline</h4>
            <p class="preserve">{{ q.timeline }}</p>
            <h4>Terms</h4>
            <p class="preserve">{{ q.terms }}</p>
            <p>Valid until {{ q.validUntil | date: 'mediumDate' }}</p>
          </details>
          <div class="actions">
            @if (q.status === 'draft') {
              <button [disabled]="busy()" (click)="edit(q)">Edit draft</button>
            }
            @if (q.status !== 'cancelled') {
              <button [disabled]="busy()" (click)="invite(q)">
                {{
                  q.status === 'draft'
                    ? 'Freeze terms and create invite'
                    : 'Replace private invite link'
                }}</button
              ><button [disabled]="busy()" (click)="revise(q)">Create revision</button>
            }
            @if (q.status === 'invited' || q.status === 'accepted') {
              <button [disabled]="busy()" (click)="revoke(q)">Revoke private link</button>
            }
          </div>
          @if (q.acceptance) {
            <p>Accepted by {{ q.acceptance.name }} on {{ q.acceptance.at | date: 'medium' }}</p>
          }
          @for (m of q.milestones; track $index; let i = $index) {
            <p>
              <strong>{{ m.label }}: {{ m.amountPaise / 100 | currency: 'INR' }}</strong> ·
              {{
                m.paidAt
                  ? 'Paid'
                  : m.approvedAt
                    ? 'Awaiting payment'
                    : m.releasedAt
                      ? 'Awaiting client approval'
                      : 'Upcoming'
              }}
            </p>
            @if (m.feedback) {
              <p class="preserve">Client feedback: {{ m.feedback }}</p>
            }
            @if (q.status === 'accepted' && i > 0 && q.milestones[i - 1].paidAt && !m.approvedAt) {
              <label
                >Delivery notes, review link and acceptance evidence<textarea
                  [(ngModel)]="evidence[q._id + i]"
                  maxlength="3000"
                ></textarea>
              </label>
              <button [disabled]="busy() || !evidence[q._id + i]" (click)="release(q, i)">
                {{
                  i === 3
                    ? 'Record production deployment and request review'
                    : 'Request client milestone review'
                }}
              </button>
            }
          }
          @if (q.supportEndsAt) {
            <p>Free support ends {{ q.supportEndsAt | date: 'medium' }}</p>
          }
        </article>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .quotes-admin {
        overflow-wrap: anywhere;
      }
      p {
        line-height: 1.6;
        color: #bdc9da;
      }
      article,
      .editor {
        border-top: 1px solid #465064;
        margin-top: 24px;
        padding-top: 16px;
      }
      .preserve {
        white-space: pre-wrap;
      }
      label {
        display: block;
        margin: 14px 0;
        line-height: 1.6;
      }
      input,
      textarea {
        display: block;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        padding: 12px;
        background: #151b26;
        color: #fff;
        border: 1px solid #617188;
        border-radius: 8px;
        font: inherit;
        color-scheme: dark;
      }
      textarea {
        min-height: 100px;
        resize: vertical;
      }
      .terms-edit {
        min-height: 360px;
      }
      .fields {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 14px;
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin: 16px 0;
      }
      button {
        min-height: 44px;
        padding: 10px 14px;
        border-radius: 8px;
        background: #cee9ff;
        color: #0c1420;
        border: 0;
        font: inherit;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
      }
      .error {
        color: #ffbebe;
      }
      summary {
        cursor: pointer;
        min-height: 44px;
      }
      @media (max-width: 600px) {
        .fields {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class QuotationAdminComponent {
  @Input({ required: true }) headers!: HttpHeaders;
  private http = inject(HttpClient);
  rows = signal<Quotation[]>([]);
  busy = signal(false);
  error = signal('');
  inviteUrl = signal('');
  copied = signal(false);
  editor: any = null;
  editingId = '';
  evidence: Record<string, string> = {};
  ngOnInit() {
    void this.load();
  }
  private async request(method: 'get' | 'post' | 'put', path = '', body?: any): Promise<any> {
    return firstValueFrom(
      this.http.request(method.toUpperCase(), `${quoteApi()}/admin/quotations${path}`, {
        body,
        headers: this.headers,
      }),
    );
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
    }
  }
  async load() {
    await this.run(async () => this.rows.set(await this.request('get')));
  }
  async newDraft() {
    await this.run(async () => {
      const d = await this.request('get', '/defaults');
      this.editingId = '';
      this.editor = {
        title: '',
        clientName: '',
        clientEmail: '',
        seller: '',
        scope: '',
        exclusions: '',
        timeline: '',
        terms: d.terms,
        totalRupees: 0,
        validDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      };
    });
  }
  edit(q: Quotation) {
    this.editingId = q._id;
    this.editor = {
      ...q,
      version: q.__v,
      totalRupees: q.totalPaise / 100,
      validDate: q.validUntil.slice(0, 10),
    };
  }
  async save() {
    await this.run(async () => {
      const paise = this.editor.totalRupees * 100;
      if (!Number.isFinite(paise) || Math.abs(paise - Math.round(paise)) > 0.000001)
        throw { error: { error: 'Enter a price with at most two decimal places.' } };
      await this.request(
        this.editingId ? 'put' : 'post',
        this.editingId ? `/${this.editingId}` : '',
        {
          ...this.editor,
          totalPaise: Math.round(paise),
          validUntil: `${this.editor.validDate}T23:59:59+05:30`,
        },
      );
      this.editor = null;
      this.rows.set(await this.request('get'));
    });
  }
  async invite(q: Quotation) {
    await this.run(async () => {
      const result = await this.request('post', `/${q._id}/invite`, { version: q.__v });
      this.inviteUrl.set(`${location.origin}/proposal#${result.token}`);
      this.copied.set(false);
      this.rows.set(await this.request('get'));
    });
  }
  async revise(q: Quotation) {
    await this.run(async () => {
      const revised = await this.request('post', `/${q._id}/revise`, {});
      this.inviteUrl.set('');
      this.edit(revised);
      this.rows.set(await this.request('get'));
    });
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
