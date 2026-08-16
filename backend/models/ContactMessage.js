const mongoose = require('mongoose');

const ContactMessageSchema = new mongoose.Schema({
  intent: {
    type: String,
    enum: ['hire', 'freelance', 'hi'],
    required: true,
  },
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, maxlength: 254 },
  phone: { type: String, default: '', maxlength: 40 },
  company: { type: String, default: '', maxlength: 120 },
  message: { type: String, required: true, maxlength: 5000 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  ip: { type: String, default: '' },
  approvedAt: Date,
  rejectedAt: Date,
  emailSentAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
