import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DiscoveryBookComponent } from './discovery-book';
import { AnalyticsService } from '../../services/analytics.service';

describe('Discovery checkout', () => {
  let component: DiscoveryBookComponent;
  let http: HttpTestingController;
  let options: any;
  let listeners: Record<string, () => void>;
  const order = {
    bookingId: 'booking',
    orderId: 'order',
    amountPaise: 29900,
    currency: 'INR',
    keyId: 'test',
    slotLabel: '6 PM',
    holdExpiresAt: '2099-01-01T00:00:00Z',
  };
  const response = {
    razorpay_order_id: 'order',
    razorpay_payment_id: 'payment',
    razorpay_signature: 'signature',
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ChangeDetectorRef, useValue: { markForCheck() {} } },
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AnalyticsService, useValue: { track: () => Promise.resolve() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new DiscoveryBookComponent());
    http = TestBed.inject(HttpTestingController);
    options = null;
    listeners = {};
    window.Razorpay = class {
      constructor(value: any) {
        options = value;
      }
      open() {}
      on(event: string, callback: (response: any) => void) {
        listeners[event] = () => callback({});
      }
    };
    component.cfg = {
      amountPaise: 29900,
      amountLabel: '₹299',
      currency: 'INR',
      title: 'Discovery',
      durationMin: 30,
      timezone: 'Asia/Kolkata',
      paymentsEnabled: true,
      razorpayKeyId: 'test',
      start: '2099-01-01',
      end: '2099-01-21',
      days: [
        {
          date: '2099-01-01',
          label: 'Jan 1',
          slots: [{ slot: '18:00', label: '6 PM', available: true, amountPaise: 29900 }],
        },
      ],
    };
    component.selectedDate = '2099-01-01';
    component.selectedSlot = '18:00';
    component.name = 'Customer';
    component.email = 'person@example.com';
    component.acceptTerms = true;
    component.step = 'checkout';
  });
  afterEach(() => {
    http.verify();
    delete window.Razorpay;
  });
  const tick = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  async function openCheckout() {
    const pending = component.pay();
    await tick();
    const request = http.expectOne((req) => req.url.endsWith('/bookings/create-order'));
    expect(request.request.body.amountPaise).toBe(29900);
    expect(request.request.body.acceptTerms).toBe(true);
    request.flush(order);
    await tick();
    return { pending };
  }

  it('shows an unavailable calendar and blocks selection while online checkout is disabled', async () => {
    const fixture = TestBed.createComponent(DiscoveryBookComponent);
    fixture.detectChanges();
    http
      .expectOne((req) => req.url.endsWith('/bookings/slots'))
      .flush({ ...component.cfg, paymentsEnabled: false, razorpayKeyId: '' });
    await fixture.whenStable();
    fixture.detectChanges();
    const closed = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('No slots available');
    expect(fixture.nativeElement.textContent).not.toContain('Service information');
    const days = Array.from(
      fixture.nativeElement.querySelectorAll('[role="gridcell"]'),
    ) as HTMLButtonElement[];
    expect(days.length).toBeGreaterThan(0);
    expect(days.every((day) => day.disabled)).toBe(true);
    closed.pickDate({
      date: '2099-01-01',
      dayNum: 1,
      inMonth: true,
      bookable: true,
      selected: false,
    });
    closed.continueToDetails();
    expect(closed.selectedDate).toBe('');
    expect(closed.step).toBe('time');
    expect(fixture.nativeElement.querySelector('button.pay')).toBeNull();
  });
  it('keeps the hidden spam field out of normal autofill and keyboard input', async () => {
    const fixture = TestBed.createComponent(DiscoveryBookComponent);
    fixture.detectChanges();
    http.expectOne((req) => req.url.endsWith('/bookings/slots')).flush(component.cfg);
    await fixture.whenStable();
    const form = fixture.componentInstance;
    form.step = 'details';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const trap = fixture.nativeElement.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap.readOnly).toBe(true);
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest('[inert][aria-hidden="true"]')).not.toBeNull();
    expect(form.website).toBe('');
    expect(fixture.nativeElement.querySelector('input[name="name"]').readOnly).toBe(false);
    expect(fixture.nativeElement.querySelector('input[name="email"]').autocomplete).toBe('email');
  });
  it('retries verification without charging again after a network failure', async () => {
    const { pending } = await openCheckout();
    options.handler(response);
    http
      .expectOne((req) => req.url.endsWith('/bookings/verify'))
      .flush({ error: 'Try again' }, { status: 503, statusText: 'Unavailable' });
    await pending;
    expect(component.pendingVerification).toBeTruthy();
    const retry = component.pay();
    http.expectNone((req) => req.url.endsWith('/bookings/create-order'));
    http
      .expectOne((req) => req.url.endsWith('/bookings/verify'))
      .flush({ success: true, status: 'paid' });
    await retry;
    expect(component.done).toBe(true);
  });
  it('ignores modal dismissal while payment verification is still running', async () => {
    const { pending } = await openCheckout();
    options.handler(response);
    options.modal.ondismiss();
    await tick();
    expect(component.paying).toBe(true);
    http
      .expectOne((req) => req.url.endsWith('/bookings/verify'))
      .flush({ success: true, status: 'paid' });
    await pending;
    expect(component.done).toBe(true);
  });
  it('reuses the reserved order after an unpaid checkout is dismissed', async () => {
    const { pending } = await openCheckout();
    options.modal.ondismiss();
    await pending;
    const retry = component.pay();
    await tick();
    http.expectNone((req) => req.url.endsWith('/bookings/create-order'));
    options.modal.ondismiss();
    await retry;
  });
  it('does not show success or charge again for a payment requiring review', async () => {
    const { pending } = await openCheckout();
    options.handler(response);
    http
      .expectOne((req) => req.url.endsWith('/bookings/verify'))
      .flush({ success: false, status: 'payment_review' });
    await pending;
    expect(component.done).toBe(false);
    expect(component.paymentNeedsReview).toBe(true);
    await component.pay();
    http.expectNone((req) => req.url.endsWith('/bookings/create-order'));
  });
  it('prevents duplicate clicks from creating two orders', async () => {
    const first = component.pay();
    const second = component.pay();
    await tick();
    http.expectOne((req) => req.url.endsWith('/bookings/create-order')).flush(order);
    await tick();
    options.modal.ondismiss();
    await Promise.all([first, second]);
  });
  it('keeps checkout busy when a failed payment can still be retried in the open modal', async () => {
    const { pending } = await openCheckout();
    listeners['payment.failed']();
    await tick();
    expect(component.paying).toBe(true);
    expect(component.error).toContain('Payment failed');
    options.modal.ondismiss();
    await pending;
    expect(component.paying).toBe(false);
  });
  it('rejects an invalid email before checkout', () => {
    component.step = 'details';
    component.email = 'bad';
    component.continueToCheckout();
    expect(component.step).toBe('details');
    expect(component.error).toContain('valid email');
  });
});
