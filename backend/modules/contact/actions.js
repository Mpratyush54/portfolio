const { randomUUID } = require('crypto');
const Contact = require('./ContactMessage');
const { httpError } = require('../shared/errors');
const { isMongoObjectId } = require('../shared/text');

class ContactActions {
  constructor({ sendEmail }) {
    this.sendEmail = sendEmail;
  }

  requireId(id) {
    if (!isMongoObjectId(id)) throw httpError(400, 'Invalid contact ID.');
  }

  staleClaim() {
    return new Date(Date.now() - 5 * 60_000);
  }

  pendingAndFree(id) {
    return {
      _id: id,
      status: 'pending',
      $or: [
        { approvalClaim: { $exists: false } },
        { approvalClaimAt: { $lt: this.staleClaim() } },
      ],
    };
  }

  async load(id) {
    this.requireId(id);
    const row = await Contact.findById(id);
    if (!row) throw httpError(404, 'Contact not found.');
    return row;
  }

  async approve(id) {
    const existing = await this.load(id);
    if (existing.status === 'approved' && existing.emailSentAt) {
      return { success: true, message: 'Already approved and emailed.' };
    }
    if (existing.status !== 'pending') {
      throw httpError(409, 'Only pending contacts can be approved.');
    }
    const token = randomUUID();
    const claim = await Contact.findOneAndUpdate(
      this.pendingAndFree(id),
      { $set: { approvalClaim: token, approvalClaimAt: new Date() } },
      { new: true },
    );
    if (!claim) throw httpError(409, 'This contact is already being processed.');
    try {
      await this.sendEmail(claim);
      await Contact.updateOne(
        { _id: id, approvalClaim: token },
        {
          $set: { status: 'approved', approvedAt: new Date(), emailSentAt: new Date() },
          $unset: { approvalClaim: 1, approvalClaimAt: 1 },
        },
      );
      return { success: true, message: 'Thank-you email sent to visitor.' };
    } catch {
      await Contact.updateOne(
        { _id: id, approvalClaim: token },
        { $unset: { approvalClaim: 1, approvalClaimAt: 1 } },
      );
      throw httpError(502, 'Could not send the email. Check SMTP settings and retry.');
    }
  }

  async reject(id) {
    const existing = await this.load(id);
    if (existing.status === 'rejected') return { success: true };
    if (existing.status !== 'pending') {
      throw httpError(409, 'Only pending contacts can be rejected.');
    }
    const changed = await Contact.findOneAndUpdate(
      this.pendingAndFree(id),
      {
        $set: { status: 'rejected', rejectedAt: new Date() },
        $unset: { approvalClaim: 1, approvalClaimAt: 1 },
      },
    );
    if (!changed) throw httpError(409, 'This contact is already being processed.');
    return { success: true };
  }
}

function createContactActions(deps) {
  return new ContactActions(deps);
}

module.exports = { ContactActions, createContactActions };
