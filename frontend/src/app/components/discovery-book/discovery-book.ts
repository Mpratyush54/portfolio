import { Component, EventEmitter, OnInit, Output, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AnalyticsService } from '../../services/analytics.service';

type SlotInfo = {
  slot: string;
  label: string;
  available: boolean;
  amountPaise?: number;
  amountLabel?: string;
  demand?: string;
};

type SlotDay = {
  date: string;
  label: string;
  slots: SlotInfo[];
  amountPaise?: number;
  amountLabel?: string;
  demand?: string;
};

type SpotsPayload = {
  amountPaise: number;
  amountLabel: string;
  baseLabel?: string;
  minLabel?: string;
  maxLabel?: string;
  minPaise?: number;
  maxPaise?: number;
  currency: string;
  title: string;
  durationMin: number;
  timezone: string;
  paymentsEnabled: boolean;
  razorpayKeyId: string;
  bookingEmail?: string;
  pricingNote?: string;
  start: string;
  end: string;
  days: SlotDay[];
};

type PaymentVerification = {
  bookingId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type CheckoutOrder = {
  bookingId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  slotLabel: string;
  holdExpiresAt: string;
};

type CalCell = {
  date: string | null;
  dayNum: number;
  inMonth: boolean;
  bookable: boolean;
  selected: boolean;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: any) => void) => void;
    };
  }
}

@Component({
  selector: 'app-discovery-book',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './discovery-book.html',
  styleUrl: './discovery-book.scss',
})
export class DiscoveryBookComponent implements OnInit {
  private analytics = inject(AnalyticsService);
  @Output() booked = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private apiUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000/api'
      : '/api';

  loading = true;
  error = '';
  cfg: SpotsPayload | null = null;
  step: 'time' | 'details' | 'checkout' = 'time';
  selectedDate = '';
  selectedSlot = '';
  viewYear = 0;
  viewMonth = 0;
  name = '';
  email = '';
  phone = '';
  note = '';
  website = false;
  acceptTerms = false;
  paying = false;
  done = false;
  paymentNeedsReview = false;
  pendingVerification: PaymentVerification | null = null;
  private checkoutOrder: CheckoutOrder | null = null;
  private orderDetails = '';
  private razorpayLoading: Promise<void> | null = null;

  readonly weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  ngOnInit(): void {
    void this.analytics.track('booking_step_viewed', 'time');
    this.loadSlots();
  }

  get day(): SlotDay | null {
    return this.cfg?.days.find((d) => d.date === this.selectedDate) || null;
  }

  get selectedSlotInfo(): SlotInfo | null {
    return this.day?.slots.find((s) => s.slot === this.selectedSlot) || null;
  }

  get priceLabel(): string {
    return (
      this.selectedSlotInfo?.amountLabel || this.day?.amountLabel || this.cfg?.amountLabel || ''
    );
  }

  get demandLabel(): string {
    return this.selectedSlotInfo?.demand || this.day?.demand || 'Standard';
  }

  get bookingEmail(): string {
    return this.cfg?.bookingEmail || 'developer@pratyushes.dev';
  }

  get paymentsReady(): boolean {
    return Boolean(this.cfg?.paymentsEnabled && this.cfg?.razorpayKeyId);
  }

  get title(): string {
    if (this.done) return 'Talk soon.';
    if (!this.loading && this.cfg && !this.paymentsReady) return 'No slots available';
    if (this.step === 'checkout') return 'Checkout';
    if (this.step === 'details') return 'A few details';
    return 'Pick a time';
  }

  get stepNum(): string {
    if (this.cfg && !this.paymentsReady) return '—';
    if (this.step === 'time') return '1';
    if (this.step === 'details') return '2';
    return '3';
  }

  get selectedSummary(): string {
    if (!this.selectedDate || !this.selectedSlot) return '';
    const day = this.day?.label || this.selectedDate;
    const slot = this.selectedSlotInfo?.label || this.selectedSlot;
    return `${day} · ${slot}`;
  }

  get monthLabel(): string {
    const dt = new Date(Date.UTC(this.viewYear, this.viewMonth, 1, 12));
    return dt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  get calendarCells(): CalCell[] {
    const firstDow = new Date(Date.UTC(this.viewYear, this.viewMonth, 1, 12)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(this.viewYear, this.viewMonth + 1, 0, 12)).getUTCDate();
    const byDate = new Map((this.cfg?.days || []).map((d) => [d.date, d]));
    const cells: CalCell[] = [];

    for (let i = 0; i < firstDow; i++) {
      cells.push({ date: null, dayNum: 0, inMonth: false, bookable: false, selected: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${this.viewYear}-${String(this.viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const info = byDate.get(ymd);
      const bookable = this.paymentsReady && Boolean(info && info.slots.some((s) => s.available));
      cells.push({
        date: ymd,
        dayNum: d,
        inMonth: true,
        bookable,
        selected: this.paymentsReady && ymd === this.selectedDate,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, dayNum: 0, inMonth: false, bookable: false, selected: false });
    }
    return cells;
  }

  get canPrevMonth(): boolean {
    if (!this.cfg?.start) return false;
    const [y, m] = this.cfg.start.split('-').map(Number);
    return this.viewYear > y || (this.viewYear === y && this.viewMonth + 1 > m);
  }

  get canNextMonth(): boolean {
    if (!this.cfg?.end) return false;
    const [y, m] = this.cfg.end.split('-').map(Number);
    return this.viewYear < y || (this.viewYear === y && this.viewMonth + 1 < m);
  }

  prevMonth(): void {
    if (!this.canPrevMonth) return;
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear -= 1;
    } else {
      this.viewMonth -= 1;
    }
  }

  nextMonth(): void {
    if (!this.canNextMonth) return;
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear += 1;
    } else {
      this.viewMonth += 1;
    }
  }

  pickDate(cell: CalCell): void {
    if (!this.paymentsReady || !cell.bookable || !cell.date) return;
    this.selectedDate = cell.date;
    const day = this.cfg?.days.find((d) => d.date === cell.date);
    const open = day?.slots.find((s) => s.available);
    this.selectedSlot = open?.slot || '';
    this.error = '';
  }

  pickSlot(slot: string): void {
    if (!this.paymentsReady || !this.day?.slots.some((s) => s.slot === slot && s.available)) return;
    this.selectedSlot = slot;
    this.error = '';
  }

  onBack(): void {
    if (this.paying || this.pendingVerification) return;
    this.error = '';
    if (this.done) {
      this.back.emit();
      return;
    }
    if (this.step === 'checkout') {
      this.step = 'details';
      this.acceptTerms = false;
      return;
    }
    if (this.step === 'details') {
      this.step = 'time';
      return;
    }
    this.back.emit();
  }

  continueToDetails(): void {
    this.error = '';
    if (!this.paymentsReady) return;
    if (!this.selectedDate || !this.selectedSlotInfo?.available) {
      this.error = 'Pick a day and a time.';
      return;
    }
    this.step = 'details';
    void this.analytics.track('booking_step_viewed', 'details');
  }

  continueToCheckout(): void {
    this.error = '';
    if (!this.name.trim() || !this.email.trim()) {
      this.error = 'Name and email are required.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) {
      this.error = 'Enter a valid email address.';
      return;
    }
    this.acceptTerms = false;
    this.step = 'checkout';
    void this.analytics.track('booking_step_viewed', 'checkout');
    // Keep checkout in view on short screens
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  loadSlots(): void {
    this.loading = true;
    this.error = '';
    this.http.get<SpotsPayload>(`${this.apiUrl}/bookings/slots`).subscribe({
      next: (cfg) => {
        this.cfg = cfg;
        if (this.selectedDate && !this.selectedSlotInfo?.available && !this.pendingVerification) {
          this.selectedSlot = '';
          this.step = 'time';
        }
        if (cfg.start) {
          const [y, m] = cfg.start.split('-').map(Number);
          this.viewYear = y;
          this.viewMonth = m - 1;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load times. Try again shortly.';
        this.cdr.markForCheck();
      },
    });
  }

  async pay(): Promise<void> {
    if (this.paying || this.paymentNeedsReview || this.done) return;
    this.error = '';
    this.paying = true;
    try {
      // Retry a completed payment's confirmation without creating another order.
      if (this.pendingVerification) {
        await this.confirmPayment();
        return;
      }
      if (!this.acceptTerms) throw new Error('Please accept the terms to continue.');
      if (!this.name.trim() || !this.email.trim() || !this.selectedSlotInfo?.available) {
        throw new Error('Choose an available time and enter your name and email.');
      }
      if (!this.paymentsReady) throw new Error('Online booking is unavailable. Please email me.');
      await this.ensureRazorpay();
      const details = {
        name: this.name.trim(),
        email: this.email.trim(),
        phone: this.phone.trim(),
        note: this.note.trim(),
        date: this.selectedDate,
        slot: this.selectedSlot,
        website: this.website,
        acceptTerms: this.acceptTerms,
        amountPaise:
          this.selectedSlotInfo?.amountPaise ?? this.day?.amountPaise ?? this.cfg?.amountPaise,
      };
      const fingerprint = JSON.stringify(details);
      if (
        !this.checkoutOrder ||
        this.orderDetails !== fingerprint ||
        new Date(this.checkoutOrder.holdExpiresAt).getTime() <= Date.now()
      ) {
        this.checkoutOrder = await firstValueFrom(
          this.http.post<CheckoutOrder>(this.apiUrl + '/bookings/create-order', details),
        );
        this.orderDetails = fingerprint;
      }
      const order = this.checkoutOrder;
      await new Promise<void>((resolve, reject) => {
        let verifying = false;
        const rzp = new window.Razorpay!({
          key: order.keyId,
          amount: order.amountPaise,
          currency: order.currency,
          name: 'Pratyush Mishra',
          description: 'Technical consultation · ' + this.selectedSummary,
          order_id: order.orderId,
          prefill: { name: this.name.trim(), email: this.email.trim(), contact: this.phone.trim() },
          theme: { color: '#1a1a24' },
          handler: (response: Omit<PaymentVerification, 'bookingId'>) => {
            if (verifying) return;
            verifying = true;
            this.pendingVerification = { bookingId: order.bookingId, ...response };
            this.confirmPayment().then(resolve, reject);
          },
          modal: {
            ondismiss: () => {
              if (!verifying) resolve();
            },
          },
        });
        rzp.on('payment.failed', () => {
          if (!verifying)
            this.error = 'Payment failed. Retry in the payment window, or close it to try again.';
        });
        rzp.open();
        void this.analytics.track('booking_checkout_opened');
      });
    } catch (e: any) {
      if (e?.status === 409 && !this.pendingVerification) {
        this.checkoutOrder = null;
        this.selectedSlot = '';
        this.step = 'time';
        this.loadSlots();
      }
      this.error = e?.error?.error || e?.message || 'Could not start payment.';
    } finally {
      this.paying = false;
    }
  }

  private async confirmPayment(): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<{ success: boolean; status: string }>(
        this.apiUrl + '/bookings/verify',
        this.pendingVerification,
      ),
    );
    if (result.status === 'payment_review') {
      this.paymentNeedsReview = true;
      void this.analytics.track('booking_payment_review');
      this.error =
        'Payment received, but the time could not be confirmed. Please email ' +
        this.bookingEmail +
        ' to arrange another slot or a refund.';
      return;
    }
    if (!result.success || result.status !== 'paid')
      throw new Error('Payment confirmation is still pending. Please retry confirmation.');
    this.pendingVerification = null;
    this.done = true;
    void this.analytics.track('booking_confirmed');
    this.booked.emit();
  }

  private ensureRazorpay(): Promise<void> {
    if (window.Razorpay) return Promise.resolve();
    if (this.razorpayLoading) return this.razorpayLoading;
    this.razorpayLoading = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      const fail = () => {
        s.remove();
        reject(new Error('Failed to load Razorpay'));
      };
      s.onload = () => (window.Razorpay ? resolve() : fail());
      s.onerror = fail;
      document.body.appendChild(s);
    }).finally(() => {
      this.razorpayLoading = null;
    });
    return this.razorpayLoading;
  }
}
