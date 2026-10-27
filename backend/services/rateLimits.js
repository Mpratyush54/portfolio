const crypto = require('crypto');
const mongoose = require('mongoose');
const Counter = require('../models/RequestLimit');
const { httpError } = require('./bookingValidation');
const { clientAddress, rateAddress } = require('./clientAddress');

async function consume({ scope, subject, limit, windowMs, now = Date.now() }) {
  if (mongoose.connection.readyState !== 1) throw httpError(503, 'Request protection is temporarily unavailable.');
  const bucket = Math.floor(now / windowMs);
  const id = crypto.createHash('sha256').update(JSON.stringify([scope, subject, bucket])).digest('hex');
  let counter;
  try {
    counter = await Counter.findOneAndUpdate({ _id: id }, {
      $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) },
    }, { upsert: true, new: true });
  } catch (error) {
    if (error.code !== 11000) throw httpError(503, 'Request protection is temporarily unavailable.');
    counter = await Counter.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { new: true });
  }
  if (!counter) throw httpError(503, 'Request protection is temporarily unavailable.');
  const retryAfter = Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000));
  if (counter.count > limit) throw Object.assign(httpError(429, 'Too many requests. Please try again shortly.'), { retryAfter });
  return { remaining: limit - counter.count, retryAfter };
}
function respond(res, error) {
  if (error.status === 429) res.set('Retry-After', String(error.retryAfter || 60));
  res.set('Cache-Control', 'no-store');
  return res.status(error.status || 503).json({ error: error.status ? error.message : 'Request protection is temporarily unavailable.' });
}
function limitRequests(scope, limit, windowMs = 60000, subject = req => rateAddress(clientAddress(req)), now = Date.now) {
  return async (req, res, next) => {
    try { await consume({ scope, subject: subject(req), limit, windowMs, now: now() }); next(); }
    catch (error) { respond(res, error); }
  };
}
function apiRateLimits() {
  const guards = {
    admin: limitRequests('api-admin', 120),
    order: limitRequests('api-create-order', 30),
    verify: limitRequests('api-verify', 60),
    write: limitRequests('api-public-write', 60),
    read: limitRequests('api-read', 240),
  };
  return (req, res, next) => {
    if (req.path === '/health') return next();
    const guard = req.path.startsWith('/admin/') ? guards.admin
      : req.method === 'POST' && (req.path === '/bookings/create-order' || req.path.startsWith('/quotations/order/')) ? guards.order
      : req.path === '/bookings/verify' || req.path === '/quotations/verify' ? guards.verify
      : ['GET','HEAD','OPTIONS'].includes(req.method) ? guards.read : guards.write;
    return guard(req, res, next);
  };
}
module.exports = { consume, respond, limitRequests, apiRateLimits };
