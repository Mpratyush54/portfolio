const crypto = require('crypto');
const { PostHog } = require('posthog-node');
const { isBackendDistinctId, isUuid } = require('../shared/text');

const EVENTS = new Set([
  'booking_order_created',
  'booking_order_failed',
  'booking_verification_confirmed',
  'booking_verification_review',
  'booking_verification_failed',
  'booking_webhook_accepted',
  'booking_webhook_ignored',
  'booking_webhook_failed',
  'booking_webhook_rejected',
  'booking_reconciliation_recovered',
  'quotation_order_created',
  'quotation_order_failed',
  'quotation_verification_confirmed',
  'quotation_verification_failed',
  'quotation_webhook_accepted',
  'quotation_webhook_ignored',
  'quotation_webhook_failed',
  'quotation_webhook_rejected',
  'quotation_reconciliation_recovered',
  'receipt_delivery_succeeded',
  'receipt_delivery_retry',
  'receipt_delivery_exhausted',
  'invitation_delivery_succeeded',
  'invitation_delivery_retry',
  'invitation_delivery_exhausted',
  'api_error',
]);

const PROPERTIES = new Set([
  'correlation_id',
  'event_source',
  'method',
  'milestone_index',
  'outcome',
  'payment_kind',
  'route',
  'status',
]);

function validCorrelationId(value) {
  return isUuid(value);
}

function correlationId(value) {
  if (value === undefined || value === null || value === '') return crypto.randomUUID();
  if (!validCorrelationId(value)) {
    const error = new Error('Invalid correlation ID.');
    error.status = 400;
    throw error;
  }
  return value.toLowerCase();
}

class PostHogService {
  constructor({
    token = process.env.POSTHOG_PROJECT_TOKEN,
    host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    client,
  } = {}) {
    this.client = client || (token ? new PostHog(token, { host }) : null);
  }

  get enabled() {
    return Boolean(this.client);
  }

  capture(event, properties = {}, distinctId = 'backend:anonymous') {
    if (!this.client || !EVENTS.has(event) || typeof properties !== 'object' || !properties) return false;
    const safe = {};
    for (const [key, value] of Object.entries(properties)) {
      if (!PROPERTIES.has(key)) continue;
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
        continue;
      if (typeof value === 'string' && value.length > 200) continue;
      safe[key] = value;
    }
    const safeDistinctId = isBackendDistinctId(distinctId) ? distinctId : 'backend:anonymous';
    try {
      this.client.capture({ distinctId: safeDistinctId, event, properties: safe });
      return true;
    } catch {
      return false;
    }
  }

  async flush() {
    if (!this.client?.flush) return;
    try { await this.client.flush(); } catch {}
  }

  async shutdown() {
    if (!this.client?.shutdown) return;
    try { await this.client.shutdown(); } catch {}
  }
}

module.exports = { PostHogService, correlationId, validCorrelationId, EVENTS, PROPERTIES };
