import { Component, Input, OnChanges, SimpleChanges, inject, signal, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { quoteApi, Quotation, quotationRef } from './quotation';
import { cleanDraftText, downloadQuotationFile } from './quotation-files';
import { AgreementTextComponent } from './agreement-text';

@Component({
  selector: 'app-quotation-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AgreementTextComponent],
  template: `
    <section class="quotes-admin">
      @if (!editor && !selected() && mode === 'list') {
        <div class="list-head">
          <div>
            <h2>Saved quotations</h2>
            <p>Open a quotation to review it, or start a new draft. Drafts autosave while you work.</p>
          </div>
          <div class="actions">
            <button [disabled]="busy()" (click)="newDraft()">New quotation</button>
            <button [disabled]="busy()" (click)="load()">Refresh</button>
          </div>
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
            <div class="quote-row" [class.selected]="selected()?._id === row._id">
              <button type="button" class="quote-open" (click)="open(row)" [disabled]="busy()">
                <span><strong>{{ row.title }}</strong><small>{{ reference(row) }} · {{ row.clientName }} · {{ row.clientEmail }}</small></span>
                <span class="quote-summary">{{ row.status }} · {{ row.totalPaise / 100 | currency:'INR' }}<small>Revision {{ row.revision }}</small></span>
              </button>
              @if (row.status === 'draft') {
                <button type="button" class="row-delete" (click)="deleteDraft(row)" [disabled]="busy()" [attr.aria-label]="'Delete draft ' + (row.title || 'Untitled quotation')">Delete</button>
              }
            </div>
          } @empty { <p>No quotations match these filters.</p> }
        </div>
        <nav class="pager" aria-label="Quotation pagination">
          <button type="button" (click)="movePage(-1)" [disabled]="busy() || page <= 1">Previous</button>
          @for (p of pageItems(page, pages); track $index) {
            @if (p === '…') { <span class="pager-gap">…</span> }
            @else { <button type="button" [class.on]="p === page" (click)="goPage(p)" [disabled]="busy()">{{ p }}</button> }
          }
          <button type="button" (click)="movePage(1)" [disabled]="busy() || page >= pages">Next</button>
        </nav>
      }
      @if (!editor && !selected() && mode !== 'list') {
        <p class="list-meta" aria-live="polite">
          {{ busy() ? 'Loading quotation...' : 'This quotation could not be loaded.' }}
        </p>
        <button type="button" class="back-link" (click)="closeSelection()" [disabled]="busy()">
          ← All quotations
        </button>
      }
      @if (error()) {
        <p role="alert" class="error">{{ error() }}</p>
      }
      @if (notice()) {
        <p role="status" class="notice">{{ notice() }}</p>
      }
      @if (editor) {
        <div
          class="editor"
          (input)="changed($event)"
          (change)="changed($event)"
          (focusout)="cleanField($event)"
        >
          <div class="editor-bar">
            <button type="button" class="back-link" (click)="closeEditor('list')" [disabled]="busy() || savingDraft()">← All quotations</button>
            <div class="editor-identity">
              <p class="eyebrow">{{ editingId ? 'Editing draft' : 'New quotation' }}</p>
              <h3>{{ editor.title || 'Untitled quotation' }}</h3>
              <p class="editor-meta">{{ editorReference() }}</p>
            </div>
            <div class="editor-actions">
              <span class="save-state" [class.warn]="dirty()" [class.error]="saveError()" aria-live="polite">{{ saveStateLabel() }}</span>
              <button [disabled]="busy() || savingDraft() || conflict() || !dirty()" (click)="save()">Save now</button>
              <button class="primary" [disabled]="busy() || savingDraft()" (click)="closeEditor()">{{ editingId ? 'Save & close' : 'Finish draft' }}</button>
            </div>
          </div>
          <p class="autosave-note">
            Changes autosave about a second after you stop typing. <strong>Save &amp; close</strong> saves and returns to the quotation; <strong>All quotations</strong> saves and returns to the list.
          </p>
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

          <h3 class="form-title">Project details</h3>
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
                [(ngModel)]="editor.totalRupees"
                (ngModelChange)="minimumChanged()" /></label
            ><label>Valid until<input type="date" [(ngModel)]="editor.validDate" /></label>
          </div>
          @if (editor.builder; as b) {
            @if (editor.paymentSchedule) {
            <fieldset>
              <legend>Payment schedule</legend>
              <p>Set the four phase percentages and when each payment is due. Saved changes apply immediately. Invited or accepted plans can be adjusted from the quotation page until a payment or collection arrangement starts.</p>
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
              <label>Minimum payable at onboarding (INR, optional)
                <input type="number" min="0" step="0.01" [max]="editor.totalRupees" [(ngModel)]="editor.minimumOnboardingRupees" (ngModelChange)="minimumChanged()" placeholder="e.g. 10000" />
              </label>
              @if (minimumError()) {
                <p class="error">{{ minimumError() }}</p>
              } @else if (editor.minimumOnboardingRupees) {
                <p class="hint">First phase is {{ onboardingAmount() / 100 | currency: 'INR' }}. The client cannot pay less than this at onboarding.</p>
              }
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
              <h3>Full agreement - {{ b.clauses.length }} sections</h3>
              <p>
                Complete standard clauses are already filled in. Payment triggers come from the schedule above; expand other sections to customise them.
                The preview fills in the review period, revisions, schedule, contact, venue and
                portfolio choice.
              </p>
              @for (clause of b.clauses; track clause.id; let i = $index) {
                <details>
                  <summary>{{ i + 1 }}. {{ clause.title }}</summary>
                  @if (clause.id === 'milestones' && editor.paymentSchedule) {
                    <p>Generated from your payment schedule. Use the phase controls above to change these terms.</p>
                    @for (phase of editor.paymentSchedule; track $index; let phaseIndex = $index) {
                      <p>{{ phaseLabels[phaseIndex] }}: {{ phase.percent }}% · {{ phase.timing === 'before' ? 'Before phase starts' : 'After delivery approval' }}</p>
                    }
                  } @else {
                  <label
                    >{{ clause.title
                    }}<textarea [(ngModel)]="clause.text" maxlength="2500" rows="8"></textarea>
                  </label>
                  }
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
            every clause and your business/tax details before sharing. The final price follows the payment schedule above.
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
        </div>
      }
      @if (!editor ? selected() : null; as q) {
        <article>
          <button type="button" class="back-link" (click)="closeSelection()" [disabled]="busy()">← All quotations</button>
          <div class="detail-head">
            <p class="eyebrow">Quotation · revision {{ q.revision }}</p>
            <h3>{{ q.title }}</h3>
            <p class="detail-meta">Reference {{ reference(q) }} · {{ q.clientName }} · {{ q.clientEmail }}</p>
            <p class="detail-meta"><span class="state">{{ q.status }}</span> · {{ (q.totalPaise || 0) / 100 | currency: 'INR' }}</p>
          </div>
          @if (q.draftReady === false) {
            <p class="draft-note">
              Incomplete draft - finish the required fields before inviting or exporting.
            </p>
          }
          <div class="actions detail-actions">
            @if (q.status === 'draft') {
              <button class="primary" [disabled]="busy()" (click)="openEdit(q)">Edit draft</button>
              <button class="danger" [disabled]="busy()" (click)="deleteDraft(q)">Delete draft</button>
            }
              @if (q.status === 'draft') {
                <button [disabled]="busy() || q.draftReady === false" (click)="invite(q)">
                  Create private invitation
                </button>
              }
              @if (q.status === 'invited' || q.status === 'accepted') {
                <button [disabled]="busy() || q.draftReady === false" (click)="invite(q)">
                  Create another private invitation</button
                >
                @if (canChangePlan(q)) {
                  <button [disabled]="busy()" (click)="startPlan(q)">Change payment plan</button>
                }
                <button [disabled]="busy() || q.draftReady === false" (click)="revise(q)">
                  Create a new revision
                </button>
                <button [disabled]="busy()" (click)="revoke(q)">Revoke all invitation links</button>
              }
            </div>
            @if (planDraft) {
              <fieldset class="plan-editor">
                <legend>Change payment composition</legend>
                <p>
                  Update the four phase percentages and timing without creating a revision. The
                  scope, total and other terms stay unchanged.
                </p>
                @if (q.status === 'accepted') {
                  <p class="draft-note">
                    This quotation is already accepted. Change the plan only with the client's
                    agreement and before a payment starts.
                  </p>
                }
                @for (phase of planDraft; track $index; let i = $index) {
                  <div class="fields">
                    <label
                      >{{ phaseLabels[i] }} (%)<input
                        type="number"
                        min="1"
                        max="97"
                        [(ngModel)]="phase.percent"
                    /></label>
                    <label
                      >Payment timing<select
                        [(ngModel)]="phase.timing"
                        [disabled]="i === 0 || i === 3"
                      >
                        <option value="before">Before phase starts</option>
                        <option value="after">After delivery approval</option>
                      </select></label
                    >
                  </div>
                }
                <p [class.error]="planTotal() !== 100">
                  Total: {{ planTotal() }}% - must equal 100%.
                </p>
                <p>
                  Existing invitation links show the new plan. Ask the client to reload any open
                  copy.
                </p>
                <div class="actions">
                  <button [disabled]="busy() || planTotal() !== 100" (click)="savePlan(q)">
                    Save payment plan</button
                  ><button [disabled]="busy()" (click)="cancelPlan()">Cancel</button>
                </div>
              </fieldset>
            }
          @if (inviteUrl()) {
            <fieldset class="invite-copy">
              <legend>Private invitation</legend>
              <p>Anyone holding this link can access this client's project. Share only with the client.</p>
              <input readonly [value]="inviteUrl()" (click)="select($event)" />
              <div class="actions">
                <button (click)="copy()">{{ copied() ? 'Copied' : 'Copy invitation' }}</button>
                <button (click)="shareWhatsApp(q, inviteUrl())">Share on WhatsApp</button>
              </div>
            </fieldset>
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
          @if (q.status === 'invited' || q.status === 'accepted') {
            <fieldset><legend>Invitation links</legend>
              <label>New link label (defaults to project title)<input [(ngModel)]="invitationLabel" placeholder="Defaults to the project title" maxlength="100" /></label>
              <label class="check"><input type="checkbox" [(ngModel)]="emailInvitation" /> Email new invitations to {{ q.clientEmail }}</label>
              <button (click)="loadInvitations(q)" [disabled]="busy()">Load invitation history</button>
              @for (link of invitationRows(); track link._id) {
                <div class="invitation-row"><strong>{{ link.label }}</strong> · {{ link.createdAt | date:'medium' }}
                  <span>{{ link.revokedAt ? 'Revoked' : 'Expires ' + (link.expiresAt | date:'mediumDate') }} · Email: {{ link.emailStatus }}</span>
                  @if (!link.revokedAt) {
                    <button (click)="linkAction(q, link, 'copy')" [disabled]="busy() || link._id === 'legacy'">Copy this link</button>
                    <button (click)="shareLink(q, link)" [disabled]="busy() || link._id === 'legacy'">Share on WhatsApp</button>
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
          @if (q.minimumOnboardingPaise) {
            <p>Minimum at onboarding: {{ q.minimumOnboardingPaise / 100 | currency: 'INR' }}</p>
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
      article {
        border-top: 1px solid #465064;
        margin-top: 24px;
        padding-top: 16px;
      }
      .editor {
        margin-top: 12px;
      }
      .back-link {
        display: inline-flex;
        align-items: center;
        min-height: 36px;
        padding: 4px 0;
        background: transparent;
        color: #cee9ff;
        border: 0;
        font-weight: 600;
      }
      .back-link:hover {
        text-decoration: underline;
      }
      .list-head {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-end;
        gap: 16px;
      }
      .list-head h2 {
        margin: 0;
      }
      .list-head p {
        margin: 6px 0 0;
      }
      .list-head .actions {
        margin: 0;
      }
      .editor-bar {
        position: sticky;
        top: 0;
        z-index: 3;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 16px;
        padding: 12px 14px;
        background: #172230;
        border: 1px solid #617188;
        border-radius: 12px;
        box-shadow: 0 10px 28px rgba(7, 12, 20, 0.28);
      }
      .editor-identity {
        flex: 1 1 220px;
        min-width: 0;
      }
      .editor-identity h3 {
        margin: 2px 0;
        font-size: 1.05rem;
        overflow-wrap: anywhere;
      }
      .editor-meta {
        margin: 2px 0 0;
        color: #a5b7ca;
        font-size: 0.78rem;
      }
      .eyebrow {
        margin: 0;
        color: #9fb6cc;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .editor-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-left: auto;
      }
      .save-state {
        padding: 4px 9px;
        border-radius: 999px;
        background: #26364a;
        color: #d8e8f8;
        font-size: 12px;
        white-space: nowrap;
      }
      .save-state.warn {
        background: #3a331c;
        color: #ffe2a3;
      }
      .save-state.error {
        background: #3d2028;
        color: #ffbebe;
      }
      .autosave-note {
        margin: 10px 0 0;
        color: #a5b7ca;
        font-size: 13px;
      }
      .form-title {
        margin-top: 24px;
      }
      .detail-head {
        margin: 8px 0 16px;
      }
      .detail-head h3 {
        margin: 2px 0 6px;
        font-size: clamp(1.45rem, 3vw, 1.9rem);
      }
      .detail-meta {
        margin: 3px 0;
        color: #a5b7ca;
        font-size: 0.9rem;
      }
      .state {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        background: #2b3849;
        color: #dcefff;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .detail-actions {
        margin-top: 12px;
      }
      .primary {
        background: #d9efff;
        font-weight: 650;
      }
      .danger {
        background: transparent;
        border: 1px solid #a25d68;
        color: #ffbebe;
      }
      .danger:hover {
        background: #3a2028;
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
      .quote-ref { color:#a5a7b5; font-size:13px; letter-spacing:0.04em; text-transform:uppercase; }
      .hint { color:#a5a7b5; font-size:13px; margin:4px 0 0; }
      .pager { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:16px 0; }
      .pager button { min-width:40px; padding:8px 10px; min-height:38px; }
      .pager button.on { background:#f0f4f8; }
      .pager-gap { color:#a5a7b5; padding:0 4px; }
      .quote-list { border-top:1px solid #353641; }
      .quote-row { display:flex; align-items:stretch; gap:4px; border-bottom:1px solid #353641; }
      .quote-row.selected { background:#242530; }
      .quote-open { display:flex; flex:1; justify-content:space-between; gap:20px; min-width:0; padding:16px 12px; background:transparent; color:inherit; border:0; border-radius:0; text-align:left; }
      .quote-row small { display:block; margin-top:5px; color:#a5a7b5; overflow-wrap:anywhere; }
      .quote-row span:first-child { flex:1; min-width:0; overflow-wrap:anywhere; }
      .row-delete { align-self:center; flex:0 0 auto; min-height:38px; margin:0 8px; padding:6px 10px; background:transparent; border:1px solid #75505a; color:#ffbebe; font-size:13px; }
      .row-delete:hover { background:#3a2028; }
      .invite-copy input { margin:10px 0; }
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
      .notice {
        padding: 10px 12px;
        border-radius: 8px;
        background: #1e3328;
        color: #b8f5d0;
      }
      summary {
        cursor: pointer;
        min-height: 44px;
      }
      @media (max-width: 600px) {
        .editor-bar {
          padding: 10px;
          gap: 8px;
        }
        .editor-identity {
          flex-basis: 100%;
          order: 2;
        }
        .editor-bar .back-link {
          order: 1;
        }
        .editor-actions {
          order: 3;
          width: 100%;
          margin-left: 0;
        }
        .save-state {
          flex: 1;
          text-align: center;
        }
        .editor-actions button {
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
export class QuotationAdminComponent implements OnChanges {
  @Input({ required: true }) headers!: HttpHeaders;
  @Input() quotationId = '';
  @Input() mode: 'list' | 'new' | 'detail' | 'edit' = 'list';
  private http = inject(HttpClient);
  private router = inject(Router, { optional: true });
  private cdr = inject(ChangeDetectorRef);
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
  ngOnChanges(changes: SimpleChanges) {
    if (this.routeReady && (changes['mode'] || changes['quotationId']))
      void this.applyRoute();
  }
  ngOnInit() {
    this.routeReady = true;
    void this.applyRoute();
  }
  private async applyRoute(force = false) {
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
      await this.save(true);
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
