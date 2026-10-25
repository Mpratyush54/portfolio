import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DiscoveryBookComponent } from './discovery-book';

describe('Discovery checkout', () => {
  let component: DiscoveryBookComponent;
  let http: HttpTestingController;
  let options: any;
  let listeners: Record<string, () => void>;
  const order = { bookingId: 'booking', orderId: 'order', amountPaise: 29900, currency: 'INR', keyId: 'test', slotLabel: '6 PM', holdExpiresAt: '2099-01-01T00:00:00Z' };
  const response = { razorpay_order_id: 'order', razorpay_payment_id: 'payment', razorpay_signature: 'signature' };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    component = TestBed.runInInjectionContext(() => new DiscoveryBookComponent());
    http = TestBed.inject(HttpTestingController);
    options = null;
    listeners = {};
    window.Razorpay = class {
      constructor(value: any) { options = value; }
      open() {}
      on(event: string, callback: () => void) { listeners[event] = callback; }
    };
    component.cfg = {
      amountPaise: 29900, amountLabel: '₹299', currency: 'INR', title: 'Discovery', durationMin: 30,
      timezone: 'Asia/Kolkata', paymentsEnabled: true, razorpayKeyId: 'test', start: '2099-01-01', end: '2099-01-21',
      days: [{ date: '2099-01-01', label: 'Jan 1', slots: [{ slot: '18:00', label: '6 PM', available: true, amountPaise: 29900 }] }],
    };
    component.selectedDate = '2099-01-01'; component.selectedSlot = '18:00';
    component.name = 'Customer'; component.email = 'person@example.com';
    component.acceptTerms = true; component.step = 'checkout';
  });
  afterEach(() => { http.verify(); delete window.Razorpay; });
  const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
  async function openCheckout() {
    const pending = component.pay();
    await tick();
    const request = http.expectOne(req => req.url.endsWith('/bookings/create-order'));
    expect(request.request.body.amountPaise).toBe(29900);
    expect(request.request.body.acceptTerms).toBe(true);
    request.flush(order); await tick();
    return { pending };
  }

  it('retries verification without charging again after a network failure', async () => {
    const { pending } = await openCheckout();
    options.handler(response);
    http.expectOne(req => req.url.endsWith('/bookings/verify')).flush({ error: 'Try again' }, { status: 503, statusText: 'Unavailable' });
    await pending;
    expect(component.pendingVerification).toBeTruthy();
    const retry = component.pay();
    http.expectNone(req => req.url.endsWith('/bookings/create-order'));
    http.expectOne(req => req.url.endsWith('/bookings/verify')).flush({ success: true, status: 'paid' });
    await retry;
    expect(component.done).toBe(true);
  });
  it('ignores modal dismissal while payment verification is still running', async () => {
    const { pending } = await openCheckout();
    options.handler(response); options.modal.ondismiss();
    await tick();
    expect(component.paying).toBe(true);
    http.expectOne(req => req.url.endsWith('/bookings/verify')).flush({ success: true, status: 'paid' });
    await pending;
    expect(component.done).toBe(true);
  });
  it('reuses the reserved order after an unpaid checkout is dismissed', async () => {
    const { pending } = await openCheckout();
    options.modal.ondismiss(); await pending;
    const retry = component.pay(); await tick();
    http.expectNone(req => req.url.endsWith('/bookings/create-order'));
    options.modal.ondismiss(); await retry;
  });
  it('does not show success or charge again for a payment requiring review', async () => {
    const { pending } = await openCheckout();
    options.handler(response);
    http.expectOne(req => req.url.endsWith('/bookings/verify')).flush({ success: false, status: 'payment_review' });
    await pending;
    expect(component.done).toBe(false);
    expect(component.paymentNeedsReview).toBe(true);
    await component.pay();
    http.expectNone(req => req.url.endsWith('/bookings/create-order'));
  });
  it('prevents duplicate clicks from creating two orders', async () => {
    const first = component.pay(); const second = component.pay();
    await tick();
    http.expectOne(req => req.url.endsWith('/bookings/create-order')).flush(order);
    await tick(); options.modal.ondismiss();
    await Promise.all([first, second]);
  });
  it('keeps checkout busy when a failed payment can still be retried in the open modal', async () => {
    const { pending } = await openCheckout();
    listeners['payment.failed'](); await tick();
    expect(component.paying).toBe(true);
    expect(component.error).toContain('Payment failed');
    options.modal.ondismiss(); await pending;
    expect(component.paying).toBe(false);
  });
  it('rejects an invalid email before checkout', () => {
    component.step = 'details'; component.email = 'bad';
    component.continueToCheckout();
    expect(component.step).toBe('details');
    expect(component.error).toContain('valid email');
  });
});
