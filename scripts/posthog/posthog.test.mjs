import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap } from './bootstrap.mjs';
import { scanText } from './scan-analytics.mjs';
import { dashboards, alerts, ALERT_NAMES } from './manifest.mjs';
import { EXPECTED_EVENTS, verify } from './verify.mjs';

test('dashboard bootstrap dry-run includes every managed resource', async () => {
  const result = await bootstrap({ dryRun: true });
  assert.equal(result.dashboards.length, 8);
  assert.equal(
    result.insights.length,
    dashboards.reduce((total, dashboard) => total + dashboard.insights.length, 0),
  );
  assert.equal(result.alerts.length, alerts.length);
  assert.equal(new Set(result.insights.map((item) => item.name)).size, result.insights.length);
});

test('scanner rejects forbidden properties in analytics emissions', () => {
  const findings = scanText(`
    posthog.capture('checkout', { amount: 100, customer_id: 'raw' });
    posthog.capture('contact', { headers: requestHeaders });
  `);
  assert.deepEqual(
    findings.map((item) => item.property),
    ['amount', 'customer_id', 'headers'],
  );
});

test('scanner allows the deliberately anonymous event schema', () => {
  assert.deepEqual(
    scanText(`
      void this.analytics.track('booking_step_viewed', { step: 'checkout' });
      this.client?.capture(event, { milestone_index: 2, approved: true });
    `),
    [],
  );
});

test('scanner ignores forbidden words outside an analytics call', () => {
  assert.deepEqual(
    scanText(`
      const email = form.email;
      const docs = "Never send token, body, headers, raw IDs, name, or amount.";
    `),
    [],
  );
});

test('scanner rejects forbidden properties on backend capture calls', () => {
  assert.deepEqual(
    scanText(`
      this.analytics.capture('booking_order_created', { email: customer.email, amount: 100 });
      analytics.capture('api_error', { headers: req.headers, body: req.body });
    `).map((item) => item.property),
    ['email', 'amount', 'headers', 'body'],
  );
});

test('managed alerts cover reliability, delivery, and web vitals', () => {
  assert.ok(ALERT_NAMES.includes('Backend API errors detected'));
  assert.ok(ALERT_NAMES.includes('Payment webhook rejected or failed'));
  assert.ok(ALERT_NAMES.includes('Receipt delivery exhausted'));
  assert.ok(ALERT_NAMES.includes('Core Web Vitals LCP regression'));
  assert.equal(new Set(ALERT_NAMES).size, alerts.length);
});

test('verification dry-run lists frontend and backend event families', async () => {
  const result = await verify({ dryRun: true, smoke: true });
  assert.ok(result.ingestionEvents.includes('$pageview'));
  assert.ok(result.ingestionEvents.includes('booking_webhook_accepted'));
  assert.ok(result.ingestionEvents.includes('api_error'));
  assert.deepEqual(result.smokeEvents, [
    '$pageview',
    '$exception',
    '$web_vitals',
    'booking_checkout_opened',
    'quotation_payment_confirmed',
  ]);
  assert.ok(EXPECTED_EVENTS.includes('quotation_verification_confirmed'));
});
