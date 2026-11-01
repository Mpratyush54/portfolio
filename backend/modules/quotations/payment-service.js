const crypto = require('crypto');
const Quote = require('./Quotation');
const { httpError } = require('../shared/errors');
const { validSignature, validId, parseWebhook, onceCaptured } = require('../payments/security');
const { paidAmount, payableAmount } = require('./helpers');
const { correlationId, validCorrelationId } = require('../analytics/PostHogService');

class QuotationPaymentService {
  constructor(svc) {
    this.svc = svc;
  }

  async order(token, index, requestedCorrelationId) {
      const q = await this.svc.portal(token);
      index = Number(index);
      const m = q.milestones[index];
      if (
        q.status !== 'accepted' ||
        !Number.isInteger(index) ||
        !m ||
        !m.approvedAt ||
        m.paidAt ||
        (index > 0 && !q.milestones[index - 1].paidAt)
      )
        throw httpError(409, 'This instalment is not payable.');
      const api = this.svc.gateway();
      if (!api || !process.env.RAZORPAY_WEBHOOK_SECRET)
        throw httpError(503, 'Payments are not enabled yet.');
      if (requestedCorrelationId !== undefined && !validCorrelationId(requestedCorrelationId))
        throw httpError(400, 'Invalid correlation ID.');
      const requestCorrelationId = m.correlationId || correlationId(requestedCorrelationId);
      const result = (id) => ({
        orderId: id,
        correlationId: requestCorrelationId,
        amountPaise: payableAmount(m),
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        index,
      });
      if (m.orderId) {
        if (!m.correlationId) {
          await Quote.updateOne({ _id: q._id, [`milestones.${index}.orderId`]: m.orderId }, {
            $set: { [`milestones.${index}.correlationId`]: requestCorrelationId },
          });
        }
        const payments = await api.orders.fetchPayments(m.orderId);
        const captured = payments.items.find((p) => p.status === 'captured');
        if (captured) {
          await this.confirm(m.orderId, captured.id);
          return { alreadyPaid: true, quotation: this.svc.view(await this.svc.portal(token)) };
        }
        // Do not issue a competing order while a previous attempt can still capture.
        if (payments.items.some((p) => p.status !== 'failed'))
          throw httpError(409, 'A payment is processing. Wait and refresh its status before trying again.');
        return result(m.orderId);
      }
      const lockToken = crypto.randomUUID();
      const lock = await Quote.updateOne(
        {
          _id: q._id,
          __v: q.__v,
          status: 'accepted',
          $or: [
            { [`milestones.${index}.orderBusy`]: { $ne: true } },
            {
              [`milestones.${index}.orderLockedAt`]: {
                $lt: new Date(Date.now() - 5 * 60000),
              },
            },
          ],
        },
        {
          $set: {
            [`milestones.${index}.orderBusy`]: true,
            [`milestones.${index}.orderLock`]: lockToken,
            [`milestones.${index}.orderLockedAt`]: new Date(),
          },
          $inc: { __v: 1 },
        },
      );
      if (!lock.modifiedCount)
        throw httpError(
          409,
          'Payment preparation is in progress. Reload shortly.',
        );
      try {
        const created = await api.orders.create({
          amount: payableAmount(m),
          currency: 'INR',
          partial_payment: false,
          receipt: `q${q._id}_${index}_${(m.payments || []).length}`,
          notes: {
            quotationId: String(q._id), milestone: String(index), correlationId: requestCorrelationId,
          },
        });
        const saved = await Quote.updateOne(
          { _id: q._id, [`milestones.${index}.orderLock`]: lockToken },
          {
            $set: {
              [`milestones.${index}.orderId`]: created.id,
              [`milestones.${index}.orderAmountPaise`]: payableAmount(m),
              [`milestones.${index}.correlationId`]: requestCorrelationId,
              [`milestones.${index}.orderBusy`]: false,
            },
            $unset: { [`milestones.${index}.orderLock`]: 1 },
            $inc: { __v: 1 },
          },
        );
        if (!saved.modifiedCount)
          throw httpError(
            409,
            'Payment preparation expired. Reload before trying again.',
          );
        this.svc.analytics.capture('quotation_order_created', {
          correlation_id: requestCorrelationId, event_source: 'api', outcome: 'created',
          payment_kind: 'quotation', milestone_index: index,
        }, 'backend:quotation');
        return result(created.id);
      } catch (error) {
        await Quote.updateOne(
          { _id: q._id, [`milestones.${index}.orderLock`]: lockToken },
          {
            $set: { [`milestones.${index}.orderBusy`]: false },
            $unset: { [`milestones.${index}.orderLock`]: 1 },
            $inc: { __v: 1 },
          },
        );
        this.svc.analytics.capture('quotation_order_failed', {
          correlation_id: requestCorrelationId, event_source: 'api', outcome: 'failed',
          payment_kind: 'quotation', milestone_index: index,
        }, 'backend:quotation');
        throw error;
      }
    }

  async collection(id, index, body) {
      const q = await this.svc.get(id);
      index = Number(index);
      const m = q.milestones[index];
      if (body.version !== q.__v) throw httpError(409, 'Reload the latest payment status.');
      const invitedOnboarding = q.status === 'invited' && index === 0 && q.validUntil > new Date();
      if (!Number.isInteger(index) || !m || m.paidAt || (!invitedOnboarding && (q.status !== 'accepted' || !m.approvedAt)) ||
          (index > 0 && !q.milestones[index - 1].paidAt))
        throw httpError(409, 'This milestone is not payable.');
      // An issued order can still capture later. Never replace its amount.
      if (m.orderId || m.orderBusy) throw httpError(409, 'Checkout already prepared. Its payment must be reconciled before changing the amount.');
      const remaining = m.amountPaise - paidAmount(m);
      if (!Number.isSafeInteger(body.amountPaise) || body.amountPaise < 100 || body.amountPaise > remaining ||
          (remaining - body.amountPaise > 0 && remaining - body.amountPaise < 100))
        throw httpError(400, 'Enter at least ₹1, no more than the balance, leaving either zero or at least ₹1 due.');
      const minimumOnboardingPaise = index === 0 ? Number(q.minimumOnboardingPaise || 0) : 0;
      if (minimumOnboardingPaise && body.amountPaise < Math.min(minimumOnboardingPaise, remaining))
        throw httpError(400, `The onboarding payment for this quotation must be at least ₹${(minimumOnboardingPaise / 100).toLocaleString('en-IN')}.`);
      if (typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.length > 500)
        throw httpError(400, 'Provide a reason (5–500 characters) for the collection arrangement.');
      m.collectionPaise = body.amountPaise;
      m.collections.push({ amountPaise: body.amountPaise, reason: body.reason.trim(), at: new Date() });
      return this.svc.view(await this.svc.save(q), true);
    }

  async confirm(orderId, paymentId, attempt = 0, eventSource = 'verification') {
      this.svc.ready();
      if (typeof orderId !== 'string' || typeof paymentId !== 'string')
        throw httpError(400, 'Invalid payment identifiers.');
      const q = await Quote.findOne({ $or: [{ 'milestones.orderId': orderId }, { 'milestones.payments.orderId': orderId }] });
      if (!q) return false;
      const index = q.milestones.findIndex((m) => m.orderId === orderId || m.payments.some((p) => p.orderId === orderId)),
        m = q.milestones[index];
      const recorded = m.payments.find((p) => p.orderId === orderId);
      const expected = recorded?.amountPaise ?? m.orderAmountPaise ?? m.amountPaise;
      const api = this.svc.gateway();
      if (!api) throw httpError(503, 'Payment verification unavailable.');
      const p = await api.payments.fetch(paymentId);
      if (
        !p || p.order_id !== orderId ||
        p.id !== paymentId ||
        p.amount !== expected ||
        p.currency !== 'INR' ||
        p.status !== 'captured' ||
        p.captured !== true ||
        (p.amount_refunded || 0) !== 0
      )
        throw httpError(409, 'Payment is not captured for this instalment.');
      if (recorded || m.paidAt) {
        if ((recorded?.paymentId ?? m.paymentId) !== paymentId)
          throw httpError(409, 'Payment requires manual reconciliation.');
        if (recorded) await require('../payments/receipts').record(q, index, recorded);
        this.svc.analytics.capture('quotation_reconciliation_recovered', {
          ...(m.correlationId ? { correlation_id: m.correlationId } : {}),
          event_source: eventSource, outcome: 'recovered',
          payment_kind: 'quotation', milestone_index: index,
        }, 'backend:quotation');
        return true;
      }
      if (q.status !== 'accepted' || !m.approvedAt || (index > 0 && !q.milestones[index - 1].paidAt))
        throw httpError(409, 'Payment requires manual reconciliation.');
      const total = paidAmount(m) + expected;
      if (total > m.amountPaise) throw httpError(409, 'Payment exceeds the milestone balance.');
      const now = new Date();
      const complete = total === m.amountPaise;
      const updated = await Quote.updateOne(
        { _id: q._id, __v: q.__v, [`milestones.${index}.orderId`]: orderId },
        {
          $set: complete ? {
            [`milestones.${index}.paidAt`]: now,
            [`milestones.${index}.paymentId`]: paymentId,
          } : {},
          $push: { [`milestones.${index}.payments`]: { orderId, paymentId, amountPaise: expected, at: now } },
          $unset: {
            [`milestones.${index}.orderId`]: 1,
            [`milestones.${index}.orderAmountPaise`]: 1,
            [`milestones.${index}.collectionPaise`]: 1,
          },
          $inc: { __v: 1 },
        },
      );
      if (!updated.modifiedCount) {
        if (attempt >= 4) throw httpError(409, 'Payment status changed. Retry verification.');
        return this.confirm(orderId, paymentId, attempt + 1, eventSource);
      }
      await require('../payments/receipts').record(await Quote.findById(q._id), index,
        { orderId, paymentId, amountPaise: expected, at: now });
      this.svc.analytics.capture('quotation_verification_confirmed', {
        ...(m.correlationId ? { correlation_id: m.correlationId } : {}),
        event_source: eventSource, outcome: 'confirmed',
        payment_kind: 'quotation', milestone_index: index,
      }, 'backend:quotation');
      return true;
    }

  async verify(token, body) {
      let correlation;
      try {
        if (!body || Array.isArray(body) || !validId(body.razorpay_order_id, 'order') || !validId(body.razorpay_payment_id, 'pay'))
          throw httpError(400, 'Invalid payment identifiers.');
        const q = await this.svc.portal(token);
        const milestone = q.milestones.find((m) => m.orderId === body.razorpay_order_id
          || m.payments.some((p) => p.orderId === body.razorpay_order_id));
        correlation = milestone?.correlationId;
        if (!milestone || !validSignature(
          `${body.razorpay_order_id}|${body.razorpay_payment_id}`,
          body.razorpay_signature,
          process.env.RAZORPAY_KEY_SECRET,
        )) throw httpError(400, 'Invalid payment signature.');
        await this.confirm(body.razorpay_order_id, body.razorpay_payment_id, 0, 'verification');
        return this.svc.view(await this.svc.portal(token));
      } catch (error) {
        this.svc.analytics.capture('quotation_verification_failed', {
          ...(correlation ? { correlation_id: correlation } : {}),
          event_source: 'verification', outcome: 'failed',
          payment_kind: 'quotation',
        }, 'backend:quotation');
        throw error;
      }
    }

  async webhook(raw, signature) {
      let correlation;
      try {
        const event = parseWebhook(raw, signature);
        if (event.event !== 'payment.captured') {
          this.svc.analytics.capture('quotation_webhook_ignored', {
            event_source: 'webhook', outcome: 'ignored',
          }, 'backend:quotation');
          return { received: true };
        }
        const payment = event.payload?.payment?.entity;
        this.svc.ready();
        const q = await Quote.findOne({ $or: [
          { 'milestones.orderId': payment.order_id },
          { 'milestones.payments.orderId': payment.order_id },
        ] });
        correlation = q?.milestones.find((m) => m.orderId === payment.order_id
          || m.payments.some((p) => p.orderId === payment.order_id))?.correlationId;
        if (!q) {
          this.svc.analytics.capture('quotation_webhook_ignored', {
            event_source: 'webhook', outcome: 'ignored',
          }, 'backend:quotation');
          return { received: true };
        }
        const processed = await onceCaptured('quotation', payment,
          () => this.confirm(payment.order_id, payment.id, 0, 'webhook'));
        this.svc.analytics.capture(processed ? 'quotation_webhook_accepted' : 'quotation_webhook_ignored', {
          ...(correlation ? { correlation_id: correlation } : {}),
          event_source: 'webhook', outcome: processed ? 'accepted' : 'ignored',
          payment_kind: 'quotation',
        }, 'backend:quotation');
        return { received: true };
      } catch (error) {
        const rejected = error?.message === 'Invalid webhook signature.';
        this.svc.analytics.capture(rejected ? 'quotation_webhook_rejected' : 'quotation_webhook_failed', {
          ...(correlation ? { correlation_id: correlation } : {}),
          event_source: 'webhook', outcome: rejected ? 'rejected' : 'failed',
          payment_kind: 'quotation',
        }, 'backend:quotation');
        throw error;
      }
    }
}

module.exports = { QuotationPaymentService };
