import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
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
    config = null;
    captures = [];
    loads = 0;
    const client = {
      init: (_token: string, cfg: any) => {
        config = cfg;
      },
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
  afterEach(() => http.verify());
  async function enable(path = '/book?email=private@example.com#invite-secret') {
    service.start();
    await router.navigateByUrl(path);
    http
      .expectOne('/runtime/analytics.json')
      .flush({
        enabled: true,
        projectToken: 'phc_test_public_key',
        apiHost: 'https://us.i.posthog.com',
      });
    await settle();
  }
  it('does not load PostHog or request config on admin and private proposal pages', async () => {
    service.start();
    for (const path of ['/admin', '/proposal#invite-secret']) {
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
    expect(captures[0].properties.token).toBe('phc_test_public_key');
    const payload = JSON.stringify(captures);
    expect(payload).not.toContain('private');
    expect(payload).not.toContain('invite-secret');
    expect(captures[0].$set_once).toBeUndefined();
    expect(config.autocapture).toBe(false);
    expect(config.disable_session_recording).toBe(true);
    expect(config.person_profiles).toBe('never');
    expect(config.disable_persistence).toBe(true);
    expect(config.ip).toBe(false);
  });
  it('captures only allowlisted booking steps and suppresses all events after private navigation', async () => {
    await enable('/book');
    await service.track('booking_step_viewed', 'checkout');
    expect(captures.at(-1).properties.step).toBe('checkout');
    await service.track('booking_step_viewed', 'private-data' as any);
    expect(captures.at(-1).properties.step).toBeUndefined();
    const count = captures.length;
    await router.navigateByUrl('/proposal#invite-secret');
    await service.track('booking_confirmed');
    expect(captures).toHaveLength(count);
    expect(config.before_send({ event: '$pageview', properties: {}, uuid: 'id' })).toBeNull();
  });
  it('stays disabled when config is absent or uses a personal key', async () => {
    service.start();
    await router.navigateByUrl('/');
    http
      .expectOne('/runtime/analytics.json')
      .flush({
        enabled: true,
        projectToken: 'phx_personal_key',
        apiHost: 'https://us.i.posthog.com',
      });
    await settle();
    expect(loads).toBe(0);
    expect(captures).toEqual([]);
  });
  it('normalises public project URLs and rejects private/unknown routes', () => {
    expect(analyticsPath('/projects/client-specific-id?email=private#token')).toBe('/projects/:id');
    expect(analyticsPath('/admin?password=private')).toBeNull();
    expect(analyticsPath('/proposal#token')).toBeNull();
    expect(analyticsPath('/unknown/private')).toBeNull();
  });
});
