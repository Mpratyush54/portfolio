const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  paymentId: { type: String, unique: true, required: true }, orderId: String,
  quotationId: mongoose.Schema.Types.ObjectId, name: String, email: String,
  title: String, phase: String, amountPaise: Number, balancePaise: Number, paidAt: Date,
  status: { type: String, enum: ['pending', 'sending', 'sent', 'failed'], default: 'pending' },
  claim: String, claimedAt: Date, sentAt: Date,
  attempts: { type: Number, default: 0 }, nextAttemptAt: Date,
}, { timestamps: true });
schema.index({ status: 1, createdAt: 1 });
module.exports = mongoose.model('PaymentReceipt', schema);
