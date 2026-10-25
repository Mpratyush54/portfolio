import { DestroyRef, Injectable, InjectionToken, NgZone, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, timeout } from 'rxjs';
import type { CaptureResult, PostHog, PostHogConfig } from 'posthog-js';

type Client = Pick<PostHog, 'init' | 'capture'>;
export const ANALYTICS_LOADER = new InjectionToken<() => Promise<Client>>('PostHog loader', {
  providedIn: 'root',
  factory: () => async () => (await import('posthog-js')).default,
});
export type AnalyticsEvent =
  | 'booking_step_viewed'
  | 'booking_checkout_opened'
  | 'booking_confirmed'
  | 'booking_payment_review'
  | 'contact_submitted';
export type BookingStep = 'time' | 'details' | 'checkout';
const EVENTS = new Set([
  '$pageview',
  'booking_step_viewed',
  'booking_checkout_opened',
  'booking_confirmed',
  'booking_payment_review',
  'contact_submitted',
]);
const STEPS = new Set(['time', 'details', 'checkout']);
const SAFE_PROPERTIES = [
  'token',
  '$insert_id',
  'distinct_id',
  '$device_id',
  '$session_id',
  '$window_id',
  '$lib',
  '$lib_version',
  '$browser',
  '$browser_version',
  '$os',
  '$os_version',
  '$device_type',
  '$screen_width',
  '$screen_height',
  '$viewport_width',
  '$viewport_height',
  '$timezone',
];

export function analyticsPath(url: string): string | null {
  const path = url.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  if (
    [
      '/',
      '/work',
      '/projects',
      '/projects/systems',
      '/about',
      '/contact',
      '/book',
      '/404',
    ].includes(path)
  )
    return path;
  if (/^\/projects\/[a-zA-Z0-9_-]{1,120}$/.test(path)) return '/projects/:id';
  return null;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private zone = inject(NgZone);
  private destroy = inject(DestroyRef);
  private loader = inject(ANALYTICS_LOADER);
  private client?: Client;
  private loading?: Promise<void>;
  private started = false;
  private navigation = 0;

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    const subscription = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        void this.pageview();
      });
    this.destroy.onDestroy(() => subscription.unsubscribe());
    if (this.router.navigated) void this.pageview();
  }

  private async load(): Promise<void> {
    if (!analyticsPath(this.router.url)) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const config = await firstValueFrom(
          this.http
            .get<{
              enabled: boolean;
              projectToken: string;
              apiHost: string;
            }>('/runtime/analytics.json')
            .pipe(timeout(3000)),
        );
        if (
          config.enabled !== true ||
          typeof config.projectToken !== 'string' ||
          !/^[a-zA-Z0-9_-]{10,200}$/.test(config.projectToken) ||
          config.projectToken.startsWith('phx_')
        )
          return;
        const host = new URL(config.apiHost);
        if (
          host.protocol !== 'https:' ||
          host.username ||
          host.password ||
          host.search ||
          host.hash
        )
          return;
        const sdk = await this.loader();
        if (!analyticsPath(this.router.url)) {
          this.loading = undefined;
          return;
        }
        this.zone.runOutsideAngular(() =>
          sdk.init(config.projectToken, {
            api_host: host.href.replace(/\/$/, ''),
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            capture_dead_clicks: false,
            capture_heatmaps: false,
            rageclick: false,
            capture_exceptions: false,
            capture_performance: false,
            disable_session_recording: true,
            disable_surveys: true,
            disable_external_dependency_loading: true,
            advanced_disable_flags: true,
            person_profiles: 'never',
            persistence: 'memory',
            disable_persistence: true,
            respect_dnt: true,
            ip: false,
            before_send: (event) => this.sanitize(event),
          } satisfies Partial<PostHogConfig>),
        );
        this.client = sdk;
      } catch {
        /* Optional analytics must never block navigation or checkout. */
      }
    })();
    return this.loading;
  }

  private sanitize(event: CaptureResult): CaptureResult | null {
    const path = analyticsPath(this.router.url);
    if (!path || !EVENTS.has(event.event)) return null;
    const original = event.properties || {};
    const properties: Record<string, unknown> = {};
    for (const key of SAFE_PROPERTIES)
      if (original[key] !== undefined) properties[key] = original[key];
    properties['$current_url'] = location.origin + path;
    properties['$pathname'] = path;
    properties['$referrer'] = '';
    properties['$ip'] = null;
    properties['$process_person_profile'] = false;
    if (event.event === 'booking_step_viewed' && STEPS.has(original['step']))
      properties['step'] = original['step'];
    return {
      uuid: event.uuid,
      event: event.event,
      properties,
      ...(event.timestamp ? { timestamp: event.timestamp } : {}),
    };
  }

  private async pageview(): Promise<void> {
    const sequence = ++this.navigation;
    if (!analyticsPath(this.router.url)) return;
    await this.load();
    if (sequence === this.navigation && analyticsPath(this.router.url))
      this.zone.runOutsideAngular(() => this.client?.capture('$pageview'));
  }

  async track(event: AnalyticsEvent, step?: BookingStep): Promise<void> {
    if (!EVENTS.has(event) || !analyticsPath(this.router.url)) return;
    await this.load();
    if (!analyticsPath(this.router.url)) return;
    this.zone.runOutsideAngular(() =>
      this.client?.capture(
        event,
        event === 'booking_step_viewed' && step && STEPS.has(step) ? { step } : {},
      ),
    );
  }
}
