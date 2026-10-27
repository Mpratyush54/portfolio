const crypto = require('crypto');
const Receipt = require('../models/WebhookReceipt');
const { httpError } = require('./bookingValidation');
const { limitRequests } = require('./rateLimits');

function validSignature(payload, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
const validId = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,80}$`).test(value);
function parseWebhook(raw, signature) {
  if (!Buffer.isBuffer(raw) || !validSignature(raw, signature, process.env.RAZORPAY_WEBHOOK_SECRET))
    throw httpError(400, 'Invalid webhook signature.');
  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { throw httpError(400, 'Invalid webhook body.'); }
  if (!event || Array.isArray(event) || typeof event !== 'object' || typeof event.event !== 'string')
    throw httpError(400, 'Invalid webhook body.');
  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    if (!validId(payment?.id, 'pay') || !validId(payment?.order_id, 'order')) throw httpError(400, 'Invalid payment event.');
  }
  return event;
}
async function onceCaptured(scope, payment, processPayment) {
  const id = crypto.createHash('sha256').update(`${scope}:${payment.order_id}:${payment.id}`).digest('hex');
  const lock = crypto.randomUUID(), now = new Date();
  let claim;
  try {
    claim = await Receipt.findOneAndUpdate({ _id: id, completed: { $ne: true }, $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }] }, {
      $set: { lock, leaseUntil: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 7 * 86400000), completed: false },
    }, { upsert: true, new: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await Receipt.findById(id).lean();
    if (existing?.completed) return;
    throw httpError(503, 'Payment confirmation is in progress. Retry delivery shortly.');
  }
  if (!claim) throw httpError(503, 'Payment confirmation is in progress. Retry delivery shortly.');
  try {
    await processPayment();
    const saved = await Receipt.updateOne({ _id: id, lock }, { $set: { completed: true }, $unset: { lock: 1, leaseUntil: 1 } });
    if (!saved.modifiedCount) throw httpError(503, 'Payment confirmation lease expired. Retry delivery.');
  } catch (error) {
    await Receipt.updateOne({ _id: id, lock }, { $set: { leaseUntil: new Date(0) }, $unset: { lock: 1 } });
    throw error;
  }
}
function webhookGuard({ now = Date.now } = {}) {
  const invalid = limitRequests('invalid-payment-webhook', 30, 60000, undefined, now);
  return (req, res, next) => {
    if (Buffer.isBuffer(req.body) && validSignature(req.body, req.get('x-razorpay-signature'), process.env.RAZORPAY_WEBHOOK_SECRET)) return next();
    return invalid(req, res, next);
  };
}
module.exports = { validSignature, validId, parseWebhook, onceCaptured, webhookGuard };
