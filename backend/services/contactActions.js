const { randomUUID } = require('crypto');
const Contact = require('../models/ContactMessage');
const store = require('./contactStore');
const { httpError } = require('./bookingValidation');

function createContactActions({ connected, sendEmail }) {
  function validId(id) {
    const regex = connected() ? /^[a-f0-9]{24}$/i : /^[a-f0-9-]{36}$/i;
    if (typeof id !== 'string' || !regex.test(id)) throw httpError(400, 'Invalid contact ID.');
  }
  async function approve(id) {
    validId(id);
    const token = randomUUID();
    const mongo = connected();
    const existing = mongo ? await Contact.findById(id) : store.findById(id);
    if (!existing) throw httpError(404, 'Contact not found.');
    if (existing.status === 'approved' && existing.emailSentAt) return { success: true, message: 'Already approved and emailed.' };
    if (existing.status !== 'pending') throw httpError(409, 'Only pending contacts can be approved.');
    const expiry = new Date(Date.now() - 5 * 60_000);
    const claim = mongo ? await Contact.findOneAndUpdate({ _id: id, status: 'pending', $or: [
      { approvalClaim: { $exists: false } }, { approvalClaimAt: { $lt: expiry } },
    ] }, { $set: { approvalClaim: token, approvalClaimAt: new Date() } }, { new: true })
      : (!existing.approvalClaim || new Date(existing.approvalClaimAt) < expiry)
        ? store.update(id, { approvalClaim: token, approvalClaimAt: new Date().toISOString() }) : null;
    if (!claim) throw httpError(409, 'This contact is already being processed.');
    try {
      await sendEmail(claim);
      const patch = { status: 'approved', approvedAt: new Date(), emailSentAt: new Date() };
      if (mongo) {
        await Contact.updateOne({ _id: id, approvalClaim: token }, { $set: patch, $unset: { approvalClaim: 1, approvalClaimAt: 1 } });
      } else store.update(id, { ...patch, approvalClaim: undefined, approvalClaimAt: undefined });
      return { success: true, message: 'Thank-you email sent to visitor.' };
    } catch (error) {
      if (mongo) await Contact.updateOne({ _id: id, approvalClaim: token }, { $unset: { approvalClaim: 1, approvalClaimAt: 1 } });
      else store.update(id, { approvalClaim: undefined, approvalClaimAt: undefined });
      throw httpError(502, 'Could not send the email. Check SMTP settings and retry.');
    }
  }
  async function reject(id) {
    validId(id);
    const existing = connected() ? await Contact.findById(id) : store.findById(id);
    if (!existing) throw httpError(404, 'Contact not found.');
    if (existing.status === 'rejected') return { success: true };
    if (existing.status !== 'pending') throw httpError(409, 'Only pending contacts can be rejected.');
    const patch = { status: 'rejected', rejectedAt: new Date() };
    const expiry = new Date(Date.now() - 5 * 60_000);
    const changed = connected() ? await Contact.findOneAndUpdate({ _id: id, status: 'pending', $or: [
      { approvalClaim: { $exists: false } }, { approvalClaimAt: { $lt: expiry } },
    ] }, { $set: patch, $unset: { approvalClaim: 1, approvalClaimAt: 1 } })
      : (!existing.approvalClaim || new Date(existing.approvalClaimAt) < expiry)
        ? store.update(id, { ...patch, approvalClaim: undefined, approvalClaimAt: undefined }) : null;
    if (!changed) throw httpError(409, 'This contact is already being processed.');
    return { success: true };
  }
  return { approve, reject };
}

module.exports = { createContactActions };
