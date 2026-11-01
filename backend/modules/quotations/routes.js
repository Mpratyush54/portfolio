const express = require('express');
const { handleBookingError } = require('../shared/errors');
const { createQuotationFiles, disposition } = require('./files');
const { exportQuotation } = require('./export');
const { limitRequests } = require('../shared/rateLimits');
const { isSha256Hex } = require('../shared/text');
const PaymentReceipt = require('../payments/PaymentReceipt');
const receipts = require('../payments/receipts');
const invitations = require('./invitations');

class QuotationRouter {
  constructor(service, admin) {
    this.service = service;
    this.admin = admin;
    this.files = createQuotationFiles(service);
  }

  sendJson(fn) {
    return async (req, res) => {
      try {
        res.json(await fn(req));
      } catch (error) {
        handleBookingError(res, error);
      }
    };
  }

  sendFile(fn) {
    return async (req, res) => {
      try {
        await fn(req, res);
      } catch (error) {
        if (res.headersSent) res.destroy();
        else handleBookingError(res, error);
      }
    };
  }

  async sendExport(quote, format, res) {
    const file = await exportQuotation(quote, format);
    res.set({
      'Content-Type': file.mime,
      'Content-Disposition': disposition(file.name),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(file.buffer);
  }

  inviteToken(value) {
    return typeof value === 'string' && isSha256Hex(value) ? value : 'invalid';
  }

  create() {
    const router = express.Router();
    router.use((req, res, next) => {
      req.body = req.body || {};
      next();
    });
    this.addAdminRoutes(router);
    this.addPortalRoutes(router);
    return router;
  }

  addAdminRoutes(router) {
    const admin = this.admin;
    const run = (fn) => this.sendJson(fn);
    router.use(['/quotations', '/admin/quotations', '/admin/quotation-drafts'], (req, res, next) => {
      res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      next();
    });
    router.get('/admin/quotations', admin, run((req) =>
      req.query.page ? this.service.page(req.query) : this.service.list(),
    ));
    router.get('/admin/quotations/defaults', admin, run(() => this.service.template()));
    router.post('/admin/quotation-drafts', admin, run((req) => this.service.saveDraft(req.body)));
    router.get('/admin/quotations/:id', admin, run(async (req) =>
      this.service.view(await this.service.get(req.params.id), true),
    ));
    router.get('/admin/quotations/:id/receipts', admin, run(async (req) => {
      const quote = await this.service.get(req.params.id);
      return PaymentReceipt.find({ quotationId: quote._id }).sort({ paidAt: -1 }).select('-claim').lean();
    }));
    router.get('/admin/quotations/:id/receipts/:paymentId/pdf', admin, this.sendFile(async (req, res) => {
      const quote = await this.service.get(req.params.id);
      const receipt = await PaymentReceipt.findOne({ quotationId: quote._id, paymentId: req.params.paymentId }).lean();
      if (!receipt) throw Object.assign(new Error('Receipt not found.'), { status: 404 });
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition(`receipt-${receipt.paymentId}.pdf`),
        'Cache-Control': 'no-store',
      });
      res.send(await receipts.pdf(receipt));
    }));
    router.post('/admin/quotations/:id/receipts/:paymentId/retry', admin, run(async (req) => {
      const quote = await this.service.get(req.params.id);
      await PaymentReceipt.updateOne(
        { quotationId: quote._id, paymentId: req.params.paymentId, status: 'failed' },
        { $set: { status: 'pending' }, $unset: { nextAttemptAt: 1 } },
      );
      return { success: true };
    }));
    router.post(
      '/admin/quotations/:id/srs',
      admin,
      express.raw({ type: 'application/octet-stream', limit: '5mb' }),
      run((req) => {
        let name;
        try {
          name = decodeURIComponent(req.get('x-file-name') || '');
        } catch {
          throw Object.assign(new Error('Invalid filename.'), { status: 400 });
        }
        return this.files.upload(req.params.id, req.get('x-quote-version'), name, req.body);
      }),
    );
    router.delete('/admin/quotations/:id/srs/:fileId', admin, run((req) =>
      this.files.remove(req.params.id, req.params.fileId, req.body.version),
    ));
    router.get('/admin/quotations/:id/srs/:fileId', admin, this.sendFile(async (req, res) =>
      this.files.download(await this.service.get(req.params.id), req.params.fileId, res),
    ));
    router.get(
      '/admin/quotations/:id/export/:format',
      admin,
      limitRequests('admin-quotation-export', 10, 60000, () => 'admin'),
      this.sendFile(async (req, res) => this.sendExport(await this.service.get(req.params.id), req.params.format, res)),
    );
    router.post('/admin/quotations/preview', admin, run((req) =>
      this.service.preview(req.body.builder, req.body.paymentSchedule),
    ));
    router.post('/admin/quotations', admin, run((req) => this.service.create(req.body)));
    router.put('/admin/quotations/:id', admin, run((req) => this.service.edit(req.params.id, req.body)));
    router.patch('/admin/quotations/:id/schedule', admin, run((req) =>
      this.service.updateSchedule(req.params.id, req.body),
    ));
    router.delete('/admin/quotations/:id', admin, run((req) => this.service.deleteDraft(req.params.id)));
    router.post('/admin/quotations/:id/revise', admin, run((req) => this.service.revise(req.params.id)));
    router.post('/admin/quotations/:id/invite', admin, run((req) =>
      this.service.invite(req.params.id, req.body.version, req.body),
    ));
    router.post('/admin/quotations/:id/revoke', admin, run((req) => this.service.revoke(req.params.id)));
    router.get('/admin/quotations/:id/invitations', admin, run(async (req) => {
      const quote = await this.service.get(req.params.id);
      const links = await invitations.list(req.params.id);
      if (quote.tokenHash) {
        links.unshift({
          _id: 'legacy',
          label: 'Previous invitation (copy unavailable; create a new managed link)',
          expiresAt: quote.tokenExpiresAt,
          createdAt: quote.createdAt,
          emailStatus: 'unknown',
        });
      }
      return links;
    }));
    router.post('/admin/quotations/:id/invitations/:inviteId/:action', admin, run((req) =>
      this.invitationAction(req),
    ));
    router.post('/admin/quotations/:id/release/:index', admin, run((req) =>
      this.service.release(req.params.id, req.params.index, req.body.evidence),
    ));
    router.post('/admin/quotations/:id/collection/:index', admin, run((req) =>
      this.service.collection(req.params.id, req.params.index, req.body),
    ));
  }

  async invitationAction(req) {
    const quote = await this.service.get(req.params.id);
    const { inviteId, action } = req.params;
    if (inviteId === 'legacy' && action === 'revoke') {
      quote.tokenHash = undefined;
      quote.tokenExpiresAt = undefined;
      await quote.save();
      return { success: true };
    }
    const link = await invitations.owned(quote._id, inviteId, action !== 'revoke');
    if (action === 'revoke') {
      link.revokedAt = new Date();
      await link.save();
      return { success: true };
    }
    if (!['invited', 'accepted'].includes(quote.status)) {
      throw Object.assign(new Error('Quotation is not active.'), { status: 409 });
    }
    if (action === 'copy') return { token: invitations.token(link) };
    if (action === 'email') {
      if (link.emailStatus === 'sending') return { status: 'sending' };
      link.emailStatus = 'pending';
      link.emailNextAttemptAt = undefined;
      await link.save();
      return { status: 'pending' };
    }
    throw Object.assign(new Error('Unknown invitation action.'), { status: 400 });
  }

  addPortalRoutes(router) {
    const run = (fn) => this.sendJson(fn);
    router.use('/quotations', (req, res, next) => {
      req.inviteToken = req.get('x-quotation-token');
      next();
    });
    router.use('/quotations', (req, res, next) => {
      const scope = req.path.startsWith('/order/')
        ? 'order'
        : req.path === '/verify'
          ? 'verify'
          : req.path.startsWith('/export/')
            ? 'export'
            : req.method === 'GET'
              ? 'read'
              : 'write';
      const limits = { order: 10, verify: 30, export: 6, read: 120, write: 30 };
      return limitRequests(
        `quotation-${scope}`,
        limits[scope],
        60000,
        (request) => this.inviteToken(request.inviteToken),
      )(req, res, next);
    });
    router.get('/quotations/current', run(async (req) =>
      this.service.view(await this.service.portal(req.inviteToken)),
    ));
    router.get('/quotations/srs/:fileId', this.sendFile(async (req, res) =>
      this.files.download(await this.service.portal(req.inviteToken), req.params.fileId, res),
    ));
    router.get('/quotations/export/:format', this.sendFile(async (req, res) =>
      this.sendExport(await this.service.portal(req.inviteToken), req.params.format, res),
    ));
    router.post('/quotations/accept', run((req) => this.service.accept(req.inviteToken, req.body)));
    router.post('/quotations/review/:index', run((req) =>
      this.service.review(req.inviteToken, req.params.index, req.body),
    ));
    router.post('/quotations/order/:index', run((req) =>
      this.service.order(req.inviteToken, req.params.index, req.body.correlationId),
    ));
    router.post('/quotations/verify', run((req) => this.service.verify(req.inviteToken, req.body)));
  }
}

function createQuotationRouter(service, admin) {
  return new QuotationRouter(service, admin).create();
}

module.exports = { QuotationRouter, createQuotationRouter };
