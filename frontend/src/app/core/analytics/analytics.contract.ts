import { isSafeToken, isUuidV4 } from '../schemas';
import { pathOnly } from '../text';

export type AnalyticsEvent =
  | 'booking_step_viewed'
  | 'booking_checkout_opened'
  | 'booking_confirmed'
  | 'booking_payment_review'
  | 'contact_submitted'
  | 'quotation_viewed'
  | 'quotation_accepted'
  | 'quotation_milestone_reviewed'
  | 'quotation_payment_checkout_opened'
  | 'quotation_payment_confirmed'
  | 'quotation_payment_failed'
  | 'quotation_payment_dismissed';

export type BookingStep = 'time' | 'details' | 'checkout';
export type PaymentKind = 'booking' | 'quotation';
export type PaymentResult = 'opened' | 'confirmed' | 'failed' | 'review' | 'dismissed';

export type AnalyticsProperties = {
  step?: BookingStep;
  milestone_index?: number;
  approved?: boolean;
  correlation_id?: string;
  payment_kind?: PaymentKind;
  result?: PaymentResult;
};

export const PAYMENT_KINDS = new Set<PaymentKind>(['booking', 'quotation']);
export const PAYMENT_RESULTS = new Set<PaymentResult>([
  'opened',
  'confirmed',
  'failed',
  'review',
  'dismissed',
]);

export const ANALYTICS_EVENTS = new Set<string>([
  '$pageview',
  '$pageleave',
  '$autocapture',
  '$dead_click',
  '$rageclick',
  '$exception',
  '$web_vitals',
  '$snapshot',
  '$snapshot_item',
  'booking_step_viewed',
  'booking_checkout_opened',
  'booking_confirmed',
  'booking_payment_review',
  'contact_submitted',
  'quotation_viewed',
  'quotation_accepted',
  'quotation_milestone_reviewed',
  'quotation_payment_checkout_opened',
  'quotation_payment_confirmed',
  'quotation_payment_failed',
  'quotation_payment_dismissed',
]);

const PUBLIC_ROUTES = new Set([
  '/',
  '/work',
  '/projects',
  '/projects/systems',
  '/about',
  '/contact',
  '/book',
  '/terms',
  '/privacy',
  '/refunds',
  '/delivery',
  '/sample-quotation',
  '/proposal',
  '/404',
]);

export function analyticsPath(url: string): string | null {
  const path = pathOnly(url);
  if (path === '/admin' || path.startsWith('/admin/')) return null;
  if (PUBLIC_ROUTES.has(path)) return path;
  const projectPrefix = '/projects/';
  if (path.startsWith(projectPrefix) && isSafeToken(path.slice(projectPrefix.length), 1, 120))
    return '/projects/:id';
  return null;
}

export function isCorrelationId(value: unknown): value is string {
  return isUuidV4(value);
}
