const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String, completed: Boolean, lock: String, leaseUntil: Date, expiresAt: Date,
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('WebhookReceipt', schema);
