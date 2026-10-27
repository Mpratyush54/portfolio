const express = require('express');
const { handleBookingError } = require('./bookingRoutes');
const { createQuotationFiles } = require('./quotationFiles');
const { exportQuotation } = require('./quotationExport');
const { disposition } = require('./quotationFiles');
const { limitRequests } = require('./rateLimits');
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
    run((r) => r.query.page ? service.page(r.query) : service.list()),
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
  router.get('/admin/quotations/:id', admin, run(async (r) => service.view(await service.get(r.params.id), true)));
  router.get('/admin/quotations/:id/receipts', admin, run(async (r) => {
    const q = await service.get(r.params.id);
    return require('../models/PaymentReceipt').find({ quotationId: q._id }).sort({ paidAt: -1 }).select('-claim').lean();
  }));
  router.get('/admin/quotations/:id/receipts/:paymentId/pdf', admin, sendFile(async (r, res) => {
    const q = await service.get(r.params.id);
    const receipt = await require('../models/PaymentReceipt').findOne({ quotationId: q._id, paymentId: r.params.paymentId }).lean();
    if (!receipt) throw Object.assign(new Error('Receipt not found.'), { status: 404 });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': disposition(`receipt-${receipt.paymentId}.pdf`), 'Cache-Control': 'no-store' });
    res.send(await require('./paymentReceipts').pdf(receipt));
  }));
  router.post('/admin/quotations/:id/receipts/:paymentId/retry', admin, run(async (r) => {
    const q = await service.get(r.params.id);
    await require('../models/PaymentReceipt').updateOne({ quotationId: q._id, paymentId: r.params.paymentId, status: 'failed' }, { $set: { status: 'pending' }, $unset: { nextAttemptAt: 1 } });
    return { success: true };
  }));
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
    limitRequests('admin-quotation-export', 10, 60000, () => 'admin'),
    sendFile(async (r, res) =>
      sendExport(await service.get(r.params.id), r.params.format, res),
    ),
  );
  router.post(
    '/admin/quotations/preview',
    admin,
    run((r) => service.preview(r.body.builder, r.body.paymentSchedule)),
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
  router.patch(
    '/admin/quotations/:id/schedule',
    admin,
    run((r) => service.updateSchedule(r.params.id, r.body)),
  );
  router.delete(
    '/admin/quotations/:id',
    admin,
    run((r) => service.deleteDraft(r.params.id)),
  );
  router.post(
    '/admin/quotations/:id/revise',
    admin,
    run((r) => service.revise(r.params.id)),
  );
  router.post(
    '/admin/quotations/:id/invite',
    admin,
    run((r) => service.invite(r.params.id, r.body.version, r.body)),
  );
  router.post(
    '/admin/quotations/:id/revoke',
    admin,
    run((r) => service.revoke(r.params.id)),
  );
  router.get('/admin/quotations/:id/invitations', admin, run(async (r) => {
    const q = await service.get(r.params.id);
    const links = await require('./quotationInvitations').list(r.params.id);
    if (q.tokenHash) links.unshift({ _id: 'legacy', label: 'Previous invitation (copy unavailable; create a new managed link)', expiresAt: q.tokenExpiresAt, createdAt: q.createdAt, emailStatus: 'unknown' });
    return links;
  }));
  router.post('/admin/quotations/:id/invitations/:inviteId/:action', admin, run(async (r) => {
    const q = await service.get(r.params.id), links = require('./quotationInvitations');
    if (r.params.inviteId === 'legacy' && r.params.action === 'revoke') {
      q.tokenHash = undefined; q.tokenExpiresAt = undefined; await q.save(); return { success: true };
    }
    const link = await links.owned(q._id, r.params.inviteId, r.params.action !== 'revoke');
    if (r.params.action === 'revoke') { link.revokedAt = new Date(); await link.save(); return { success: true }; }
    if (!['invited', 'accepted'].includes(q.status)) throw Object.assign(new Error('Quotation is not active.'), { status: 409 });
    if (r.params.action === 'copy') return { token: links.token(link) };
    if (r.params.action === 'email') {
      // An email may already be in flight; do not invalidate its claim or send it twice.
      if (link.emailStatus === 'sending') return { status: 'sending' };
      link.emailStatus = 'pending'; link.emailNextAttemptAt = undefined; await link.save(); return { status: 'pending' };
    }
    throw Object.assign(new Error('Unknown invitation action.'), { status: 400 });
  }));
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
  router.use('/quotations', (req, res, next) => {
    const scope = req.path.startsWith('/order/') ? 'order'
      : req.path === '/verify' ? 'verify'
      : req.path.startsWith('/export/') ? 'export'
      : req.method === 'GET' ? 'read' : 'write';
    const limits = { order: 10, verify: 30, export: 6, read: 120, write: 30 };
    return limitRequests(`quotation-${scope}`, limits[scope], 60000,
      r => typeof r.inviteToken === 'string' && /^[a-f0-9]{64}$/.test(r.inviteToken) ? r.inviteToken : 'invalid')(req, res, next);
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
