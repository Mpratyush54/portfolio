import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { AnalyticsConsentService } from './analytics-consent.service';
import { ANALYTICS_LOADER, AnalyticsService, analyticsPath } from './analytics.service';
@Component({ template: '' })
class RouteStub {}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
describe('PostHog public analytics boundary', () => {
  let service: AnalyticsService,
    http: HttpTestingController,
    router: Router,
    config: any,
    captures: any[],
    loads: number;
  beforeEach(() => {
    localStorage.setItem('portfolio-analytics-consent', 'granted');
    config = null;
    captures = [];
    loads = 0;
    const client = {
      init: (_token: string, cfg: any) => {
        config = cfg;
      },
      startSessionRecording: () => {},
      stopSessionRecording: () => {},
      capture: (name: string, props: any = {}) => {
        const event = config.before_send({
          uuid: 'event-id',
          event: name,
          properties: {
            token: 'phc_test_public_key',
            distinct_id: 'anonymous-id',
            $browser: 'Chrome',
            $current_url: 'https://site.test/?email=private@example.com#invite-secret',
            $initial_current_url: 'private-data',
            $referrer: 'private-data',
            name: 'Private Customer',
            note: 'private-data',
            razorpay_payment_id: 'private-data',
            ...props,
          },
          $set_once: { $initial_current_url: 'private-data' },
        });
        if (event) captures.push(event);
      },
      captureException: (error: Error, props: any = {}) => {
        const event = config.before_send({
          uuid: 'exception-id',
          event: '$exception',
          properties: {
            token: 'phc_test_public_key',
            $exception_list: [
              {
                type: error.name,
                value: error.message,
                stacktrace: {
                  frames: [
                    {
                      filename:
                        'https://site.test/main.js?token=invite-secret',
                      function: 'submit',
                      lineno: 42,
                    },
                  ],
                },
              },
            ],
            ...props,
          },
        });
        if (event) captures.push(event);
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: RouteStub }]),
        {
          provide: ANALYTICS_LOADER,
          useValue: async () => {
            loads++;
            return client;
          },
        },
      ],
    });
    service = TestBed.inject(AnalyticsService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });
  afterEach(() => {
    http.verify();
    localStorage.removeItem('portfolio-analytics-consent');
  });
  async function enable(path = '/book?email=private@example.com#invite-secret') {
    service.start();
    await router.navigateByUrl(path);
    http
      .expectOne('/runtime/analytics.json')
      .flush({
        enabled: true,
        projectToken: 'phc_test_public_key',
        apiHost: 'https://v.pratyushes.dev',
        uiHost: 'https://us.posthog.com',
        environment: 'production',
      });
    await settle();
  }
  it('does not load PostHog or request config on admin pages', async () => {
    service.start();
    for (const path of ['/admin', '/admin/quotations/private-id']) {
      await router.navigateByUrl(path);
      await service.track('contact_submitted');
    }
    http.expectNone('/runtime/analytics.json');
    expect(loads).toBe(0);
    expect(captures).toEqual([]);
  });
  it('strips query strings, fragments, form/payment data and initial profile properties', async () => {
    await enable();
    expect(captures).toHaveLength(1);
    expect(captures[0].properties.$pathname).toBe('/book');
    expect(captures[0].properties.environment).toBe('production');
    expect(captures[0].properties.token).toBe('phc_test_public_key');
    const payload = JSON.stringify(captures);
    expect(payload).not.toContain('private');
    expect(payload).not.toContain('invite-secret');
    expect(captures[0].$set_once).toBeUndefined();
    expect(config.defaults).toBe('2026-08-30');
    expect(config.autocapture.dom_event_allowlist).toEqual(['click', 'submit']);
    expect(config.mask_all_text).toBe(true);
    expect(config.mask_all_element_attributes).toBe(true);
    expect(config.capture_pageleave).toBe(true);
    expect(config.capture_heatmaps).toBe(true);
    expect(config.api_host).toBe('https://v.pratyushes.dev');
    expect(config.ui_host).toBe('https://us.posthog.com');
    expect(config.capture_exceptions).toEqual({
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: true,
    });
    expect(config.capture_performance.web_vitals).toBe(true);
    expect(config.capture_performance.network_timing).toBe(true);
    expect(config.disable_session_recording).toBe(false);
    expect(config.enable_recording_console_log).toBe(true);
    expect(config.session_recording.maskAllInputs).toBe(true);
    expect(config.session_recording.recordCrossOriginIframes).toBe(false);
    expect(config.logs.serviceName).toBe('portfolio-web');
    expect(config.advanced_disable_flags).toBe(false);
    expect(config.disable_external_dependency_loading).toBe(false);
    expect(config.tracing_headers).toEqual(
      expect.arrayContaining(['pratyushes.dev', 'www.pratyushes.dev']),
    );
    expect(config.person_profiles).toBe('never');
    expect(config.disable_persistence).toBe(true);
    expect(config.ip).toBe(false);
  });
  it('captures only allowlisted booking steps and suppresses all events after admin navigation', async () => {
    await enable('/book');
    await service.track('booking_step_viewed', 'checkout');
    expect(captures.at(-1).properties.step).toBe('checkout');
    await service.track('booking_step_viewed', 'private-data' as any);
    expect(captures.at(-1).properties.step).toBeUndefined();
    const count = captures.length;
    await router.navigateByUrl('/admin/quotations/private-id');
    await service.track('booking_confirmed');
    expect(captures).toHaveLength(count);
    expect(config.before_send({ event: '$pageview', properties: {}, uuid: 'id' })).toBeNull();
  });
  it('tracks proposal payments without exposing the invitation token or payment data', async () => {
    await enable('/proposal#invite-secret');
    const correlationId = '9d04cd74-d19c-4f09-a65b-7da04bf07440';
    await service.track('quotation_payment_checkout_opened', {
      milestone_index: 2,
      correlation_id: correlationId,
    });
    const payment = captures.at(-1);
    expect(payment.event).toBe('quotation_payment_checkout_opened');
    expect(payment.properties.$pathname).toBe('/proposal');
    expect(payment.properties.milestone_index).toBe(2);
    expect(payment.properties.route).toBe('/proposal');
    expect(payment.properties.correlation_id).toBe(correlationId);
    const payload = JSON.stringify(payment);
    expect(payload).not.toContain('invite-secret');
    expect(payload).not.toContain('razorpay_payment_id');
  });
  it('rejects malformed correlation IDs and all sensitive business properties', async () => {
    await enable('/book');
    const event = config.before_send({
      uuid: 'unsafe',
      event: 'booking_confirmed',
      properties: {
        correlation_id: 'booking-db-id',
        email: 'customer@example.com',
        name: 'Customer',
        amountPaise: 50000,
        token: 'phc_test_public_key',
        bookingId: 'mongo-id',
        headers: { authorization: 'secret' },
        body: { note: 'private' },
        payment_kind: 'wallet',
        result: 'refunded',
        proposal: 'Build a private SRS for Acme',
        form_text: 'Please call me at 9999999999',
      },
    });
    expect(event.properties.correlation_id).toBeUndefined();
    expect(event.properties.payment_kind).toBeUndefined();
    expect(event.properties.result).toBeUndefined();
    const payload = JSON.stringify(event);
    expect(payload).not.toContain('customer@example.com');
    expect(payload).not.toContain('50000');
    expect(payload).not.toContain('mongo-id');
    expect(payload).not.toContain('authorization');
    expect(payload).not.toContain('note');
    expect(payload).not.toContain('private SRS');
    expect(payload).not.toContain('9999999999');
  });
  it('keeps only typed payment dimensions and still drops admin events after a public pageview', async () => {
    await enable('/book');
    const event = config.before_send({
      uuid: 'typed',
      event: 'booking_confirmed',
      properties: {
        payment_kind: 'booking',
        result: 'confirmed',
        correlation_id: '9d04cd74-d19c-4f09-a65b-7da04bf07440',
      },
    });
    expect(event.properties.payment_kind).toBe('booking');
    expect(event.properties.result).toBe('confirmed');
    expect(event.properties.route).toBe('/book');
    await router.navigateByUrl('/admin');
    expect(
      config.before_send({
        uuid: 'admin',
        event: '$pageview',
        properties: { $pathname: '/admin' },
      }),
    ).toBeNull();
  });
  it('reports Angular errors on public pages without leaking query strings or emails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await enable('/book');
    service.handleError(
      new Error(
        'Checkout failed for private@example.com at https://site.test/book?token=invite-secret',
      ),
    );
    await settle();
    const exception = captures.find((event) => event.event === '$exception');
    expect(exception).toBeTruthy();
    const payload = JSON.stringify(exception);
    expect(payload).toContain('[redacted-email]');
    expect(payload).not.toContain('invite-secret');
    expect(payload).not.toContain('private@example.com');
    consoleError.mockRestore();
  });
  it('stays disabled when config is absent or uses a personal key', async () => {
    service.start();
    await router.navigateByUrl('/');
    http
      .expectOne('/runtime/analytics.json')
      .flush({
        enabled: true,
        projectToken: 'phx_personal_key',
        apiHost: 'https://v.pratyushes.dev',
        uiHost: 'https://us.posthog.com',
      });
    await settle();
    expect(loads).toBe(0);
    expect(captures).toEqual([]);
  });
  it('normalises public project URLs and rejects private/unknown routes', () => {
    expect(analyticsPath('/projects/client-specific-id?email=private#token')).toBe('/projects/:id');
    expect(analyticsPath('/work/2?ref=nav')).toBe('/work/:id');
    expect(analyticsPath('/admin?password=private')).toBeNull();
    expect(analyticsPath('/admin/quotations/private-id')).toBeNull();
    expect(analyticsPath('/proposal#token')).toBe('/proposal');
    expect(analyticsPath('/unknown/private')).toBeNull();
  });
  it('keeps replay snapshots on public pages and drops them after admin navigation', async () => {
    await enable('/book');
    const snapshot = config.before_send({
      uuid: 'snap',
      event: '$snapshot',
      properties: {
        $snapshot_data: [{ type: 2 }],
        $current_url: 'https://site.test/book?email=private@example.com',
      },
    });
    expect(snapshot.event).toBe('$snapshot');
    expect(snapshot.properties.$snapshot_data).toEqual([{ type: 2 }]);
    expect(snapshot.properties.$pathname).toBe('/book');
    await router.navigateByUrl('/admin');
    expect(
      config.before_send({
        uuid: 'admin-snap',
        event: '$snapshot',
        properties: { $snapshot_data: [{ type: 2 }] },
      }),
    ).toBeNull();
  });
  it('records when the visitor ignores the notice', async () => {
    localStorage.removeItem('portfolio-analytics-consent');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: RouteStub }]),
        { provide: ANALYTICS_LOADER, useValue: async () => ({ init: () => {}, startSessionRecording: () => {}, stopSessionRecording: () => {}, capture: () => {}, captureException: () => {} }) },
      ],
    });
    expect(TestBed.inject(AnalyticsConsentService).granted()).toBe(true);
  });
  it('does not load PostHog after the visitor declines analytics', async () => {
    TestBed.inject(AnalyticsConsentService).set('denied');
    service.start();
    await router.navigateByUrl('/book');
    await service.track('contact_submitted');
    http.expectNone('/runtime/analytics.json');
    expect(loads).toBe(0);
    expect(captures).toEqual([]);
  });
  it('drops SDK events after consent is withdrawn', async () => {
    await enable();
    TestBed.inject(AnalyticsConsentService).set('denied');
    expect(
      config.before_send({
        uuid: 'after-opt-out',
        event: '$autocapture',
        properties: { $event_type: 'click' },
      }),
    ).toBeNull();
  });
});
