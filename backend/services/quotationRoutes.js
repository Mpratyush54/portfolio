const express = require('express');
const { handleBookingError } = require('./bookingRoutes');
const { createQuotationFiles } = require('./quotationFiles');
const { exportQuotation } = require('./quotationExport');
const { disposition } = require('./quotationFiles');
function createQuotationRouter(service, admin) {
  const router = express.Router();
  const files = createQuotationFiles(service);
  const sendFile = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (res.headersSent) res.destroy();
      else handleBookingError(res, error);
    }
  };
  const sendExport = async (q, format, res) => {
    const file = await exportQuotation(q, format);
    res.set({
      'Content-Type': file.mime,
      'Content-Disposition': disposition(file.name),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(file.buffer);
  };
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
  router.use(
    ['/quotations', '/admin/quotations', '/admin/quotation-drafts'],
    (req, res, next) => {
      res.set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      });
      next();
    },
  );
  router.get(
    '/admin/quotations',
    admin,
    run(() => service.list()),
  );
  router.get(
    '/admin/quotations/defaults',
    admin,
    run(() => service.template()),
  );
  router.post(
    '/admin/quotation-drafts',
    admin,
    run((r) => service.saveDraft(r.body)),
  );
  router.post(
    '/admin/quotations/:id/srs',
    admin,
    express.raw({ type: 'application/octet-stream', limit: '5mb' }),
    run((r) => {
      let name;
      try {
        name = decodeURIComponent(r.get('x-file-name') || '');
      } catch {
        throw Object.assign(new Error('Invalid filename.'), { status: 400 });
      }
      return files.upload(r.params.id, r.get('x-quote-version'), name, r.body);
    }),
  );
  router.delete(
    '/admin/quotations/:id/srs/:fileId',
    admin,
    run((r) => files.remove(r.params.id, r.params.fileId, r.body.version)),
  );
  router.get(
    '/admin/quotations/:id/srs/:fileId',
    admin,
    sendFile(async (r, res) =>
      files.download(await service.get(r.params.id), r.params.fileId, res),
    ),
  );
  router.get(
    '/admin/quotations/:id/export/:format',
    admin,
    sendFile(async (r, res) =>
      sendExport(await service.get(r.params.id), r.params.format, res),
    ),
  );
  router.post(
    '/admin/quotations/preview',
    admin,
    run((r) => service.preview(r.body.builder)),
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
  router.post(
    '/admin/quotations/:id/collection/:index',
    admin,
    run((r) => service.collection(r.params.id, r.params.index, r.body)),
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
  router.get(
    '/quotations/srs/:fileId',
    sendFile(async (r, res) =>
      files.download(await service.portal(r.inviteToken), r.params.fileId, res),
    ),
  );
  router.get(
    '/quotations/export/:format',
    sendFile(async (r, res) =>
      sendExport(await service.portal(r.inviteToken), r.params.format, res),
    ),
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
