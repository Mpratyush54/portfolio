const express = require('express');
const { apiRateLimits } = require('./modules/shared/rateLimits');
const { webhookGuard } = require('./modules/payments/security');
const { handleHttpError } = require('./modules/shared/errors');
const { createBookingRouter } = require('./modules/booking/routes');
const { createQuotationRouter } = require('./modules/quotations/routes');
const { createContactRouter } = require('./modules/contact/routes');
const { createAdminRouter } = require('./modules/admin/routes');
const { createProjectsRouter } = require('./modules/projects/routes');
const { AdminOperator } = require('./modules/operator/AdminOperator');
const { Grokbot } = require('./modules/operator/Grokbot');
const { createOperatorRouter } = require('./modules/operator/routes');
const { hideIdsInRoute } = require('./modules/shared/text');
const { mongoReady } = require('./modules/shared/mongo');

function captureApiError(analytics, req, status) {
  if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/operator')) return;
  const route = hideIdsInRoute(`${req.baseUrl || ''}${req.route?.path || req.path}`);
  analytics.capture('api_error', {
    event_source: 'express_error_boundary',
    method: req.method,
    route,
    status,
  }, 'backend:http');
}

function createApp({
  bookingService,
  quotationService,
  requireAdmin,
  adminLogin,
  contactActions,
  getRazorpay,
  analytics = { capture: () => false },
  calendar,
}) {
  const app = express();
  const guardWebhook = webhookGuard();

  app.use(require('cors')());
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (Number.isSafeInteger(proxyHops) && proxyHops > 0) app.set('trust proxy', proxyHops);

  app.post('/api/bookings/webhook', express.raw({ type: 'application/json', limit: '64kb' }), guardWebhook, async (req, res) => {
    try { res.json(await bookingService.webhook(req.body, req.headers['x-razorpay-signature'])); }
    catch (error) { handleHttpError(res, error); }
  });
  app.post('/api/quotations/webhook', express.raw({ type: 'application/json', limit: '64kb' }), guardWebhook, async (req, res) => {
    try {
      res.json(await quotationService.webhook(req.body, req.get('x-razorpay-signature')));
    } catch (error) { handleHttpError(res, error); }
  });
  app.use('/api', apiRateLimits());
  app.use(express.json({ limit: '48kb' }));

  app.get('/api/health', (req, res) => {
    const ready = mongoReady() && bookingService.ready();
    res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({ ready });
  });

  const grokbot = new Grokbot({
    operator: new AdminOperator({ bookingService, quotationService, contactActions, calendar }),
  });

  app.use('/api', createProjectsRouter());
  app.use('/api', createAdminRouter({ requireAdmin, adminLogin }));
  app.use('/api', createContactRouter({ contactActions, requireAdmin }));
  app.use('/api', createBookingRouter(bookingService, requireAdmin, getRazorpay));
  app.use('/api', createQuotationRouter(quotationService, requireAdmin));
  app.use('/api', createOperatorRouter({ grokbot, requireAdmin }));

  app.use((error, req, res, next) => {
    const status = error.type === 'entity.parse.failed' ? 400
      : error.type === 'entity.too.large' ? 413
        : Number.isInteger(error.status) ? error.status : 500;
    captureApiError(analytics, req, status);
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    console.error('[API] Request failed; request and upstream details suppressed.');
    res.status(status).json({ error: status === 500 ? 'Request failed.' : error.message });
  });

  return app;
}

module.exports = { createApp, captureApiError };
