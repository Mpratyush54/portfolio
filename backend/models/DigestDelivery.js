const mongoose = require('mongoose');

module.exports = mongoose.model('DigestDelivery', new mongoose.Schema({
  _id: String,
  status: { type: String, enum: ['sending', 'sent', 'failed'] },
  token: String,
  claimedAt: Date,
  sentAt: Date,
  windowEnd: Date,
}));
