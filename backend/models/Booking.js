const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, maxlength: 254 },
  phone: { type: String, default: '', maxlength: 40 },
  note: { type: String, default: '', maxlength: 2000 },
  /** YYYY-MM-DD in Asia/Kolkata */
  date: { type: String, required: true, index: true },
  /** HH:mm 24h IST — one of 18:00 / 19:00 / 20:00 / 21:00 */
  slot: { type: String, required: true },
  amountPaise: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['pending_payment', 'paid', 'payment_review', 'cancelled', 'completed'],
    default: 'pending_payment',
    index: true,
  },
  razorpayOrderId: { type: String, default: '', index: true },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySignature: { type: String, default: '' },
  paidAt: Date,
  // Only the current reservation or confirmed booking owns this unique key.
  slotKey: { type: String },
  holdExpiresAt: Date,
  emailOwnerStatus: { type: String, enum: ['sending', 'sent', 'failed'] },
  emailOwnerClaimedAt: Date,
  emailVisitorStatus: { type: String, enum: ['sending', 'sent', 'failed'] },
  emailVisitorClaimedAt: Date,
  ip: { type: String, default: '' },
  assignedTo: String,
  meetingUrl: String,
  adminNotes: String,
}, { timestamps: true });

BookingSchema.index({ date: 1, slot: 1, status: 1 });
BookingSchema.index({ status: 1, createdAt: -1, _id: -1 });
BookingSchema.index({ createdAt: -1, _id: -1 });
BookingSchema.index({ slotKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Booking', BookingSchema);
