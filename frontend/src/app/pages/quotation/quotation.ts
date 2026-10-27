import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { downloadQuotationFile } from './quotation-files';
import { AgreementTextComponent } from './agreement-text';

export const quoteApi = () =>
  location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
export type Milestone = {
  label: string;
  percent: number;
  amountPaise: number;
  paidPaise?: number;
  remainingPaise?: number;
  payablePaise?: number;
  orderId?: string;
  collections?: { amountPaise: number; reason: string; at: string }[];
  payments?: { orderId: string; paymentId: string; amountPaise: number; at: string }[];
  evidence?: string;
  feedback?: string;
  releasedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  paymentId?: string;
};
export type Quotation = {
  _id: string;
  __v: number;
  title: string;
  clientName: string;
  clientEmail: string;
  seller: string;
  builder?: any;
  draftEditor?: any;
  draftReady?: boolean;
  draftValidation?: string;
  srs?: { fileId: string; name: string; size: number; sha256: string }[];
  scope: string;
  exclusions: string;
  timeline: string;
  terms: string;
  totalPaise: number;
  validUntil: string;
  revision: number;
  status: string;
  digest: string;
  paymentsEnabled: boolean;
  milestones: Milestone[];
  acceptance?: { name: string; email: string; at: string; digest: string };
  deployedAt?: string;
  supportEndsAt?: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AgreementTextComponent],
  template: `
    <main class="quote-page">
      <nav class="portal-nav" aria-label="Project portal">
        <a routerLink="/">Pratyush Mishra<span>Client workspace</span></a
        ><span class="private-label">{{
          isExample ? 'Read-only sample' : 'Private document'
        }}</span>
      </nav>
      @if (isExample) {
        <aside class="sample-notice" role="note">
          <h1>Sample quotation for website review</h1>
          <p>
            Illustrative scope and rates only. This is not a client contract or payment request.
            Acceptance, approvals and payments are disabled. Real projects use a private client
            invitation.
          </p>
          <a routerLink="/work">Services and pricing</a> ·
          <a routerLink="/book">Technical consultation</a>
        </aside>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (!quote()) {
        <h1>Client project portal</h1>
        <p>
          {{ busy() ? 'Opening your invitation…' : 'Open the private invitation shared with you.' }}
        </p>
      }
      @if (quote(); as q) {
        <div class="document-toolbar">
          <button class="contents-link" (click)="goTo('agreement-contents')">
            View agreement contents
          </button>
          <div class="actions">
            <button class="secondary" [disabled]="busy()" (click)="download('pdf')">
              Download PDF
            </button>
            <button class="secondary" [disabled]="busy()" (click)="download('docx')">
              Download Word
            </button>
          </div>
        </div>
        <article class="agreement-document" aria-label="Project proposal and service agreement">
          <header class="document-header">
            <div class="document-kicker">
              <span>Project proposal &amp; service agreement</span
              ><span class="status">{{ q.status }}</span>
            </div>
            <h1>{{ q.title }}</h1>
            <p class="document-intro">
              Project scope, delivery milestones, commercial terms and the complete agreement for
              your review.
            </p>
            <dl class="document-facts">
              <div>
                <dt>Total project fee</dt>
                <dd class="project-total">{{ q.totalPaise / 100 | currency: 'INR' }}</dd>
              </div>
              <div>
                <dt>Document revision</dt>
                <dd>{{ q.revision }}</dd>
              </div>
              <div>
                <dt>{{ isExample ? 'Example date' : 'Accept by' }}</dt>
                <dd>{{ q.validUntil | date: 'mediumDate' }}</dd>
              </div>
            </dl>
          </header>
          <section id="agreement-contents" class="contents">
            <h2>Agreement contents</h2>
            <nav aria-label="Agreement contents">
              <button class="contents-link" (click)="goTo('agreement-parties')">01 Parties</button
              ><button class="contents-link" (click)="goTo('agreement-scope')">
                02 Scope &amp; delivery
              </button>
              <button class="contents-link" (click)="goTo('agreement-payments')">
                03 Payment schedule</button
              ><button class="contents-link" (click)="goTo('agreement-srs')">
                04 Requirements
              </button>
              <button class="contents-link" (click)="goTo('agreement-terms')">
                05 General terms</button
              ><button class="contents-link" (click)="goTo('agreement-acceptance')">
                06 Acceptance
              </button>
            </nav>
          </section>
          <section id="agreement-parties">
            <h2><span class="section-number">01</span> Parties to this agreement</h2>
            <div class="parties">
              <div>
                <h3>Service provider</h3>
                <p class="preserve">{{ q.seller }}</p>
              </div>
              <div>
                <h3>Prepared for</h3>
                <p class="client-name">{{ q.clientName }}</p>
                <p class="client-email">{{ q.clientEmail }}</p>
              </div>
            </div>
          </section>
          <section id="agreement-scope">
            <h2><span class="section-number">02</span> Scope and delivery</h2>
            <h3>Deliverables and acceptance criteria</h3>
            <app-agreement-text [text]="q.scope" />
            <h3 class="subsection">Exclusions and revision limits</h3>
            <app-agreement-text [text]="q.exclusions" />
            <h3 class="subsection">Timeline and client responsibilities</h3>
            <app-agreement-text [text]="q.timeline" />
          </section>
          <section id="agreement-payments">
            <h2><span class="section-number">03</span> Milestones and payment schedule</h2>
            <p>
              The project fee is paid in four instalments. Review the delivery and payment triggers
              in the general terms below.
            </p>
            <div class="payment-summary" role="table" aria-label="Milestone payment summary">
              <div class="payment-heading" role="row">
                <span role="columnheader">Milestone</span><span role="columnheader">Share</span
                ><span role="columnheader">Amount</span>
              </div>
              @for (m of q.milestones; track $index) {
                <div role="row">
                  <span role="cell">{{ m.label }}</span
                  ><span role="cell">{{ m.percent }}%</span
                  ><span role="cell">{{ m.amountPaise / 100 | currency: 'INR' }}</span>
                </div>
              }
            </div>
            <h3 class="subsection">Delivery and payment status</h3>
            <ol class="milestones">
              @for (m of q.milestones; track $index; let i = $index) {
                <li>
                  <h3>{{ m.label }} · {{ m.percent }}%</h3>
                  <strong>{{ m.amountPaise / 100 | currency: 'INR' }}</strong>
                  <p>
                    {{
                      m.paidAt
                        ? 'Paid'
                        : m.approvedAt
                          ? 'Ready for payment'
                          : m.releasedAt
                            ? 'Ready for your review'
                            : 'Upcoming'
                    }}
                  </p>
                  @if (m.evidence) {
                    <p class="preserve">{{ m.evidence }}</p>
                  }
                  @if (m.feedback) {
                    <p class="preserve">Your requested changes: {{ m.feedback }}</p>
                  }
                  @if (m.paidAt) {
                    <p>Received {{ m.paidAt | date: 'medium' }} · {{ m.paymentId }}</p>
                  }
                  @if (m.paidPaise && !m.paidAt) {
                    <p>Paid so far: {{ m.paidPaise / 100 | currency: 'INR' }} · Remaining: {{ (m.remainingPaise ?? 0) / 100 | currency: 'INR' }}</p>
                  }
                  @for (payment of m.payments || []; track payment.paymentId) {
                    <p>{{ payment.at | date: 'medium' }} · Received {{ payment.amountPaise / 100 | currency: 'INR' }} · {{ payment.paymentId }}</p>
                  }
                  @if (q.status === 'accepted' && m.releasedAt && !m.approvedAt) {
                    <p>Review this delivery against the agreed scope before approving payment.</p>
                    <label
                      >Changes needed<textarea
                        [(ngModel)]="feedback[i]"
                        maxlength="3000"
                      ></textarea>
                    </label>
                    <div class="actions">
                      <button [disabled]="busy()" (click)="review(i, true)">
                        Approve this delivery</button
                      ><button
                        class="secondary"
                        [disabled]="busy() || !feedback[i]"
                        (click)="review(i, false)"
                      >
                        Request changes
                      </button>
                    </div>
                  }
                  @if (q.status === 'accepted' && m.approvedAt && !m.paidAt) {
                    <button [disabled]="busy() || !q.paymentsEnabled" (click)="pay(i)">
                      {{
                        busy() ? 'Please wait…' : 'Pay ' + (payable(m) / 100 | currency: 'INR')
                      }}
                    </button>
                    @if (!q.paymentsEnabled) {
                      <p>Online payments are not enabled yet. Contact your provider.</p>
                    }
                  }
                </li>
              }
            </ol>
          </section>
          <section id="agreement-srs">
            <h2><span class="section-number">04</span> Requirements and attachments</h2>
            <p>
              Read these requirements together with the scope and agreement. These exact files
              belong to this revision.
            </p>
            @for (file of q.srs || []; track file.fileId) {
              <p class="attachment">
                <button class="secondary" [disabled]="busy()" (click)="downloadSrs(file)">
                  {{ file.name }} ({{ file.size / 1024 | number: '1.0-0' }} KB)
                </button>
              </p>
            } @empty {
              <p>No SRS files attached.</p>
            }
          </section>
          <section id="agreement-terms" class="general-terms">
            <h2><span class="section-number">05</span> General terms and conditions</h2>
            <p class="section-intro">
              Read these terms together with the scope, payment schedule and attached requirements.
              Download a copy for your records before accepting.
            </p>
            <app-agreement-text class="terms" [text]="q.terms" />
            <div class="actions">
              <button [disabled]="busy()" (click)="download('pdf')">Download PDF</button
              ><button [disabled]="busy()" (click)="download('docx')">Download Word</button
              ><button class="secondary" (click)="print()">Print</button>
            </div>
          </section>
          <section id="agreement-acceptance" class="acceptance-section">
            @if (isExample) {
              <p>
                <strong>Read-only example.</strong> A real invited client enters their name and
                email and confirms the scope, SRS, payment schedule and complete terms before
                accepting. Acceptance itself does not charge them.
              </p>
            }
            <h2><span class="section-number">06</span> Agreement acceptance</h2>
            @if (!isExample && q.status === 'invited') {
              <p>
                This link is private. Acceptance records your entered name and invited email; it is
                not a verified digital signature.
              </p>
              <label
                >Your full name<input autocomplete="name" [(ngModel)]="name" maxlength="120"
              /></label>
              <label
                >Invited email<input type="email" autocomplete="email" [(ngModel)]="email"
              /></label>
              @for (a of acknowledgements; track a.id) {
                <label class="check"
                  ><input type="checkbox" [(ngModel)]="a.checked" />{{ a.text }}</label
                >
              }
              <div class="actions">
              <button class="secondary" [disabled]="busy() || !canAccept()" (click)="accept()">
                Accept quotation and terms
              </button>
              <button [disabled]="busy() || !canAccept() || !q.paymentsEnabled" (click)="acceptAndPay()">
                Accept quotation and pay {{ payable(q.milestones[0]) / 100 | currency: 'INR' }}
              </button>
              </div>
              <p>Accept and pay records your agreement, then opens checkout for the onboarding payment (25% of the project). You confirm payment in checkout.</p>
              @if (!q.paymentsEnabled) { <p>Online payments are not enabled yet. You can still accept the quotation.</p> }
            }
            @if (q.acceptance; as a) {
              <h3>Accepted by the client</h3>
              <p>{{ a.name }} · {{ a.email }} · {{ a.at | date: 'medium' }}</p>
              <p class="fingerprint">Agreement fingerprint: {{ a.digest }}</p>
              <p>Accepted terms are frozen. Changes require a new quotation and acceptance.</p>
            } @else if (q.status !== 'invited') {
              <p>
                This revision has not been accepted. A preview or downloaded copy does not record
                agreement.
              </p>
            }
            @if (!isExample && q.status === 'accepted') {
              @for (m of q.milestones; track $index; let i = $index) {
                @if (m.approvedAt && !m.paidAt && (i === 0 || q.milestones[i - 1].paidAt)) {
                  <h3>{{ m.label }} payment</h3>
                  <p>Paid: {{ (m.paidPaise || 0) / 100 | currency: 'INR' }} · Milestone balance: {{ (m.remainingPaise ?? m.amountPaise) / 100 | currency: 'INR' }}</p>
                  <p>Pay now: {{ payable(m) / 100 | currency: 'INR' }}. Any remaining balance stays due; the next milestone opens after full payment.</p>
                  <button [disabled]="busy() || !q.paymentsEnabled" (click)="pay(i)">Pay {{ payable(m) / 100 | currency: 'INR' }}</button>
                }
              }
            }
          </section>
          @if (q.deployedAt) {
            <section>
              <h2>Your 30-day support window</h2>
              <p>
                Deployment: {{ q.deployedAt | date: 'medium' }}<br />Free support ends:
                {{ q.supportEndsAt | date: 'medium' }}
              </p>
              <p>Coverage follows the support clause in your accepted agreement.</p>
            </section>
          }
          <footer class="document-footer">
            <span
              >{{ isExample ? 'Sample quotation' : 'Private project agreement' }} · Revision
              {{ q.revision }}</span
            ><span>{{ q.clientName }}</span>
          </footer>
        </article>
        <button class="secondary refresh-status" [disabled]="busy()" (click)="load()">
          {{ isExample ? 'Reload sample quotation' : 'Refresh payment and project status' }}
        </button>
      }
    </main>
  `,
  styleUrl: './quotation.scss',
})
export class QuotationComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute, { optional: true });
  readonly isExample = this.route?.snapshot.data['example'] === true;
  private token = typeof location !== 'undefined' ? location.hash.slice(1) : '';
  quote = signal<Quotation | null>(null);
  busy = signal(false);
  error = signal('');
  name = '';
  email = '';
  feedback: Record<number, string> = {};
  private pendingPayment: any = null;
  acknowledgements = [
    {
      id: 'scope',
      text: 'I have read the scope, attached SRS documents, exclusions, timeline and delivery criteria.',
      checked: false,
    },
    {
      id: 'payments',
      text: 'I agree to the 25% / 25% / 40% / 10% payment schedule and total price.',
      checked: false,
    },
    {
      id: 'terms',
      text: 'I have read and accept the full terms, cancellation, refund and support clauses.',
      checked: false,
    },
    {
      id: 'authority',
      text: 'I am the invited client or authorised to accept for the client.',
      checked: false,
    },
  ];
  constructor() {
    if (this.isExample || this.token) void this.load();
  }
  private headers() {
    return new HttpHeaders({ 'x-quotation-token': this.token });
  }
  private async action(path: string, body: any) {
    if (this.isExample || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.quote.set(
        await firstValueFrom(
          this.http.post<Quotation>(`${quoteApi()}/quotations/${path}`, body, {
            headers: this.headers(),
          }),
        ),
      );
      return true;
    } catch (e: any) {
      this.error.set(e.error?.error || 'Could not save. Refresh and try again.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  async load() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.isExample) {
        const example = await firstValueFrom(
          this.http.get<Quotation>('/review/sample-quotation.json'),
        );
        this.quote.set({
          ...example,
          status: 'sample',
          paymentsEnabled: false,
          acceptance: undefined,
        });
      } else if (this.pendingPayment) {
        this.quote.set(
          await firstValueFrom(
            this.http.post<Quotation>(`${quoteApi()}/quotations/verify`, this.pendingPayment, {
              headers: this.headers(),
            }),
          ),
        );
        this.pendingPayment = null;
      } else
        this.quote.set(
          await firstValueFrom(
            this.http.get<Quotation>(`${quoteApi()}/quotations/current`, {
              headers: this.headers(),
            }),
          ),
        );
    } catch (e: any) {
      this.error.set(
        e.error?.error || 'Cannot open this quotation. Try again or ask for a new invitation.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  canAccept() {
    return (
      !this.isExample &&
      this.name.trim() &&
      this.email.trim().toLowerCase() === this.quote()?.clientEmail &&
      this.acknowledgements.every((a) => a.checked)
    );
  }
  payable(m: Milestone) { return m.payablePaise ?? m.amountPaise; }
  accept() {
    return this.action('accept', {
      name: this.name,
      email: this.email,
      digest: this.quote()?.digest,
      acknowledgements: this.acknowledgements.filter((a) => a.checked).map((a) => a.id),
    });
  }
  async acceptAndPay() {
    if (!this.canAccept()) return;
    if (await this.accept()) await this.pay(0);
  }
  review(index: number, approve: boolean) {
    void this.action(`review/${index}`, {
      approve,
      feedback: this.feedback[index],
      version: this.quote()?.__v,
    });
  }
  async download(format: 'pdf' | 'docx') {
    if (this.isExample) {
      await this.downloadFile('/review/sample-quotation.' + format, 'sample-quotation.' + format);
      return;
    }
    await this.downloadFile(
      `/export/${format}`,
      `quotation-revision-${this.quote()?.revision}.${format}`,
    );
  }
  async downloadSrs(file: { fileId: string; name: string }) {
    if (this.isExample) {
      await this.downloadFile('/review/sample-srs.pdf', 'sample-srs.pdf');
      return;
    }
    await this.downloadFile(`/srs/${file.fileId}`, file.name);
  }
  private async downloadFile(path: string, name: string) {
    this.busy.set(true);
    this.error.set('');
    try {
      await downloadQuotationFile(
        this.http,
        this.isExample ? path : `${quoteApi()}/quotations${path}`,
        this.isExample ? new HttpHeaders() : new HttpHeaders({ 'x-quotation-token': this.token }),
        name,
      );
    } catch (e: any) {
      this.error.set(e.error?.error || 'Download failed. Try again.');
    } finally {
      this.busy.set(false);
    }
  }
  print() {
    window.print();
  }
  goTo(id: string) {
    // The invitation lives in location.hash. Section navigation must never
    // replace it with an anchor, or refreshing would lose private access.
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  private async checkoutScript() {
    if (window.Razorpay) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error('Checkout timed out.'));
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(new Error('Checkout unavailable.'));
      };
      document.head.appendChild(script);
    });
  }
  async pay(index: number) {
    if (this.isExample || this.busy()) return;
    if (this.pendingPayment) {
      await this.load();
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.checkoutScript();
      const order = await firstValueFrom(
        this.http.post<any>(
          `${quoteApi()}/quotations/order/${index}`,
          {},
          { headers: this.headers() },
        ),
      );
      if (!window.Razorpay) throw new Error('Checkout could not load.');
      if (order.alreadyPaid) {
        this.quote.set(order.quotation);
        this.busy.set(false);
        return;
      }
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'Project payment',
        description: this.quote()!.milestones[index].label,
        prefill: { name: this.quote()!.clientName, email: this.quote()!.clientEmail },
        handler: async (result: any) => {
          this.pendingPayment = result;
          this.busy.set(false);
          await this.load();
        },
        modal: {
          ondismiss: () => {
            this.busy.set(false);
            void this.load();
          },
        },
      });
      checkout.open();
    } catch (e: any) {
      this.error.set(e.error?.error || e.message || 'Payment could not open.');
      this.busy.set(false);
    }
  }
}
