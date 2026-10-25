const express = require('express');
const { handleBookingError } = require('./bookingRoutes');
function createQuotationRouter(service, admin) {
  const router = express.Router();
  router.use((req, res, next) => {
    req.body = req.body || {};
    next();
  });
  const run = (fn) => async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (e) {
      handleBookingError(res, e);
    }
  };
  router.use(['/quotations', '/admin/quotations'], (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
  });
  router.get(
    '/admin/quotations',
    admin,
    run(() => service.list()),
  );
  router.get(
    '/admin/quotations/defaults',
    admin,
    run(() => ({ terms: service.defaults })),
  );
  router.post(
    '/admin/quotations',
    admin,
    run((r) => service.create(r.body)),
  );
  router.put(
    '/admin/quotations/:id',
    admin,
    run((r) => service.edit(r.params.id, r.body)),
  );
  router.post(
    '/admin/quotations/:id/revise',
    admin,
    run((r) => service.revise(r.params.id)),
  );
  router.post(
    '/admin/quotations/:id/invite',
    admin,
    run((r) => service.invite(r.params.id, r.body.version)),
  );
  router.post(
    '/admin/quotations/:id/revoke',
    admin,
    run((r) => service.revoke(r.params.id)),
  );
  router.post(
    '/admin/quotations/:id/release/:index',
    admin,
    run((r) => service.release(r.params.id, r.params.index, r.body.evidence)),
  );
  // Capability is in a request header, never an access-log URL or query string.
  router.use('/quotations', (req, res, next) => {
    req.inviteToken = req.get('x-quotation-token');
    next();
  });
  router.get(
    '/quotations/current',
    run(async (r) => service.view(await service.portal(r.inviteToken))),
  );
  router.post(
    '/quotations/accept',
    run((r) => service.accept(r.inviteToken, r.body)),
  );
  router.post(
    '/quotations/review/:index',
    run((r) => service.review(r.inviteToken, r.params.index, r.body)),
  );
  router.post(
    '/quotations/order/:index',
    run((r) => service.order(r.inviteToken, r.params.index)),
  );
  router.post(
    '/quotations/verify',
    run((r) => service.verify(r.inviteToken, r.body)),
  );
  return router;
}
module.exports = { createQuotationRouter };
