const Invitation = require('./QuotationInvitation');
const invitations = require('./invitations');
const { httpError } = require('../shared/errors');
const { ACKS, digest } = require('./helpers');

class QuotationPortalService {
  constructor(svc) {
    this.svc = svc;
  }

  async invite(id, version, options = {}) {
      const q = await this.svc.get(id);
      if (q.draftReady === false)
        throw httpError(
          409,
          'Complete the required fields before inviting the client.',
        );
      if (version !== q.__v)
        throw httpError(
          409,
          'Reload and review the current quotation before creating an invitation.',
        );
      if (q.status === 'cancelled')
        throw httpError(409, 'Quotation is cancelled.');
      if (q.status !== 'accepted' && q.validUntil <= new Date())
        throw httpError(409, 'Update the expired quotation first.');
      const requestedLabel =
        typeof options.label === 'string' ? options.label.trim() : '';
      const label =
        requestedLabel || String(q.title || '').trim().slice(0, 100);
      const created = await invitations.create(q, label, options.sendEmail ?? false);
      const token = created.token;
      if (q.status === 'draft') q.status = 'invited';
      try { await this.svc.save(q); } catch (e) { await Invitation.deleteOne({ _id: created.invite._id }); throw e; }
      if (options.sendEmail) invitations.notify(
        created.invite,
        undefined,
        this.svc.analytics,
      ).catch(() => {});
      return { token, invitation: created.invite._id, quotation: this.svc.view(q) };
    }

  async revoke(id) {
      const q = await this.svc.get(id);
      q.tokenHash = undefined;
      q.tokenExpiresAt = undefined;
      await this.svc.save(q);
      await Invitation.updateMany({ quotationId: q._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
      return this.svc.view(q);
    }

  async accept(token, body) {
      const q = await this.svc.portal(token);
      if (q.status === 'accepted') return this.svc.view(q);
      if (q.validUntil <= new Date())
        throw httpError(410, 'This quotation has expired.');
      if (body.digest !== digest(q))
        throw httpError(
          409,
          'Terms changed. Reload and read the current quotation.',
        );
      if (
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.length > 120 ||
        typeof body.email !== 'string' ||
        body.email.trim().toLowerCase() !== q.clientEmail ||
        !Array.isArray(body.acknowledgements) ||
        !ACKS.every((a) => body.acknowledgements.includes(a))
      )
        throw httpError(
          400,
          'Confirm your name, invited email and every acknowledgement.',
        );
      q.acceptance = {
        name: body.name.trim(),
        email: q.clientEmail,
        at: new Date(),
        digest: digest(q),
        version: q.revision,
        acknowledgements: ACKS,
      };
      q.status = 'accepted';
      q.milestones[0].releasedAt = new Date();
      q.milestones[0].approvedAt = new Date();
      return this.svc.view(await this.svc.save(q));
    }

  async release(id, index, evidence) {
      const q = await this.svc.get(id);
      index = Number(index);
      if (
        q.status !== 'accepted' ||
        !Number.isInteger(index) ||
        index < 1 ||
        index > 3 ||
        !q.milestones[index - 1].paidAt
      )
        throw httpError(409, 'The previous phase must be paid first.');
      const m = q.milestones[index];
      if (m.approvedAt || m.paidAt)
        throw httpError(409, 'This milestone is already approved.');
      if (
        typeof evidence !== 'string' ||
        evidence.trim().length < 10 ||
        evidence.length > 3000
      )
        throw httpError(
          400,
          'Describe the delivery and provide review or deployment details.',
        );
      m.evidence = evidence.trim();
      m.releasedAt = new Date();
      m.feedback = '';
      if (index === 3 && !q.deployedAt) {
        q.deployedAt = new Date();
        q.supportEndsAt = new Date(q.deployedAt.getTime() + 30 * 86400000);
      }
      return this.svc.view(await this.svc.save(q));
    }

  async review(token, index, body) {
      const q = await this.svc.portal(token);
      index = Number(index);
      const m = q.milestones[index];
      if (body.version !== q.__v)
        throw httpError(
          409,
          'Delivery details changed. Refresh and review them before approving.',
        );
      if (
        q.status !== 'accepted' ||
        !Number.isInteger(index) ||
        index < 1 ||
        index > 3 ||
        !m?.releasedAt ||
        m.approvedAt
      )
        throw httpError(409, 'Milestone is not awaiting review.');
      if (body.approve === true) m.approvedAt = new Date();
      else {
        if (
          typeof body.feedback !== 'string' ||
          body.feedback.trim().length < 5 ||
          body.feedback.length > 3000
        )
          throw httpError(400, 'Describe the changes needed.');
        m.feedback = body.feedback.trim();
        m.releasedAt = undefined;
      }
      return this.svc.view(await this.svc.save(q));
    }
}

module.exports = { QuotationPortalService };
