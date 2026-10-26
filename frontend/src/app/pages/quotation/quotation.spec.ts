import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { QuotationComponent, Quotation } from './quotation';
import { agreementBlocks } from './agreement-text';

describe('Quotation acceptance and payment recovery', () => {
  let component: QuotationComponent, http: HttpTestingController;
  const q = {
    _id: 'quote',
    __v: 4,
    status: 'invited',
    clientName: 'Client',
    clientEmail: 'client@example.com',
    digest: 'frozen-terms',
    milestones: [
      { label: 'Onboarding', amountPaise: 25000, percent: 25, approvedAt: '2026-01-01' },
    ],
    paymentsEnabled: true,
  } as Quotation;
  beforeEach(() => {
    history.replaceState(null, '', '/proposal');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    component = TestBed.runInInjectionContext(() => new QuotationComponent());
    http = TestBed.inject(HttpTestingController);
    component.quote.set(structuredClone(q));
  });
  afterEach(() => {
    http.verify();
    delete window.Razorpay;
    history.replaceState(null, '', '/');
  });
  it('requires each explicit acknowledgement and the invited email', () => {
    component.name = 'Client';
    component.email = q.clientEmail;
    expect(component.canAccept()).toBeFalsy();
    component.acknowledgements.forEach((a) => (a.checked = true));
    expect(component.canAccept()).toBeTruthy();
    component.email = 'wrong@example.com';
    expect(component.canAccept()).toBeFalsy();
  });
  it('formats numbered clauses and retains custom paragraphs as literal text', () => {
    const blocks = agreementBlocks(
      '1. Scope\nAgreed work.\n\nA second paragraph <script> is text.\n\n2. Support\n30 days.',
    );
    expect(blocks.map((b) => b.title)).toEqual(['1. Scope', '', '2. Support']);
    expect(blocks.map((b) => b.text).join('\n')).toContain('A second paragraph <script> is text.');
  });
  it('keeps the private invitation hash when navigating the agreement', () => {
    history.replaceState(null, '', '/proposal#private-invitation');
    component.goTo('agreement-terms');
    expect(location.hash).toBe('#private-invitation');
  });
  it('submits the immutable terms digest and leaves payment separate', async () => {
    component.name = 'Client';
    component.email = q.clientEmail;
    component.acknowledgements.forEach((a) => (a.checked = true));
    component.accept();
    const req = http.expectOne((r) => r.url.endsWith('/quotations/accept'));
    expect(req.request.body.digest).toBe('frozen-terms');
    expect(req.request.body.acknowledgements).toEqual(['scope', 'payments', 'terms', 'authority']);
    req.flush({ ...q, status: 'accepted' });
    await Promise.resolve();
    expect(component.quote()?.status).toBe('accepted');
    http.expectNone((r) => r.url.includes('/order/'));
  });
  it('ties delivery approval to the version the client actually reviewed', async () => {
    component.review(1, true);
    const request = http.expectOne((r) => r.url.endsWith('/quotations/review/1'));
    expect(request.request.body.version).toBe(4);
    request.flush({ error: 'Delivery details changed.' }, { status: 409, statusText: 'Conflict' });
    await Promise.resolve();
    await Promise.resolve();
    expect(component.error()).toContain('Delivery details changed');
  });
  it('retries captured-payment verification instead of opening another charge', async () => {
    let options: any,
      opened = 0;
    window.Razorpay = class {
      constructor(value: any) {
        options = value;
      }
      open() {
        opened++;
      }
      on() {}
    };
    const opening = component.pay(0);
    await Promise.resolve();
    http
      .expectOne((r) => r.url.endsWith('/quotations/order/0'))
      .flush({ orderId: 'order', keyId: 'test', amountPaise: 25000, currency: 'INR' });
    await opening;
    const confirming = options.handler({
      razorpay_order_id: 'order',
      razorpay_payment_id: 'pay',
      razorpay_signature: 'sig',
    });
    http
      .expectOne((r) => r.url.endsWith('/quotations/verify'))
      .flush({ error: 'Temporary outage' }, { status: 503, statusText: 'Unavailable' });
    await confirming;
    const retry = component.pay(0);
    http
      .expectOne((r) => r.url.endsWith('/quotations/verify'))
      .flush({
        ...q,
        status: 'accepted',
        milestones: [{ ...q.milestones[0], paidAt: '2026-01-01' }],
      });
    await retry;
    expect(opened).toBe(1);
    expect(component.quote()?.milestones[0].paidAt).toBeTruthy();
  });
});
