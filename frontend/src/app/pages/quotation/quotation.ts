import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

export const quoteApi = () =>
  location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
export type Milestone = {
  label: string;
  percent: number;
  amountPaise: number;
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
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="quote-page">
      <nav><a routerLink="/">Pratyush Mishra</a><a routerLink="/book">Book a call</a></nav>
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
        <header>
          <p>Private quotation · revision {{ q.revision }} · {{ q.status }}</p>
          <h1>{{ q.title }}</h1>
          <p>Prepared for {{ q.clientName }} · {{ q.clientEmail }}</p>
          <strong>{{ q.totalPaise / 100 | currency: 'INR' }}</strong>
          <p>Quotation valid until {{ q.validUntil | date: 'mediumDate' }}</p>
        </header>
        <section>
          <h2>Your provider</h2>
          <p class="preserve">{{ q.seller }}</p>
        </section>
        <section>
          <h2>What we will build</h2>
          <p class="preserve">{{ q.scope }}</p>
          <h3>Not included</h3>
          <p class="preserve">{{ q.exclusions }}</p>
          <h3>Timeline and dependencies</h3>
          <p class="preserve">{{ q.timeline }}</p>
        </section>
        <section>
          <h2>Four clear payments</h2>
          <p>
            25% before onboarding · 50% paid at MVP · 90% paid when development is complete · 100%
            after deployment.
          </p>
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
                @if (q.status === 'accepted' && m.releasedAt && !m.approvedAt) {
                  <p>Review this delivery against the agreed scope before approving payment.</p>
                  <label
                    >Changes needed<textarea [(ngModel)]="feedback[i]" maxlength="3000"></textarea>
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
                    {{ busy() ? 'Please wait…' : 'Pay ' + (m.amountPaise / 100 | currency: 'INR') }}
                  </button>
                  @if (!q.paymentsEnabled) {
                    <p>Online payments are not enabled yet. Contact your provider.</p>
                  }
                }
              </li>
            }
          </ol>
        </section>
        <section>
          <h2>Terms and conditions</h2>
          <p>Read the complete agreement below. Save a copy using Print before accepting.</p>
          <p class="preserve terms">{{ q.terms }}</p>
          <button class="secondary" (click)="print()">Print / save as PDF</button>
        </section>
        @if (q.status === 'invited') {
          <section>
            <h2>Review and accept</h2>
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
            <button [disabled]="busy() || !canAccept()" (click)="accept()">
              Accept quotation and terms
            </button>
            <p>Accepting does not charge you. The first 25% payment opens separately.</p>
          </section>
        }
        @if (q.acceptance; as a) {
          <section>
            <h2>Agreement accepted</h2>
            <p>{{ a.name }} · {{ a.email }} · {{ a.at | date: 'medium' }}</p>
            <p class="fingerprint">Agreement fingerprint: {{ a.digest }}</p>
            <p>Accepted terms are frozen. Changes require a new quotation and acceptance.</p>
          </section>
        }
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
        <button class="secondary" [disabled]="busy()" (click)="load()">
          Refresh payment and project status
        </button>
      }
    </main>
  `,
  styleUrl: './quotation.scss',
})
export class QuotationComponent {
  private http = inject(HttpClient);
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
      text: 'I have read the scope, exclusions, timeline and delivery criteria.',
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
    if (this.token) void this.load();
  }
  private headers() {
    return new HttpHeaders({ 'x-quotation-token': this.token });
  }
  private async action(path: string, body: any) {
    if (this.busy()) return;
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
    } catch (e: any) {
      this.error.set(e.error?.error || 'Could not save. Refresh and try again.');
    } finally {
      this.busy.set(false);
    }
  }
  async load() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.pendingPayment) {
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
      this.name.trim() &&
      this.email.trim().toLowerCase() === this.quote()?.clientEmail &&
      this.acknowledgements.every((a) => a.checked)
    );
  }
  accept() {
    void this.action('accept', {
      name: this.name,
      email: this.email,
      digest: this.quote()?.digest,
      acknowledgements: this.acknowledgements.filter((a) => a.checked).map((a) => a.id),
    });
  }
  review(index: number, approve: boolean) {
    void this.action(`review/${index}`, {
      approve,
      feedback: this.feedback[index],
      version: this.quote()?.__v,
    });
  }
  print() {
    window.print();
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
    if (this.busy()) return;
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
