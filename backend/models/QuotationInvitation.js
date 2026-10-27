const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  quotationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  label: String,
  expiresAt: Date,
  revokedAt: Date,
  emailStatus: { type: String, enum: ['pending', 'sending', 'sent', 'failed', 'disabled'] },
  emailClaim: String,
  emailClaimedAt: Date,
  emailSentAt: Date,
  emailAttempts: { type: Number, default: 0 }, emailNextAttemptAt: Date,
}, { timestamps: true });
schema.index({ quotationId: 1, createdAt: -1 });
module.exports = mongoose.model('QuotationInvitation', schema);
