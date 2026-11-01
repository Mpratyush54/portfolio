const mongoose = require('mongoose');
const Quote = require('./Quotation');
const Invitation = require('./QuotationInvitation');
const { httpError } = require('../shared/errors');
const quotationTemplate = require('./template');
const { cleanEditor } = require('./text');
const { validate } = require('./validate');
const { LABELS, snapshot } = require('./helpers');
const { isUuid, isMongoObjectId } = require('../shared/text');

class QuotationDraftService {
  constructor(svc) {
    this.svc = svc;
  }

  async create(body) {
      this.svc.ready();
      return this.svc.view(
        await Quote.create({ ...validate(body), draftReady: true }),
        true,
      );
    }

  async edit(id, body) {
        const q = await this.svc.get(id);
        if (q.status !== 'draft')
          throw httpError(409, 'Only drafts can be edited here. Use the payment plan adjustment for active quotations.');
        if (body.version !== q.__v)
          throw httpError(409, 'Reload the latest draft.');
        Object.assign(q, validate(body));
        q.draftReady = true;
        q.draftValidation = undefined;
        q.draftEditor = undefined;
        return this.svc.view(await this.svc.save(q), true);
      }

  async updateSchedule(id, body = {}) {
        const q = await this.svc.get(id);
        if (q.status === 'cancelled')
          throw httpError(409, 'This quotation has been superseded.');
        if (!['draft', 'invited', 'accepted'].includes(q.status))
          throw httpError(409, 'This quotation cannot be changed.');
        if (body.version !== q.__v)
          throw httpError(409, 'Reload the quotation before changing the payment plan.');
        if (q.milestones.some((m) =>
          m.paidAt || m.orderId || m.orderBusy || (m.payments || []).length ||
          m.collectionPaise || (m.collections || []).length
        ))
          throw httpError(
            409,
            'Payments or payment arrangements have started. Create a revision instead.',
          );
        const schedule = require('../payments/plan').plan(body.paymentSchedule);
        let allocated = 0;
        const milestones = schedule.map(({ percent, timing }, i) => {
          const amountPaise =
            i === 3
              ? q.totalPaise - allocated
              : Math.floor((q.totalPaise * percent) / 100);
          allocated += amountPaise;
          if (amountPaise < 100)
            throw httpError(400, 'Each phase must be at least ₹1.');
          const previous = q.milestones[i];
          return {
            label: LABELS[i],
            percent,
            amountPaise,
            timing,
            ...(previous?.releasedAt ? { releasedAt: previous.releasedAt } : {}),
            ...(previous?.approvedAt ? { approvedAt: previous.approvedAt } : {}),
            ...(previous?.evidence ? { evidence: previous.evidence } : {}),
            ...(previous?.feedback ? { feedback: previous.feedback } : {}),
          };
        });
        if (
          q.minimumOnboardingPaise &&
          milestones[0].amountPaise < q.minimumOnboardingPaise
        )
          throw httpError(
            400,
            'The onboarding phase is below the agreed minimum payment. Increase its share.',
          );
        let terms;
        if (q.builder) {
          terms = quotationTemplate.compile(q.builder, schedule).terms;
        } else {
          const marker =
            '\n\nPayment schedule for this quotation (takes precedence over any generic phase percentages above)\n';
          const minimumMarker = '\n\nMinimum onboarding payment:';
          const start = q.terms.indexOf(marker);
          const base = (start >= 0 ? q.terms.slice(0, start) : q.terms).split(minimumMarker)[0];
          terms =
            base +
            marker +
            require('../payments/plan').wording(schedule);
        }
        if (q.minimumOnboardingPaise)
          terms += `\n\nMinimum onboarding payment: ₹${(q.minimumOnboardingPaise / 100).toLocaleString('en-IN')}. The onboarding phase cannot be collected below this amount.`;
        if (terms.length > 14000)
          throw httpError(400, 'Terms and payment schedule exceed 14000 characters.');
        q.milestones = milestones;
        q.terms = terms;
        q.draftReady = true;
        q.draftValidation = undefined;
        if (q.draftEditor) q.draftEditor.paymentSchedule = schedule;
        return this.svc.view(await this.svc.save(q), true);
      }

  async saveDraft(body) {
      this.svc.ready();
      if (
        !isUuid(body.clientDraftId, { requireVariant: false }) ||
        !isUuid(body.mutationId, { requireVariant: false }) ||
        !body.editor ||
        Array.isArray(body.editor) ||
        typeof body.editor !== 'object'
      )
        throw httpError(400, 'Invalid draft request.');
      if (JSON.stringify(body.editor).length > 40000)
        throw httpError(413, 'Draft is too large.');
      const allowed = [
        'title',
        'clientName',
        'clientEmail',
        'seller',
        'scope',
        'exclusions',
        'timeline',
        'terms',
        'builder',
        'totalRupees',
        'minimumOnboardingRupees',
        'validDate',
        'paymentSchedule',
      ];
      const editor = cleanEditor(
        Object.fromEntries(
          allowed
            .filter((key) => body.editor[key] !== undefined)
            .map((key) => [key, body.editor[key]]),
        ),
      );
      let q = body.id
        ? await this.svc.get(body.id)
        : await Quote.findOne({ clientDraftId: body.clientDraftId });
      if (q?.lastDraftMutation === body.mutationId) return this.svc.view(q, true);
      if (q && (q.status !== 'draft' || q.__v !== body.version))
        throw httpError(
          409,
          'This draft changed elsewhere. Reload it before saving again.',
        );
      const isNew = !q;
      if (!q)
        q = new Quote({
          clientDraftId: body.clientDraftId,
          status: 'draft',
          title: 'Untitled quotation',
          validUntil: new Date(Date.now() + 14 * 86400000),
          milestones: [],
        });
      q.draftEditor = editor;
      q.lastDraftMutation = body.mutationId;
      q.title =
        typeof editor.title === 'string' && editor.title.trim()
          ? editor.title.trim().slice(0, 160)
          : 'Untitled quotation';
      q.clientName =
        typeof editor.clientName === 'string'
          ? editor.clientName.slice(0, 120)
          : '';
      q.clientEmail =
        typeof editor.clientEmail === 'string'
          ? editor.clientEmail.slice(0, 254)
          : '';
      q.draftReady = false;
      q.draftValidation = undefined;
      try {
        const paise = Number(editor.totalRupees) * 100;
        if (Math.abs(paise - Math.round(paise)) > 0.000001)
          throw httpError(400, 'Use whole paise.');
        Object.assign(
          q,
          validate({
            ...editor,
            totalPaise: Math.round(paise),
            validUntil: `${editor.validDate}T23:59:59+05:30`,
          }),
        );
        q.draftReady = true;
        q.draftValidation = undefined;
      } catch (error) {
        if (error.status !== 400) throw error;
        q.draftValidation = error.message;
      }
      try {
        return this.svc.view(await this.svc.save(q), true);
      } catch (error) {
        if (isNew && error.code === 11000) {
          const existing = await Quote.findOne({
            clientDraftId: body.clientDraftId,
          });
          if (existing?.lastDraftMutation === body.mutationId)
            return this.svc.view(existing, true);
          throw httpError(409, 'Draft already exists. Reload the draft list.');
        }
        throw error;
      }
    }

  async revise(id) {
        const q = await this.svc.get(id);
        if (q.status === 'draft')
          throw httpError(
            409,
            'This quotation is already a draft. Edit it instead of creating a revision.',
          );
        if (q.status === 'cancelled')
          throw httpError(409, 'This quotation already has a replacement.');
  
      // Paid contracts require an explicit change order; never silently replace them.
      if (q.milestones.some((m) => m.paidAt || m.orderId || m.orderBusy || m.payments.length))
        throw httpError(
          409,
          'Payments have started. Create a separate change quotation.',
        );
      const data = snapshot(q);
      if (q.draftReady === false)
        throw httpError(409, 'Finish this draft before creating a revision.');
      if (q.srs?.length) data.srs = q.srs.map((s) => s.toObject());
      if (q.builder) data.builder = q.builder;
      delete data.milestones;
      data.validUntil = new Date(Date.now() + 14 * 86400000);
      const revised = await Quote.create({
        ...data,
        milestones: q.milestones.map((m) => ({
          label: m.label,
          percent: m.percent,
          amountPaise: m.amountPaise,
          ...(m.timing ? { timing: m.timing } : {}),
        })),
        revision: q.revision + 1,
        previousId: q._id,
      });
      q.status = 'cancelled';
      q.tokenHash = undefined;
      try {
        await this.svc.save(q);
      } catch (error) {
        await Quote.deleteOne({ _id: revised._id });
        throw error;
      }
      return this.svc.view(revised);
    }

  async deleteDraft(id) {
      this.svc.ready();
      if (!isMongoObjectId(id))
        throw httpError(404, 'Quotation not found.');
      const q = await Quote.findOne({ _id: id, status: 'draft' }).select('_id srs');
      if (!q) {
        if (await Quote.exists({ _id: id }))
          throw httpError(
            409,
            'Only drafts can be deleted. Invited and accepted quotations must be kept.',
          );
        throw httpError(404, 'Quotation not found.');
      }
      const deleted = await Quote.deleteOne({ _id: q._id, status: 'draft' });
      if (!deleted.deletedCount)
        throw httpError(409, 'The draft changed. Refresh and try again.');
      await Promise.all([
        Invitation.deleteMany({ quotationId: q._id }),
        require('../payments/PaymentReceipt').deleteMany({ quotationId: q._id }),
      ]);
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'quotationSrs',
      });
      for (const file of q.srs || []) {
        if (!(await Quote.exists({ 'srs.fileId': file.fileId })))
          await bucket.delete(file.fileId).catch(() => {});
      }
      return { success: true, _id: String(q._id) };
    }
}

module.exports = { QuotationDraftService };
