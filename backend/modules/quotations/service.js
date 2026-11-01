const mongoose = require('mongoose');
const Quote = require('./Quotation');
const Invitation = require('./QuotationInvitation');
const { httpError } = require('../shared/errors');
const quotationTemplate = require('./template');
const { hash, digest, DEFAULT_TERMS, paidAmount, payableAmount } = require('./helpers');
const { validate } = require('./validate');
const { QuotationDraftService } = require('./draft-service');
const { QuotationPortalService } = require('./portal-service');
const { QuotationPaymentService } = require('./payment-service');
const { isMongoObjectId, isSha256Hex } = require('../shared/text');

class QuotationService {
  constructor({ gateway, analytics = { capture: () => false } }) {
    this.gateway = gateway;
    this.analytics = analytics;
    this.draft = new QuotationDraftService(this);
    this.portalService = new QuotationPortalService(this);
    this.payment = new QuotationPaymentService(this);
    this.defaults = DEFAULT_TERMS;
  }

  ready() {
    if (mongoose.connection.readyState !== 1) {
      throw httpError(503, 'Quotation storage is unavailable.');
    }
  }

  async get(id) {
    this.ready();
    if (!isMongoObjectId(id)) throw httpError(404, 'Quotation not found.');
    const quote = await Quote.findById(id);
    if (!quote) throw httpError(404, 'Quotation not found.');
    return quote;
  }

  async save(quote) {
    try {
      return await quote.save();
    } catch (error) {
      if (error.name === 'VersionError') {
        throw httpError(409, 'This quotation changed. Reload before trying again.');
      }
      throw error;
    }
  }

  async portal(token) {
    this.ready();
    if (typeof token !== 'string' || !isSha256Hex(token)) {
      throw httpError(404, 'Invitation not found.');
    }
    const invitation = await Invitation.findOne({
      tokenHash: hash(token),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    const quote = await Quote.findOne({
      ...(invitation
        ? { _id: invitation.quotationId }
        : { tokenHash: hash(token), tokenExpiresAt: { $gt: new Date() } }),
      status: { $in: ['invited', 'accepted'] },
    });
    if (!quote) throw httpError(404, 'Invitation expired or revoked. Ask for a new link.');
    return quote;
  }

  view(quote, admin = false) {
    const data = quote.toObject();
    delete data.tokenHash;
    delete data.clientDraftId;
    delete data.lastDraftMutation;
    if (!admin) delete data.draftEditor;
    if (!quote.acceptance?.at) delete data.acceptance;
    data.digest = digest(quote);
    data.paymentsEnabled = Boolean(this.gateway() && process.env.RAZORPAY_WEBHOOK_SECRET);
    data.milestones.forEach((milestone) => {
      milestone.paidPaise = paidAmount(milestone);
      milestone.remainingPaise = milestone.amountPaise - milestone.paidPaise;
      milestone.payablePaise = milestone.paidAt ? 0 : payableAmount(milestone);
      delete milestone.orderBusy;
      delete milestone.orderLock;
      delete milestone.orderLockedAt;
    });
    return data;
  }

  create(body) { return this.draft.create(body); }
  saveDraft(body) { return this.draft.saveDraft(body); }
  edit(id, body) { return this.draft.edit(id, body); }
  updateSchedule(id, body) { return this.draft.updateSchedule(id, body); }
  deleteDraft(id) { return this.draft.deleteDraft(id); }
  revise(id) { return this.draft.revise(id); }

  invite(id, version, options) { return this.portalService.invite(id, version, options); }
  revoke(id) { return this.portalService.revoke(id); }
  accept(token, body) { return this.portalService.accept(token, body); }
  release(id, index, evidence) { return this.portalService.release(id, index, evidence); }
  review(token, index, body) { return this.portalService.review(token, index, body); }

  order(token, index, correlationId) { return this.payment.order(token, index, correlationId); }
  collection(id, index, body) { return this.payment.collection(id, index, body); }
  confirm(orderId, paymentId, attempt) { return this.payment.confirm(orderId, paymentId, attempt); }
  verify(token, body) { return this.payment.verify(token, body); }
  webhook(raw, signature) { return this.payment.webhook(raw, signature); }

  async template() {
    this.ready();
    const builder = quotationTemplate.defaults();
    const recent = await Quote.findOne({ 'builder.provider.name': { $exists: true, $ne: '' } })
      .sort({ updatedAt: -1 })
      .select('builder.provider')
      .lean();
    if (recent?.builder?.provider) builder.provider = recent.builder.provider;
    return { terms: DEFAULT_TERMS, catalog: quotationTemplate.catalog, builder };
  }

  preview(builder, schedule) {
    return quotationTemplate.compile(builder, schedule);
  }

  async page(query) {
    this.ready();
    return require('../admin/lists').page(Quote, query, ['draft', 'invited', 'accepted', 'cancelled'], {
      sortField: 'updatedAt',
      select: 'title clientName clientEmail status revision totalPaise draftReady updatedAt createdAt __v',
      searchFields: ['title', 'clientName', 'clientEmail'],
    });
  }

  async list() {
    this.ready();
    return (await Quote.find().sort({ updatedAt: -1 }).limit(100)).map((quote) => this.view(quote, true));
  }
}

function createQuotationService(deps) {
  return new QuotationService(deps);
}

module.exports = { QuotationService, createQuotationService, validate, digest, DEFAULT_TERMS };
