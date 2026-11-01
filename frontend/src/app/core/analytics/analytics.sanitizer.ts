import type { CaptureResult } from 'posthog-js';
import { redactPrivateText } from '../text';
import {
  ANALYTICS_EVENTS,
  PAYMENT_KINDS,
  PAYMENT_RESULTS,
  analyticsPath,
  isCorrelationId,
} from './analytics.contract';

const WEB_VITAL_PREFIXES = [
  '$web_vitals_LCP',
  '$web_vitals_CLS',
  '$web_vitals_FCP',
  '$web_vitals_INP',
];

const BOOKING_STEPS = new Set(['time', 'details', 'checkout']);
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
const SAFE_EXCEPTION_PROPERTIES = [
  '$exception_fingerprint',
  '$exception_level',
  '$issue_name',
  '$issue_description',
];

function isWebVitalProperty(key: string): boolean {
  return WEB_VITAL_PREFIXES.some(
    (prefix) => key === prefix || key.startsWith(`${prefix}_`),
  );
}

function sanitizeNestedValue(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) return value;
  if (typeof value === 'string') return redactPrivateText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => sanitizeNestedValue(item, depth + 1));
  if (typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [key, sanitizeNestedValue(item, depth + 1)]),
    );
  return undefined;
}

export function sanitizeAnalyticsEvent(
  event: CaptureResult,
  currentUrl: string,
  origin: string,
  environment: 'development' | 'staging' | 'production',
): CaptureResult | null {
  const path = analyticsPath(currentUrl);
  if (!path || !ANALYTICS_EVENTS.has(event.event)) return null;
  const original = event.properties || {};
  const properties: Record<string, unknown> = {};
  for (const key of SAFE_PROPERTIES)
    if (original[key] !== undefined) properties[key] = original[key];

  properties['$current_url'] = origin + path;
  properties['$pathname'] = path;
  properties['route'] = path;
  properties['$referrer'] = '';
  properties['$ip'] = null;
  properties['$process_person_profile'] = false;
  properties['environment'] = environment;

  if (event.event === 'booking_step_viewed' && BOOKING_STEPS.has(original['step']))
    properties['step'] = original['step'];
  if (
    typeof original['milestone_index'] === 'number' &&
    Number.isSafeInteger(original['milestone_index']) &&
    original['milestone_index'] >= 0 &&
    original['milestone_index'] <= 20
  )
    properties['milestone_index'] = original['milestone_index'];
  if (typeof original['approved'] === 'boolean')
    properties['approved'] = original['approved'];
  if (isCorrelationId(original['correlation_id']))
    properties['correlation_id'] = original['correlation_id'];
  if (PAYMENT_KINDS.has(original['payment_kind'] as never))
    properties['payment_kind'] = original['payment_kind'];
  if (PAYMENT_RESULTS.has(original['result'] as never))
    properties['result'] = original['result'];

  if (event.event === '$autocapture') {
    if (typeof original['$event_type'] === 'string')
      properties['$event_type'] = original['$event_type'];
    if (Array.isArray(original['$elements']))
      properties['$elements'] = original['$elements'].slice(0, 20).map((element) => {
        const item = element as Record<string, unknown>;
        return {
          ...(typeof item['tag_name'] === 'string'
            ? { tag_name: item['tag_name'].slice(0, 30) }
            : {}),
          ...(typeof item['nth_child'] === 'number' ? { nth_child: item['nth_child'] } : {}),
          ...(typeof item['nth_of_type'] === 'number'
            ? { nth_of_type: item['nth_of_type'] }
            : {}),
        };
      });
    if (original['$heatmap_data'] && typeof original['$heatmap_data'] === 'object')
      properties['$heatmap_data'] = sanitizeNestedValue(original['$heatmap_data']);
  }
  if (
    event.event === '$pageleave' &&
    typeof original['$prev_pageview_duration'] === 'number'
  )
    properties['$prev_pageview_duration'] = original['$prev_pageview_duration'];
  if (event.event === '$exception') {
    properties['$exception_list'] = sanitizeNestedValue(original['$exception_list']);
    for (const key of SAFE_EXCEPTION_PROPERTIES)
      if (original[key] !== undefined)
        properties[key] = sanitizeNestedValue(original[key]);
  }
  if (event.event === '$web_vitals')
    for (const [key, value] of Object.entries(original))
      if (
        isWebVitalProperty(key) &&
        (typeof value === 'number' || typeof value === 'string')
      )
        properties[key] = value;
  if (event.event === '$snapshot' || event.event === '$snapshot_item') {
    for (const [key, value] of Object.entries(original)) {
      if (key === '$current_url' || key === '$pathname' || key === '$referrer' || key === '$ip')
        continue;
      properties[key] = value;
    }
  }

  return {
    uuid: event.uuid,
    event: event.event,
    properties,
    ...(event.timestamp ? { timestamp: event.timestamp } : {}),
  };
}
