const crypto = require('crypto');
const Invite = require('../models/QuotationInvitation');
const Quote = require('../models/Quotation');
const { httpError } = require('./bookingValidation');
const { sendQuotationInvitation, bookingSmtpReady } = require('./mailer');
function token(invite) {
  const key = process.env.QUOTATION_INVITE_SECRET;
  if (!/^[a-f\d]{64}$/i.test(key || '')) throw httpError(503, 'Invitation link recovery is not configured.');
  return crypto.createHmac('sha256', Buffer.from(key, 'hex')).update(`quotation-invite:${invite._id}:${invite.quotationId}`).digest('hex');
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
async function create(q, label = '', email = false) {
  if (typeof label !== 'string' || label.length > 100 || typeof email !== 'boolean') throw httpError(400, 'Invalid invitation options.');
  if (await Invite.countDocuments({ quotationId: q._id, revokedAt: null, expiresAt: { $gt: new Date() } }) >= 50)
    throw httpError(409, 'Revoke an unused invitation before creating another. Up to 50 active links are supported per quotation.');
  const invite = new Invite({ quotationId: q._id, label: label.trim() || 'Client invitation',
    expiresAt: new Date(Date.now() + 365 * 86400000), emailStatus: email ? 'pending' : 'disabled' });
  const value = token(invite); invite.tokenHash = hash(value); await invite.save();
  return { invite, token: value };
}
async function list(quotationId) {
  return Invite.find({ quotationId }).sort({ revokedAt: 1, createdAt: -1 }).limit(100).select('-tokenHash -emailClaim').lean();
}
async function owned(quotationId, id, active = false) {
  if (!/^[a-f\d]{24}$/i.test(id || '')) throw httpError(404, 'Invitation not found.');
  const invite = await Invite.findOne({ _id: id, quotationId, ...(active ? { revokedAt: null, expiresAt: { $gt: new Date() } } : {}) });
  if (!invite) throw httpError(404, 'Invitation not found or no longer active.');
  return invite;
}
async function notify(invite, send = sendQuotationInvitation) {
  if (!bookingSmtpReady()) return;
  const claim = crypto.randomUUID();
  const row = await Invite.findOneAndUpdate({ _id: invite._id, revokedAt: null, expiresAt: { $gt: new Date() },
    $and: [{ $or: [{ emailNextAttemptAt: { $exists: false } }, { emailNextAttemptAt: { $lte: new Date() } }] }],
    $or: [{ emailStatus: { $in: ['pending', 'failed'] } }, { emailStatus: 'sending', emailClaimedAt: { $lt: new Date(Date.now() - 300000) } }] },
  { $set: { emailStatus: 'sending', emailClaim: claim, emailClaimedAt: new Date() }, $inc: { emailAttempts: 1 } }, { new: true });
  if (!row) return;
  try {
    const q = await Quote.findById(row.quotationId).lean();
    if (q?.status === 'draft') {
      await Invite.updateOne({ _id: row._id, emailClaim: claim }, { $set: { emailStatus: 'pending' } }); return;
    }
    if (!q || !['invited', 'accepted'].includes(q.status)) {
      await Invite.updateOne({ _id: row._id, emailClaim: claim }, { $set: { emailStatus: 'disabled' } }); return;
    }
    await send(q, `${process.env.PUBLIC_URL || 'https://pratyushes.dev'}/proposal#${token(row)}`, String(row._id));
    await Invite.updateOne({ _id: row._id, emailClaim: claim }, { $set: { emailStatus: 'sent', emailSentAt: new Date() } });
  } catch {
    await Invite.updateOne({ _id: row._id, emailClaim: claim }, { $set: { emailStatus: 'failed',
      emailNextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(6, row.emailAttempts - 1))) } });
  }
}
async function retry() {
  if (!bookingSmtpReady()) return;
  for (const invite of await Invite.find({ revokedAt: null, expiresAt: { $gt: new Date() }, $or: [
    { emailStatus: { $in: ['pending', 'failed'] }, $or: [{ emailNextAttemptAt: { $exists: false } }, { emailNextAttemptAt: { $lte: new Date() } }] },
    { emailStatus: 'sending', emailClaimedAt: { $lt: new Date(Date.now() - 300000) } },
  ] }).sort({ createdAt: 1 }).limit(25)) await notify(invite);
}
module.exports = { create, list, owned, token, notify, retry };
