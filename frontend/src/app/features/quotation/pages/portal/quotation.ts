import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AgreementTextComponent } from '../../components/agreement-text/agreement-text';
import { QuotationService } from '../../data/quotation.service';
import {
  Milestone,
  Quotation,
  quotationRef
} from '../../models/quotation.model';
import { apiBase } from '../../../../core/api/api-base';
import { AnalyticsService } from '../../../../core/analytics/analytics.service';

export type { Milestone, Quotation } from '../../models/quotation.model';
export { quotationRef } from '../../models/quotation.model';
export const quoteApi = () => apiBase();

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AgreementTextComponent],
  templateUrl: './quotation.html',
  styleUrl: './quotation.scss'
})
export class QuotationComponent {
  private quotes = inject(QuotationService);
  private analytics = inject(AnalyticsService);
  private route = inject(ActivatedRoute, { optional: true });
  readonly isExample = this.route?.snapshot.data['example'] === true;
  private token = typeof location !== 'undefined' ? location.hash.slice(1) : '';
  readonly reference = quotationRef;
  quote = signal<Quotation | null>(null);
  busy = signal(false);
  error = signal('');
  name = '';
  email = '';
  feedback: Record<number, string> = {};
  private pendingPayment: any = null;
  private viewedTracked = false;
  acknowledgements = [
    {
      id: 'scope',
      text: 'I have read the scope, attached SRS documents, exclusions, timeline and delivery criteria.',
      checked: false
},
    {
      id: 'payments',
      text: 'I agree to the phase percentages, payment timing and total price shown in this quotation.',
      checked: false
},
    {
      id: 'terms',
      text: 'I have read and accept the full terms, cancellation, refund and support clauses.',
      checked: false
},
    {
      id: 'authority',
      text: 'I am the invited client or authorised to accept for the client.',
      checked: false
},
  ];
  constructor() {
    if (this.isExample || this.token) {
      setTimeout(() => void this.analytics.track('quotation_opened'));
      void this.load();
    }
  }
  private async action(path: string, body: any) {
    if (this.isExample || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.quote.set(await firstValueFrom(this.quotes.action(this.token, path, body)));
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
    const verifyingPayment = Boolean(this.pendingPayment);
    const correlationId = this.pendingPayment?.correlationId;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.isExample) {
        const example = await firstValueFrom(this.quotes.getSample());
        this.quote.set({
          ...example,
          status: 'sample',
          paymentsEnabled: false,
          acceptance: undefined
});
      } else if (this.pendingPayment) {
        this.quote.set(
          await firstValueFrom(this.quotes.verifyPayment(this.token, this.pendingPayment)),
        );
        this.pendingPayment = null;
      } else this.quote.set(await firstValueFrom(this.quotes.getCurrent(this.token)));
      if (!this.viewedTracked) {
        this.viewedTracked = true;
        void this.analytics.track('quotation_viewed');
      }
      if (verifyingPayment)
        void this.analytics.track('quotation_payment_confirmed', {
          correlation_id: correlationId,
          payment_kind: 'quotation',
          result: 'confirmed',
        });
    } catch (e: any) {
      if (verifyingPayment)
        void this.analytics.track('quotation_payment_failed', {
          correlation_id: correlationId,
          payment_kind: 'quotation',
          result: 'failed',
        });
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
    const request = this.action('accept', {
      name: this.name,
      email: this.email,
      digest: this.quote()?.digest,
      acknowledgements: this.acknowledgements.filter((a) => a.checked).map((a) => a.id)
});
    void request.then((accepted) => {
      if (accepted) void this.analytics.track('quotation_accepted');
    });
    return request;
  }
  async acceptAndPay() {
    if (!this.canAccept()) return;
    if (await this.accept()) await this.pay(0);
  }
  review(index: number, approve: boolean) {
    const request = this.action(`review/${index}`, {
      approve,
      feedback: this.feedback[index],
      version: this.quote()?.__v
});
    void request.then((reviewed) => {
      if (reviewed)
        void this.analytics.track('quotation_milestone_reviewed', {
          milestone_index: index,
          approved: approve,
        });
    });
    return request;
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
      await this.quotes.download(this.token, path, name, this.isExample);
      void this.analytics.track('quotation_downloaded');
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
    const correlationId = crypto.randomUUID();
    try {
      await this.checkoutScript();
      const order = await firstValueFrom(
        this.quotes.createOrder(this.token, index, correlationId),
      );
      if (!window.Razorpay) throw new Error('Checkout could not load.');
      if (order.alreadyPaid) {
        this.quote.set(order.quotation);
        void this.analytics.track('quotation_payment_confirmed', {
          milestone_index: index,
          correlation_id: correlationId,
          payment_kind: 'quotation',
          result: 'confirmed',
        });
        this.busy.set(false);
        return;
      }
      void this.analytics.track('quotation_payment_checkout_opened', {
        milestone_index: index,
        correlation_id: correlationId,
        payment_kind: 'quotation',
        result: 'opened',
      });
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'Project payment',
        description: this.quote()!.milestones[index].label,
        prefill: {
          name: this.quote()!.acceptance?.name || this.quote()!.clientName,
          email: this.quote()!.acceptance?.email || this.quote()!.clientEmail
},
        remember_customer: false,
        handler: async (result: any) => {
          this.pendingPayment = { ...result, correlationId };
          this.busy.set(false);
          await this.load();
        },
        modal: {
          ondismiss: () => {
            void this.analytics.track('quotation_payment_dismissed', {
              milestone_index: index,
              correlation_id: correlationId,
              payment_kind: 'quotation',
              result: 'dismissed',
            });
            this.busy.set(false);
            void this.load();
          }
}
});
      checkout.open();
    } catch (e: any) {
      void this.analytics.track('quotation_payment_failed', {
        milestone_index: index,
        correlation_id: correlationId,
        payment_kind: 'quotation',
        result: 'failed',
      });
      this.error.set(e.error?.error || e.message || 'Payment could not open.');
      this.busy.set(false);
    }
  }
}
