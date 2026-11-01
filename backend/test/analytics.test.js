const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  PostHogService,
  correlationId,
  validCorrelationId,
} = require('../modules/analytics/PostHogService');
const { captureApiError } = require('../app');

describe('PostHog analytics privacy boundary', () => {
  it('is disabled without configuration and validates UUID correlation IDs', () => {
    const analytics = new PostHogService({ token: '' });
    assert.equal(analytics.enabled, false);
    assert.equal(analytics.capture('api_error', { status: 500 }), false);
    const generated = correlationId();
    assert.equal(validCorrelationId(generated), true);
    assert.equal(correlationId(generated.toUpperCase()), generated);
    assert.throws(() => correlationId('not-a-uuid'), (error) => error.status === 400);
  });

  it('only sends allowlisted events and properties with anonymous distinct IDs', async () => {
    const sent = [];
    let flushed = 0;
    let shutdown = 0;
    const analytics = new PostHogService({ client: {
      capture: (event) => sent.push(event),
      flush: async () => { flushed++; },
      shutdown: async () => { shutdown++; },
    } });
    analytics.capture('booking_order_created', {
      correlation_id: '48ed1fb3-e348-44be-9cc3-0c7daf59a7f2',
      event_source: 'api',
      outcome: 'created',
      name: 'Private Name',
      email: 'private@example.com',
      amount: 12345,
      mongo_id: '507f1f77bcf86cd799439011',
      razorpay_order_id: 'order_secret',
      token: 'secret',
      body: 'request body',
      headers: 'authorization',
      query_string: 'secret=yes',
      notes: 'private',
      srs: 'agreement',
      quotation_text: 'contract',
    }, 'a-user-id');
    analytics.capture('unapproved_event', { status: 500 });
    analytics.capture('booking_reconciliation_recovered', {
      correlation_id: '48ed1fb3-e348-44be-9cc3-0c7daf59a7f2',
      event_source: 'webhook',
      outcome: 'recovered',
      payment_kind: 'booking',
      email: 'private@example.com',
    }, 'backend:booking');
    assert.deepEqual(sent, [{
      distinctId: 'backend:anonymous',
      event: 'booking_order_created',
      properties: {
        correlation_id: '48ed1fb3-e348-44be-9cc3-0c7daf59a7f2',
        event_source: 'api',
        outcome: 'created',
      },
    }, {
      distinctId: 'backend:booking',
      event: 'booking_reconciliation_recovered',
      properties: {
        correlation_id: '48ed1fb3-e348-44be-9cc3-0c7daf59a7f2',
        event_source: 'webhook',
        outcome: 'recovered',
        payment_kind: 'booking',
      },
    }]);
    await analytics.flush();
    await analytics.shutdown();
    assert.deepEqual({ flushed, shutdown }, { flushed: 1, shutdown: 1 });
  });

  it('normalizes error routes and excludes admin requests', () => {
    const events = [];
    const analytics = { capture: (...args) => events.push(args) };
    captureApiError(analytics, {
      method: 'POST',
      path: '/api/bookings/507f1f77bcf86cd799439011',
      baseUrl: '',
    }, 500);
    captureApiError(analytics, {
      method: 'POST',
      path: '/api/admin/quotations/507f1f77bcf86cd799439011',
      baseUrl: '',
    }, 500);
    assert.deepEqual(events, [[
      'api_error',
      {
        event_source: 'express_error_boundary',
        method: 'POST',
        route: '/api/bookings/:id',
        status: 500,
      },
      'backend:http',
    ]]);
  });
});
