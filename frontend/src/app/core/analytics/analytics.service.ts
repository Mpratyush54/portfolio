import {
  DestroyRef,
  ErrorHandler,
  Injectable,
  InjectionToken,
  NgZone,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { AnalyticsConsentService } from './analytics-consent.service';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, timeout } from 'rxjs';
import type { PostHog, PostHogConfig } from 'posthog-js';
import { analyticsRuntimeSchema } from '../schemas';
import { withoutTrailingSlash } from '../text';
import {
  ANALYTICS_EVENTS,
  analyticsPath,
} from './analytics.contract';
import type {
  AnalyticsEvent,
  AnalyticsProperties,
  BookingStep,
} from './analytics.contract';
import { sanitizeAnalyticsEvent } from './analytics.sanitizer';

export type {
  AnalyticsEvent,
  AnalyticsProperties,
  BookingStep,
  PaymentKind,
  PaymentResult,
} from './analytics.contract';
export { analyticsPath } from './analytics.contract';

type Client = Pick<
  PostHog,
  'init' | 'capture' | 'captureException' | 'startSessionRecording' | 'stopSessionRecording'
>;
export const ANALYTICS_LOADER = new InjectionToken<() => Promise<Client>>('PostHog loader', {
  providedIn: 'root',
  factory: () => async () => (await import('posthog-js')).default,
});
@Injectable({ providedIn: 'root' })
export class AnalyticsService implements ErrorHandler {
  private http = inject(HttpClient);
  private router = inject(Router);
  private zone = inject(NgZone);
  private destroy = inject(DestroyRef);
  private loader = inject(ANALYTICS_LOADER);
  private consent = inject(AnalyticsConsentService);
  private client?: Client;
  private loading?: Promise<void>;
  private started = false;
  private navigation = 0;
  private environment: 'development' | 'staging' | 'production' = 'production';

  constructor() {
    let previous = this.consent.granted();
    effect(() => {
      const granted = this.consent.granted();
      if (granted === previous) return;
      previous = granted;
      untracked(() => {
        if (!granted) {
          this.navigation++;
          this.zone.runOutsideAngular(() => this.client?.stopSessionRecording());
        } else if (this.started) void this.pageview();
      });
    });
  }

  private permitted(): boolean {
    return this.consent.granted() && analyticsPath(this.router.url) !== null;
  }

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
    if (!this.permitted()) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const config = await firstValueFrom(
          this.http
            .get<{
              enabled: boolean;
              projectToken: string;
              apiHost: string;
              uiHost?: string;
              environment?: 'development' | 'staging' | 'production';
            }>('/runtime/analytics.json')
            .pipe(timeout(3000)),
        );
        const parsed = analyticsRuntimeSchema.safeParse(config);
        if (!parsed.success) return;
        const host = new URL(parsed.data.apiHost);
        const uiHost = new URL(parsed.data.uiHost || 'https://us.posthog.com');
        const sdk = await this.loader();
        if (!this.permitted()) {
          this.loading = undefined;
          return;
        }
        if (parsed.data.environment) this.environment = parsed.data.environment;
        this.zone.runOutsideAngular(() =>
          sdk.init(parsed.data.projectToken, {
            api_host: withoutTrailingSlash(host.href),
            ui_host: uiHost.origin,
            defaults: '2026-08-30',
            autocapture: {
              dom_event_allowlist: ['click', 'submit'],
              element_allowlist: ['a', 'button', 'form'],
              css_selector_ignorelist: [
                '.ph-no-autocapture',
                '[data-ph-no-autocapture]',
                'app-quotation-admin-host *',
              ],
            },
            mask_all_text: true,
            mask_all_element_attributes: true,
            capture_pageview: false,
            capture_pageleave: true,
            capture_dead_clicks: true,
            capture_heatmaps: true,
            rageclick: true,
            capture_exceptions: {
              capture_unhandled_errors: true,
              capture_unhandled_rejections: true,
              capture_console_errors: true,
            },
            capture_performance: {
              network_timing: true,
              web_vitals: true,
              web_vitals_allowed_metrics: ['LCP', 'CLS', 'FCP', 'INP'],
              web_vitals_delayed_flush_ms: 5000,
            },
            disable_session_recording: false,
            enable_recording_console_log: true,
            session_recording: {
              maskAllInputs: true,
              maskTextSelector: 'input, textarea, [contenteditable], .ph-mask',
              recordCrossOriginIframes: false,
              collectFonts: false,
            },
            logs: {
              captureConsoleLogs: false,
              serviceName: 'portfolio-web',
              environment: this.environment,
            },
            tracing_headers: [
              'pratyushes.dev',
              'www.pratyushes.dev',
              ...(location.hostname === 'localhost' ? ['localhost'] : [location.hostname]),
            ],
            disable_surveys: true,
            disable_external_dependency_loading: false,
            advanced_disable_flags: false,
            strict_script_versioning: true,
            person_profiles: 'never',
            persistence: 'memory',
            disable_persistence: true,
            ip: false,
            before_send: (event) =>
              this.consent.granted()
                ? sanitizeAnalyticsEvent(
                    event,
                    this.router.url,
                    location.origin,
                    this.environment,
                  )
                : null,
          } satisfies Partial<PostHogConfig>),
        );
        this.client = sdk;
      } catch {
        /* Optional analytics must never block navigation or checkout. */
      }
    })();
    return this.loading;
  }

  private async pageview(): Promise<void> {
    const sequence = ++this.navigation;
    if (!this.permitted()) {
      this.zone.runOutsideAngular(() => this.client?.stopSessionRecording());
      return;
    }
    await this.load();
    if (sequence === this.navigation && this.permitted())
      this.zone.runOutsideAngular(() => {
        this.client?.startSessionRecording();
        this.client?.capture('$pageview');
      });
  }

  async track(
    event: AnalyticsEvent,
    details: BookingStep | AnalyticsProperties = {},
  ): Promise<void> {
    if (!ANALYTICS_EVENTS.has(event) || !this.permitted()) return;
    await this.load();
    if (!this.permitted()) return;
    const properties: AnalyticsProperties =
      typeof details === 'string' ? { step: details } : details;
    this.zone.runOutsideAngular(() =>
      this.client?.capture(event, properties),
    );
  }

  handleError(error: unknown): void {
    void this.captureException(error);
    console.error(error);
  }

  private async captureException(error: unknown): Promise<void> {
    if (!this.permitted()) return;
    await this.load();
    if (!this.permitted()) return;
    this.zone.runOutsideAngular(() =>
      this.client?.captureException(
        error instanceof Error ? error : new Error(String(error)),
        { source: 'angular' },
      ),
    );
  }
}
