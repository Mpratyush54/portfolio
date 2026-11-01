const crypto = require('crypto');
const Invite = require('./QuotationInvitation');
const Quote = require('./Quotation');
const { httpError } = require('../shared/errors');
const { sendQuotationInvitation, bookingSmtpReady } = require('../shared/mailer');
const { isMongoObjectId, isSha256Hex } = require('../shared/text');

class QuotationInvitations {
  static hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  static token(invite) {
    const key = process.env.QUOTATION_INVITE_SECRET;
    if (!isSha256Hex(key || '')) throw httpError(503, 'Invitation link recovery is not configured.');
    return crypto
      .createHmac('sha256', Buffer.from(key, 'hex'))
      .update(`quotation-invite:${invite._id}:${invite.quotationId}`)
      .digest('hex');
  }

  static async create(quote, label = '', email = false) {
    if (typeof label !== 'string' || label.length > 100 || typeof email !== 'boolean') {
      throw httpError(400, 'Invalid invitation options.');
    }
    const active = await Invite.countDocuments({
      quotationId: quote._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (active >= 50) {
      throw httpError(
        409,
        'Revoke an unused invitation before creating another. Up to 50 active links are supported per quotation.',
      );
    }
    const invite = new Invite({
      quotationId: quote._id,
      label: label.trim() || 'Client invitation',
      expiresAt: new Date(Date.now() + 365 * 86400000),
      emailStatus: email ? 'pending' : 'disabled',
    });
    const value = QuotationInvitations.token(invite);
    invite.tokenHash = QuotationInvitations.hash(value);
    await invite.save();
    return { invite, token: value };
  }

  static list(quotationId) {
    return Invite.find({ quotationId })
      .sort({ revokedAt: 1, createdAt: -1 })
      .limit(100)
      .select('-tokenHash -emailClaim')
      .lean();
  }

  static async owned(quotationId, id, active = false) {
    if (!isMongoObjectId(id)) throw httpError(404, 'Invitation not found.');
    const invite = await Invite.findOne({
      _id: id,
      quotationId,
      ...(active ? { revokedAt: null, expiresAt: { $gt: new Date() } } : {}),
    });
    if (!invite) throw httpError(404, 'Invitation not found or no longer active.');
    return invite;
  }

  static async notify(invite, send = sendQuotationInvitation, analytics = { capture: () => false }) {
    if (!bookingSmtpReady()) return;
    const claim = crypto.randomUUID();
    const row = await Invite.findOneAndUpdate(
      {
        _id: invite._id,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
        $and: [{ $or: [{ emailNextAttemptAt: { $exists: false } }, { emailNextAttemptAt: { $lte: new Date() } }] }],
        $or: [
          { emailStatus: { $in: ['pending', 'failed'] } },
          { emailStatus: 'sending', emailClaimedAt: { $lt: new Date(Date.now() - 300000) } },
        ],
      },
      { $set: { emailStatus: 'sending', emailClaim: claim, emailClaimedAt: new Date() }, $inc: { emailAttempts: 1 } },
      { new: true },
    );
    if (!row) return;
    try {
      const quote = await Quote.findById(row.quotationId).lean();
      if (quote?.status === 'draft') {
        await Invite.updateOne({ _id: row._id, emailClaim: claim }, { $set: { emailStatus: 'pending' } });
        return;
      }
      if (!quote || !['invited', 'accepted'].includes(quote.status)) {
        await Invite.updateOne({ _id: row._id, emailClaim: claim }, { $set: { emailStatus: 'disabled' } });
        return;
      }
      await send(quote, `${process.env.PUBLIC_URL || 'https://pratyushes.dev'}/proposal#${QuotationInvitations.token(row)}`, String(row._id));
      await Invite.updateOne(
        { _id: row._id, emailClaim: claim },
        { $set: { emailStatus: 'sent', emailSentAt: new Date() } },
      );
      analytics.capture('invitation_delivery_succeeded', {
        event_source: 'delivery',
        outcome: 'sent',
      }, 'backend:delivery');
    } catch {
      await Invite.updateOne(
        { _id: row._id, emailClaim: claim },
        {
          $set: {
            emailStatus: 'failed',
            emailNextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(6, row.emailAttempts - 1))),
          },
        },
      );
      analytics.capture(
        row.emailAttempts >= 7 ? 'invitation_delivery_exhausted' : 'invitation_delivery_retry',
        { event_source: 'delivery', outcome: row.emailAttempts >= 7 ? 'exhausted' : 'retry' },
        'backend:delivery',
      );
    }
  }

  static async retry(analytics) {
    if (!bookingSmtpReady()) return;
    const pending = await Invite.find({
      revokedAt: null,
      expiresAt: { $gt: new Date() },
      $or: [
        {
          emailStatus: { $in: ['pending', 'failed'] },
          $or: [{ emailNextAttemptAt: { $exists: false } }, { emailNextAttemptAt: { $lte: new Date() } }],
        },
        { emailStatus: 'sending', emailClaimedAt: { $lt: new Date(Date.now() - 300000) } },
      ],
      emailAttempts: { $lt: 7 },
    })
      .sort({ createdAt: 1 })
      .limit(25);
    for (const invite of pending) await QuotationInvitations.notify(invite, sendQuotationInvitation, analytics);
  }
}

module.exports = {
  QuotationInvitations,
  create: (quote, label, email) => QuotationInvitations.create(quote, label, email),
  list: (quotationId) => QuotationInvitations.list(quotationId),
  owned: (quotationId, id, active) => QuotationInvitations.owned(quotationId, id, active),
  token: (invite) => QuotationInvitations.token(invite),
  notify: (invite, send, analytics) => QuotationInvitations.notify(invite, send, analytics),
  retry: (analytics) => QuotationInvitations.retry(analytics),
};
