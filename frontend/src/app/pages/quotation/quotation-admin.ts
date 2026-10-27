import { Component, Input, inject, signal, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { quoteApi, Quotation } from './quotation';
import { cleanDraftText, downloadQuotationFile } from './quotation-files';
import { AgreementTextComponent } from './agreement-text';

@Component({
  selector: 'app-quotation-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AgreementTextComponent],
  template: `
    <section class="quotes-admin">
      <h2>Project quotations and invitations</h2>
      <p>
        Create a custom agreement, preview its full terms, then copy a private invite to share with
        the client. Inviting freezes its terms.
      </p>
      <div class="actions">
        <button [disabled]="busy() || !!editor" (click)="newDraft()">New quotation</button
        ><button [disabled]="busy()" (click)="load()">Refresh</button>
      </div>
      <form class="list-tools" (ngSubmit)="page = 1; load()">
        <label>Search quotations<input name="quoteSearch" [(ngModel)]="search" placeholder="Client, email, project or quotation ID" maxlength="120" /></label>
        <label>Status<select name="quoteStatus" [(ngModel)]="status"><option value="">All statuses</option><option value="draft">Draft</option><option value="invited">Invited</option><option value="accepted">Accepted</option><option value="cancelled">Superseded</option></select></label>
        <label>Created from<input type="date" name="quoteFrom" [(ngModel)]="from" /></label><label>Created to<input type="date" name="quoteTo" [(ngModel)]="to" /></label>
        <button [disabled]="busy()">Search</button>
      </form>
      <p class="list-meta" aria-live="polite">{{ total }} quotations · page {{ page }} of {{ pages }}</p>
      <div class="quote-list">
        @for (row of rows(); track row._id) {
          <button class="quote-row" [class.selected]="selected()?._id === row._id" (click)="open(row)" [disabled]="busy() || !!editor">
            <span><strong>{{ row.title }}</strong><small>{{ row.clientName }} · {{ row.clientEmail }}</small></span>
            <span>{{ row.status }} · {{ row.totalPaise / 100 | currency:'INR' }}<small>Revision {{ row.revision }}</small></span>
          </button>
        } @empty { <p>No quotations match these filters.</p> }
      </div>
      <div class="actions"><button (click)="movePage(-1)" [disabled]="busy() || page <= 1">Previous</button><button (click)="movePage(1)" [disabled]="busy() || page >= pages">Next</button></div>
      @if (pages > 1) { <label>Go to page<input type="number" min="1" [max]="pages" [(ngModel)]="page" (change)="load()" /></label> }
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
        <div
          class="editor"
          (input)="changed($event)"
          (change)="changed($event)"
          (focusout)="cleanField($event)"
        >
          <div class="save-bar">
            <div>
              <strong>{{
                savingDraft() ? 'Saving...' : dirty() ? 'Unsaved changes' : 'All changes saved'
              }}</strong
              ><small>Drafts save automatically, including unfinished fields.</small>
            </div>
            <button [disabled]="busy() || savingDraft() || conflict()" (click)="save()">
              Save now</button
            ><button [disabled]="busy() || savingDraft()" (click)="closeEditor()">
              Close editor
            </button>
          </div>
          @if (saveError()) {
            <p class="error" role="alert">{{ saveError() }}</p>
            @if (!conflict()) {
              <button (click)="save()">Retry save</button>
            } @else {
              <button (click)="reloadDraft()">Discard local changes and reload saved draft</button>
            }
          }
          @if (currentQuote()?.draftReady === false) {
            <p class="draft-note">
              Saved as an incomplete draft. Before inviting or exporting:
              {{ currentQuote()?.draftValidation }}
            </p>
          }

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
          @if (editor.builder; as b) {
            @if (editor.paymentSchedule) {
            <fieldset>
              <legend>Payment schedule</legend>
              <p>Set the four phase percentages and when each payment is due. Changes apply to this draft and freeze when invited.</p>
              <label>Initial payment: {{ editor.paymentSchedule[0].percent }}%
                <input type="range" min="1" max="97" [ngModel]="editor.paymentSchedule[0].percent" (ngModelChange)="initialPercent($event)" />
              </label>
              @for (phase of editor.paymentSchedule; track $index; let i = $index) {
                <div class="fields">
                  <label>{{ phaseLabels[i] }} (%)<input type="number" min="1" max="97" [(ngModel)]="phase.percent" /></label>
                  <label>Payment timing<select [(ngModel)]="phase.timing" [disabled]="i === 0 || i === 3"><option value="before">Before phase starts</option><option value="after">After delivery approval</option></select></label>
                </div>
              }
              <p [class.error]="scheduleTotal() !== 100">Total: {{ scheduleTotal() }}% · must equal 100%. A before-phase payment still requires the client's explicit approval of the phase plan.</p>
            </fieldset>
            }
            <fieldset>
              <legend>Provider details</legend>
              <p>
                These are prefilled from your latest guided quotation when available. Check they are
                current.
              </p>
              <div class="fields">
                <label
                  >Provider legal name<input
                    [(ngModel)]="b.provider.name"
                    maxlength="120"
                    autocomplete="organization"
                /></label>
                <label
                  >Provider contact email<input
                    type="email"
                    [(ngModel)]="b.provider.email"
                    maxlength="254"
                    autocomplete="email"
                /></label>
              </div>
              <label
                >Provider address<textarea
                  [(ngModel)]="b.provider.address"
                  maxlength="500"
                  autocomplete="street-address"
                ></textarea>
              </label>
              <div class="fields">
                <label
                  >GST / tax status<select
                    aria-label="GST / tax status"
                    [(ngModel)]="b.provider.taxStatus"
                  >
                    <option value="" disabled>Choose your status</option>
                    <option value="not_registered">Not GST registered - no GST charged</option>
                    <option value="registered">GST registered - tax included in final price</option>
                    <option value="other">Other tax treatment - describe below</option>
                  </select></label
                >
                <label
                  >Dispute venue (city and state)<input
                    [(ngModel)]="b.provider.venue"
                    maxlength="160"
                    placeholder="Enter the agreed city and state"
                /></label>
              </div>
              @if (b.provider.taxStatus === 'registered') {
                <label
                  >GSTIN<input
                    [(ngModel)]="b.provider.gstin"
                    maxlength="15"
                    (ngModelChange)="b.provider.gstin = $event.toUpperCase()"
                /></label>
              }
              <label
                >Tax details
                {{ b.provider.taxStatus === 'not_registered' ? '(optional)' : '(required)'
                }}<input
                  [(ngModel)]="b.provider.taxNote"
                  maxlength="500"
                  placeholder="Describe applicable tax and its inclusion in the quoted total"
              /></label>
            </fieldset>
            <fieldset>
              <legend>What is included?</legend>
              <p>
                Tick the deliverables. Each includes a starting acceptance criterion; add the exact
                pages, flows and limits below.
              </p>
              <div class="checks">
                @for (f of catalog.features; track f.id) {
                  <label class="check"
                    ><input
                      type="checkbox"
                      [ngModel]="b.features.includes(f.id)"
                      (ngModelChange)="toggle('features', f.id, $event)"
                    /><span
                      >{{ f.label }}<small>{{ f.acceptance }}</small></span
                    ></label
                  >
                }
              </div>
              <label
                >Project-specific deliverables and acceptance criteria<textarea
                  [(ngModel)]="b.scopeNotes"
                  maxlength="3000"
                  placeholder="Example: Home, Services and Contact pages; two booking types; confirmation email. MVP includes the working booking flow. Completion includes all agreed pages and successful mobile tests."
                ></textarea>
              </label>
            </fieldset>
            <fieldset>
              <legend>Exclusions and revisions</legend>
              <div class="checks">
                @for (f of catalog.exclusions; track f.id) {
                  <label class="check"
                    ><input
                      type="checkbox"
                      [ngModel]="b.exclusions.includes(f.id)"
                      (ngModelChange)="toggle('exclusions', f.id, $event)"
                    /><span>{{ f.label }}</span></label
                  >
                }
              </div>
              <label
                >Included revision rounds per milestone<input
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  [(ngModel)]="b.revisionRounds"
              /></label>
              <p>
                Agreed-scope defect corrections do not consume a revision round. New features
                require a separate accepted change quotation.
              </p>
              <label
                >Other exclusions or cost arrangements (optional)<textarea
                  [(ngModel)]="b.exclusionNotes"
                  maxlength="1000"
                ></textarea>
              </label>
            </fieldset>
            <fieldset>
              <legend>Timeline and client responsibilities</legend>
              <div class="fields">
                <label
                  >Estimated project duration (weeks)<input
                    type="number"
                    min="1"
                    max="52"
                    step="1"
                    [(ngModel)]="b.weeks" /></label
                ><label
                  >Client review target (business days)<input
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    [(ngModel)]="b.reviewDays"
                /></label>
              </div>
              <div class="checks">
                @for (f of catalog.responsibilities; track f.id) {
                  <label class="check"
                    ><input
                      type="checkbox"
                      [ngModel]="b.responsibilities.includes(f.id)"
                      (ngModelChange)="toggle('responsibilities', f.id, $event)"
                    /><span>{{ f.label }}</span></label
                  >
                }
              </div>
              <label
                >Phase dates and special dependencies (optional)<textarea
                  [(ngModel)]="b.timelineNotes"
                  maxlength="1000"
                ></textarea>
              </label>
              <label class="check"
                ><input type="checkbox" [(ngModel)]="b.portfolio" /><span
                  >Request client permission to show publicly released work in my portfolio.
                  Confidential data stays private.</span
                ></label
              >
            </fieldset>
            <section class="agreement-editor">
              <h3>Full agreement - {{ b.clauses.length }} editable sections</h3>
              <p>
                Complete standard clauses are already filled in. Expand a section to customise it.
                The preview fills in the review period, revisions, schedule, contact, venue and
                portfolio choice.
              </p>
              @for (clause of b.clauses; track clause.id; let i = $index) {
                <details>
                  <summary>{{ i + 1 }}. {{ clause.title }}</summary>
                  <label
                    >{{ clause.title
                    }}<textarea [(ngModel)]="clause.text" maxlength="2500" rows="8"></textarea>
                  </label>
                </details>
              }
              <label
                >Additional project-specific agreement terms (optional)<textarea
                  [(ngModel)]="b.additionalTerms"
                  maxlength="1800"
                ></textarea>
              </label>
            </section>
            <button type="button" [disabled]="busy()" (click)="preview()">
              Preview generated quotation
            </button>
            @if (previewText(); as preview) {
              <section class="generated-preview" aria-live="polite">
                <h3>Project proposal and service agreement</h3>
                <p>
                  Generated from the choices at the time you clicked Preview. Saving regenerates
                  from your current choices.
                </p>
                @for (section of preview; track section.title) {
                  <div class="preview-section">
                    <h4>{{ section.title }}</h4>
                    <app-agreement-text [text]="section.text" />
                  </div>
                }
              </section>
            }
          } @else {
            <p>
              This draft uses the original text editor. Existing wording is preserved; new
              quotations use the guided builder.
            </p>
            <label
              >Provider legal name, contact email, address, GST/tax treatment and dispute
              venue<textarea [(ngModel)]="editor.seller" maxlength="2500"></textarea>
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
          }
          <p>
            Default support: 30 calendar days of agreed-scope bug fixes from deployment. Review
            every clause and your business/tax details before sharing. The final price is split 25%
            / 25% / 40% / 10%.
          </p>
          <fieldset>
            <legend>SRS requirements documents</legend>
            <p>
              Attach up to 3 PDF or Word (.docx) files, 5 MB each. Upload the agreed SRS before
              creating the invitation; invited files are frozen with the terms.
            </p>
            <label
              >Upload SRS<input
                type="file"
                accept=".pdf,.docx"
                [disabled]="busy() || savingDraft() || conflict()"
                (change)="uploadSrs($event)"
            /></label>
            @for (file of currentQuote()?.srs || []; track file.fileId) {
              <div class="file-row">
                <span>{{ file.name }} ({{ file.size / 1024 | number: '1.0-0' }} KB)</span
                ><button [disabled]="busy()" (click)="downloadSrs(currentQuote()!, file)">
                  Download</button
                ><button
                  [disabled]="busy() || savingDraft() || conflict()"
                  (click)="removeSrs(file.fileId)"
                >
                  Remove
                </button>
              </div>
            }
          </fieldset>
          <div class="actions">
            <button [disabled]="busy() || savingDraft() || conflict()" (click)="save()">
              Save now</button
            ><button [disabled]="busy() || savingDraft()" (click)="closeEditor()">
              Close editor
            </button>
          </div>
        </div>
      }
      @if (selected(); as q) {
        <article>
          <button (click)="selected.set(null)" [disabled]="!!editor">Close quotation details</button>
          <h3>{{ q.title }} · revision {{ q.revision }}</h3>
          <p>
            {{ q.clientName }} · {{ q.clientEmail }} · {{ q.status }} ·
            {{ (q.totalPaise || 0) / 100 | currency: 'INR' }}
          </p>
          @if (q.draftReady === false) {
            <p class="draft-note">
              Incomplete draft - finish the required fields before inviting or exporting.
            </p>
          }
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
              <button [disabled]="busy() || !!editor" (click)="edit(q)">Edit draft</button>
            }
            @if (q.status !== 'cancelled') {
              <button [disabled]="busy() || !!editor || q.draftReady === false" (click)="invite(q)">
                {{
                  q.status === 'draft'
                    ? 'Freeze terms and create invite'
                    : 'Create another private invitation'
                }}</button
              ><button
                [disabled]="busy() || !!editor || q.draftReady === false"
                (click)="revise(q)"
              >
                Create revision
              </button>
            }
            @if (q.status === 'invited' || q.status === 'accepted') {
              <button [disabled]="busy() || !!editor" (click)="revoke(q)">
                Revoke all invitation links
              </button>
            }
          </div>
          @if (q.status === 'invited' || q.status === 'accepted') {
            <fieldset><legend>Invitation links</legend>
              <label>New link label<input [(ngModel)]="invitationLabel" placeholder="e.g. Client finance team" maxlength="100" /></label>
              <label class="check"><input type="checkbox" [(ngModel)]="emailInvitation" /> Email new invitations to {{ q.clientEmail }}</label>
              <button (click)="loadInvitations(q)" [disabled]="busy()">Load invitation history</button>
              @for (link of invitationRows(); track link._id) {
                <div class="invitation-row"><strong>{{ link.label }}</strong> · {{ link.createdAt | date:'medium' }}
                  <span>{{ link.revokedAt ? 'Revoked' : 'Expires ' + (link.expiresAt | date:'mediumDate') }} · Email: {{ link.emailStatus }}</span>
                  @if (!link.revokedAt) {
                    <button (click)="linkAction(q, link, 'copy')" [disabled]="busy() || link._id === 'legacy'">Copy this link</button>
                    <button (click)="linkAction(q, link, 'email')" [disabled]="busy() || link._id === 'legacy' || link.emailStatus === 'sending'">Email this link</button>
                    <button (click)="linkAction(q, link, 'revoke')" [disabled]="busy()">Revoke this link</button>
                  }
                </div>
              }
            </fieldset>
          }
          <div class="actions">
            <button
              [disabled]="busy() || q.draftReady === false || (!!editor && editingId === q._id)"
              (click)="download(q, 'pdf')"
            >
              Download PDF</button
            ><button
              [disabled]="busy() || q.draftReady === false || (!!editor && editingId === q._id)"
              (click)="download(q, 'docx')"
            >
              Download Word
            </button>
          </div>
          @for (file of q.srs || []; track file.fileId) {
            <p>
              <button [disabled]="busy()" (click)="downloadSrs(q, file)">
                SRS: {{ file.name }}
              </button>
            </p>
          }
          @if (q.acceptance) {
            <p>Accepted by {{ q.acceptance.name }} on {{ q.acceptance.at | date: 'medium' }}</p>
          }
          @if (paymentEmails().length) {
            <fieldset><legend>Payment receipts</legend>
              @for (receipt of paymentEmails(); track receipt.paymentId) {
                <p>{{ receipt.paidAt | date:'medium' }} · {{ receipt.amountPaise / 100 | currency:'INR' }} · Email: {{ receipt.status }}</p>
                <button (click)="receiptPdf(q, receipt.paymentId)" [disabled]="busy()">Download receipt</button>
                @if (receipt.status === 'failed') { <button (click)="retryReceipt(q, receipt.paymentId)" [disabled]="busy()">Retry email</button> }
              }
            </fieldset>
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
            @if (!m.paidAt && ((q.status === 'invited' && i === 0) || (q.status === 'accepted' && m.approvedAt && (i === 0 || q.milestones[i - 1].paidAt)))) {
              <fieldset>
                <legend>{{ m.label }} collection</legend>
                <p>Paid: {{ (m.paidPaise || 0) / 100 | currency: 'INR' }} · Balance: {{ (m.remainingPaise ?? m.amountPaise) / 100 | currency: 'INR' }} · Pay now: {{ (m.payablePaise ?? m.amountPaise) / 100 | currency: 'INR' }}</p>
                @if (m.orderId) {
                  <p>A checkout is already prepared. Reconcile that payment before changing the amount.</p>
                } @else {
                  <label>Collect now (₹)<input type="number" min="1" step="0.01" [max]="(m.remainingPaise ?? m.amountPaise) / 100" [(ngModel)]="collectionAmounts[q._id + i]" /></label>
                  <label>Reason for this arrangement<textarea maxlength="500" [(ngModel)]="collectionReasons[q._id + i]"></textarea></label>
                  <p>This changes the next payment only. The full quotation price and unpaid balance stay due. After this payment, checkout requests the remaining milestone balance.</p>
                  <button [disabled]="busy() || !!editor || !collectionAmounts[q._id + i] || !collectionReasons[q._id + i]" (click)="setCollection(q, i)">Save collection amount</button>
                }
                @for (entry of m.collections || []; track $index) {
                  <p>{{ entry.at | date: 'medium' }} · {{ entry.amountPaise / 100 | currency: 'INR' }} · {{ entry.reason }}</p>
                }
              </fieldset>
            }
            @if (q.status === 'accepted' && i > 0 && q.milestones[i - 1].paidAt && !m.approvedAt) {
              <label
                >{{ m.timing === 'before' ? 'Phase plan and proposed work for client approval' : 'Delivery notes, review link and acceptance evidence' }}<textarea
                  [(ngModel)]="evidence[q._id + i]"
                  maxlength="3000"
                ></textarea>
              </label>
              <button
                [disabled]="busy() || !!editor || !evidence[q._id + i]"
                (click)="release(q, i)"
              >
                {{
                  m.timing === 'before' ? 'Request phase approval and advance payment' : i === 3
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
      .save-bar {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        padding: 14px;
        background: #172230;
        border: 1px solid #617188;
        border-radius: 12px;
      }
      .save-bar div {
        flex: 1 1 180px;
      }
      .save-bar small {
        display: block;
        margin-top: 4px;
        color: #bdc9da;
      }
      .draft-note {
        padding: 12px;
        background: #282519;
        border-radius: 8px;
        color: #ffe2a3;
      }
      .file-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin: 12px 0;
      }
      .file-row span {
        flex: 1 1 200px;
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
      select,
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
      fieldset {
        border: 1px solid #465064;
        border-radius: 12px;
        padding: 16px;
        margin: 20px 0;
        min-width: 0;
      }
      legend {
        font-weight: 650;
        padding: 0 8px;
      }
      .checks {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 8px 20px;
      }
      label.check {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin: 8px 0;
        padding: 8px 0;
      }
      .check input {
        width: 22px;
        height: 22px;
        flex: 0 0 22px;
        margin-top: 2px;
      }
      .check small {
        display: block;
        line-height: 1.5;
        color: #b8c8db;
        margin-top: 6px;
      }
      .agreement-editor details {
        border-bottom: 1px solid #465064;
        padding: 8px 0;
      }
      .agreement-editor summary {
        display: flex;
        align-items: center;
        padding: 8px 0;
      }
      .list-tools { display:flex; flex-wrap:wrap; align-items:end; gap:12px; margin:24px 0 12px; }
      .list-tools label { flex:1; min-width:180px; }
      .list-meta { color:#a5a7b5; font-size:14px; }
      .quote-list { border-top:1px solid #353641; }
      button.quote-row { display:flex; justify-content:space-between; gap:20px; width:100%; text-align:left; border:0; border-bottom:1px solid #353641; border-radius:0; padding:16px 12px; background:transparent; color:inherit; }
      .quote-row small { display:block; margin-top:5px; color:#a5a7b5; overflow-wrap:anywhere; }
      .quote-row span:first-child { flex:1; min-width:0; overflow-wrap:anywhere; }
      button.quote-row.selected { background:#242530; }
      .invitation-row { padding:16px 0; border-top:1px solid #353641; }
      .invitation-row span { display:block; margin:8px 0; }
      .generated-preview {
        border: 1px solid #dce2e8;
        background: #fff;
        color: #354356;
        border-radius: 4px;
        padding: clamp(20px, 5vw, 48px);
        margin: 16px 0;
      }
      .generated-preview p {
        color: #617183;
      }
      .generated-preview h3 {
        color: #182b40;
        font-size: 1.5rem;
      }
      .generated-preview h4 {
        color: #182b40;
        font-size: 1.1rem;
        margin: 0 0 18px;
      }
      .preview-section {
        padding: 26px 0;
        border-top: 1px solid #dce2e8;
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
        .save-bar {
          padding: 10px;
          gap: 8px;
        }
        .save-bar div {
          flex-basis: 100%;
        }
        .save-bar small {
          display: none;
        }
        .save-bar button {
          padding: 8px;
          flex: 1;
          font-size: 14px;
        }
        .checks,
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
  private cdr = inject(ChangeDetectorRef);
  rows = signal<Quotation[]>([]);
  selected = signal<Quotation | null>(null);
  invitationRows = signal<any[]>([]);
  paymentEmails = signal<any[]>([]);
  async receiptPdf(q: Quotation, paymentId: string) {
    await this.run(() => downloadQuotationFile(this.http, `${quoteApi()}/admin/quotations/${q._id}/receipts/${paymentId}/pdf`, this.headers, `receipt-${paymentId}.pdf`));
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
  phaseLabels = ['Onboarding', 'MVP', 'Development complete', 'Deployment'];
  scheduleTotal() { return this.editor?.paymentSchedule?.reduce((s: number, m: any) => s + Number(m.percent || 0), 0) || 0; }
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
    await this.run(async () => {
      this.invitationRows.set([]); this.paymentEmails.set([]);
      this.selected.set(await this.request('get', `/${row._id}`));
      const [links, receipts] = await Promise.all([this.request('get', `/${row._id}/invitations`), this.request('get', `/${row._id}/receipts`)]);
      this.invitationRows.set(links); this.paymentEmails.set(receipts);
    });
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
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty() || this.savingDraft()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearTimeout(this.saveTimer);
  }
  private snapshot() {
    const keys = [
      'title',
      'clientName',
      'clientEmail',
      'builder',
      'totalRupees',
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
  async closeEditor() {
    await this.save();
    if (!this.dirty() && !this.saveError()) {
      clearTimeout(this.saveTimer);
      this.editor = null;
      this.currentQuote.set(null);
    }
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
  ngOnInit() {
    void this.load();
  }
  private async request(method: 'get' | 'post' | 'put', path = '', body?: any): Promise<any> {
    const result: any = await firstValueFrom(
      this.http.request(method.toUpperCase(), `${quoteApi()}/admin/quotations${path}`, {
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
    await this.run(async () => {
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
    this.startEditor(q);
  }
  private async loadCatalog() {
    try {
      const d = await this.request('get', '/defaults');
      this.catalog = d.catalog;
      this.cdr.markForCheck();
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
  async save(): Promise<void> {
    clearTimeout(this.saveTimer);
    if (!this.editor || this.conflict()) return;
    if (this.savePromise) {
      await this.savePromise;
      if (this.dirty() && !this.saveError()) return this.save();
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
            this.http.post<Quotation>(`${quoteApi()}/admin/quotation-drafts`, this.pending, {
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
      await this.save();
      if (this.saveError()) return;
      const q = await firstValueFrom(
        this.http.post<Quotation>(`${quoteApi()}/admin/quotations/${this.editingId}/srs`, file, {
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
          `${quoteApi()}/admin/quotations/${this.editingId}/srs/${fileId}`,
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
        `${quoteApi()}/admin/quotations/${q._id}/export/${format}`,
        this.headers,
        `quotation-revision-${q.revision}.${format}`,
      ),
    );
  }
  async downloadSrs(q: Quotation, file: { fileId: string; name: string }) {
    await this.run(() =>
      downloadQuotationFile(
        this.http,
        `${quoteApi()}/admin/quotations/${q._id}/srs/${file.fileId}`,
        this.headers,
        file.name,
      ),
    );
  }
  async invite(q: Quotation) {
    await this.run(async () => {
      const result = await this.request('post', `/${q._id}/invite`, { version: q.__v, label: this.invitationLabel, sendEmail: this.emailInvitation });
      this.inviteUrl.set(`${location.origin}/proposal#${result.token}`);
      this.copied.set(false);
      this.invitationRows.set(await this.request('get', `/${q._id}/invitations`));
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
