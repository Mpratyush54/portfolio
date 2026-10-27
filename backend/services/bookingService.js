const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Settings = require('../models/BookingSettings');
const RequestLimit = require('../models/RequestLimit');
const WebhookReceipt = require('../models/WebhookReceipt');
const defaults = require('./bookingSettings');
const slots = require('./bookingSlots');
const { httpError, validateSettings } = require('./bookingValidation');
const { consume } = require('./rateLimits');
const { rateAddress } = require('./clientAddress');
const { validSignature, validId, parseWebhook, onceCaptured } = require('./paymentSecurity');

const HOLD_MS = 20 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slotKey = (date, slot) => `${date}|${slot}`;

function createBookingService({ gateway, sendEmails, emailReady = () => true }) {
  let initialized = false;
  const ready = () => initialized && mongoose.connection.readyState === 1;
  function requireReady() {
    if (!ready()) throw httpError(503, 'Booking storage is unavailable. Please try again shortly.');
  }

  async function init() {
    initialized = false;
    await Promise.all([Booking.init(), Settings.init(), RequestLimit.init(), WebhookReceipt.init()]);
    // Older bookings did not own a unique key. Reserve their active slots before
    // enabling checkout. Conflicting historic records stop initialization safely.
    const old = await Booking.find({ slotKey: { $exists: false }, status: { $in: ['paid', 'pending_payment'] } });
    for (const booking of old) {
      const expiry = booking.holdExpiresAt || new Date(booking.createdAt.getTime() + HOLD_MS);
      if (booking.status === 'paid' || expiry > new Date()) {
        await Booking.updateOne({ _id: booking._id, slotKey: { $exists: false } }, {
          $set: { slotKey: slotKey(booking.date, booking.slot), holdExpiresAt: booking.status === 'paid' ? null : expiry },
        });
      }
    }
    const { updatedAt, ...initialSettings } = defaults.read();
    await Settings.findOneAndUpdate({ _id: 'booking' }, {
      $setOnInsert: { ...initialSettings, version: 0 },
    }, { upsert: true, new: true });
    initialized = true;
  }

  async function settings() {
    requireReady();
    return Settings.findById('booking').lean();
  }

  async function saveSettings(body) {
    const current = await settings();
    if (!Number.isSafeInteger(body.version) || body.version !== current.version) {
      throw httpError(409, 'Settings changed. Reload them before saving.');
    }
    const validated = validateSettings(body, current);
    const saved = await Settings.findOneAndUpdate({ _id: 'booking', version: body.version }, {
      $set: { minPaise: validated.minPaise, maxPaise: validated.maxPaise, blockedDates: validated.blockedDates },
      $inc: { version: 1 },
    }, { new: true, runValidators: true }).lean();
    if (!saved) throw httpError(409, 'Settings changed. Reload them before saving.');
    return saved;
  }

  async function expireHolds() {
    requireReady();
    // Atomic with confirmation: a confirmed booking no longer matches this filter.
    await Booking.updateMany({ status: 'pending_payment', holdExpiresAt: { $lte: new Date() } }, {
      $unset: { slotKey: 1 },
    });
  }

  async function taken(from, to) {
    requireReady();
    return Booking.find({ date: { $gte: from, $lte: to }, status: { $in: ['paid', 'pending_payment'] } }).lean();
  }

  async function create(body, ip = '') {
    requireReady();
    const rp = gateway();
    if (!rp || !process.env.RAZORPAY_WEBHOOK_SECRET) throw httpError(503, 'Online payment is unavailable. Please email your preferred time.');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Invalid booking details.');
    if (body.website) throw httpError(400, 'Unable to create booking.');
    const limits = { name: 100, email: 254, phone: 40, note: 2000, date: 10, slot: 5 };
    const details = {};
    for (const [field, limit] of Object.entries(limits)) {
      const input = body[field] ?? '';
      if (typeof input !== 'string' || input.trim().length > limit) throw httpError(400, `Invalid ${field}.`);
      details[field] = input.trim();
    }
    details.email = details.email.toLowerCase();
    if (!details.name || !EMAIL_RE.test(details.email)) throw httpError(400, 'A name and valid email are required.');
    if (body.acceptTerms !== true) throw httpError(400, 'Please accept the terms before paying.');
    const config = await settings();
    if (!slots.isValidSlot(details.date, details.slot, config)) throw httpError(400, 'That time is not available for booking.');
    // Share the abuse budget across replicas so a single client cannot reserve
    // the entire calendar without paying. Bucket documents expire automatically.
    if (ip) {
      await consume({ scope: 'booking-orders-ip', subject: rateAddress(ip), limit: 8, windowMs: 15 * 60000 });
      await consume({ scope: 'booking-orders-email', subject: details.email, limit: 8, windowMs: 15 * 60000 });
    }
    const { start, end } = slots.bookingWindow();
    const pricing = slots.priceForDate(details.date, await taken(start, end), start, end, config);
    if (body.amountPaise !== pricing.amountPaise) throw httpError(409, 'The price has changed. Refresh the available times and review the new total.');
    await expireHolds();
    let booking;
    try {
      // Insert before awaiting the gateway. The unique index arbitrates requests
      // across processes and overlapping Kubernetes replicas.
      booking = await Booking.create({ ...details, amountPaise: pricing.amountPaise,
        currency: 'INR', slotKey: slotKey(details.date, details.slot),
        holdExpiresAt: new Date(Date.now() + HOLD_MS), ip });
    } catch (error) {
      if (error.code === 11000) throw httpError(409, 'That slot was just taken. Pick another.');
      throw error;
    }
    try {
      const order = await rp.orders.create({ amount: pricing.amountPaise, currency: 'INR', partial_payment: false,
        receipt: `disc_${booking._id}`, notes: { bookingId: String(booking._id), type: 'discovery_call' } });
      if (!order?.id) throw new Error('Gateway did not return an order ID');
      await Booking.updateOne({ _id: booking._id }, { $set: { razorpayOrderId: order.id } });
      return { success: true, bookingId: String(booking._id), orderId: order.id,
        amountPaise: pricing.amountPaise, amountLabel: pricing.amountLabel, currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID, date: details.date, slot: details.slot,
        slotLabel: slots.formatSlotLabel(details.slot), holdExpiresAt: booking.holdExpiresAt };
    } catch (error) {
      await Booking.updateOne({ _id: booking._id, status: 'pending_payment' }, {
        $set: { status: 'cancelled' }, $unset: { slotKey: 1 },
      });
      throw httpError(502, 'Could not create payment order. Please try again.');
    }
  }

  async function notify(booking) {
    if (!emailReady()) return;
    for (const audience of ['owner', 'visitor']) {
      const status = audience === 'owner' ? 'emailOwnerStatus' : 'emailVisitorStatus';
      const claimedAt = audience === 'owner' ? 'emailOwnerClaimedAt' : 'emailVisitorClaimedAt';
      const claim = await Booking.findOneAndUpdate({ _id: booking._id, status: { $in: ['paid', 'payment_review'] }, $or: [
        { [status]: { $exists: false } }, { [status]: 'failed' },
        { [status]: 'sending', [claimedAt]: { $lt: new Date(Date.now() - 5 * 60_000) } },
      ] }, { $set: { [status]: 'sending', [claimedAt]: new Date() } }, { new: true });
      if (!claim) continue;
      try {
        await sendEmails(claim.toObject(), audience);
        await Booking.updateOne({ _id: claim._id }, { $set: { [status]: 'sent' } });
      } catch (error) {
        await Booking.updateOne({ _id: claim._id }, { $set: { [status]: 'failed' } });
        console.error('[Booking email] Delivery failed; details suppressed.');
      }
    }
  }

  async function confirm(booking, paymentId) {
    const rp = gateway();
    if (!rp) throw httpError(503, 'Payments are unavailable.');
    const payment = await rp.payments.fetch(paymentId);
    if (!payment || payment.id !== paymentId || payment.order_id !== booking.razorpayOrderId || payment.amount !== booking.amountPaise || payment.currency !== booking.currency) {
      throw httpError(400, 'Payment does not match this booking.');
    }
    if (payment.status !== 'captured' || payment.captured !== true || (payment.amount_refunded || 0) !== 0) throw httpError(409, 'Payment is not captured in full. Please retry confirmation or contact support.');
    if (['paid', 'completed'].includes(booking.status)) {
      if (booking.razorpayPaymentId !== paymentId) throw httpError(409, 'Booking already has a different payment.');
      await notify(booking);
      return { success: true, status: 'paid', date: booking.date, slot: booking.slot };
    }
    if (booking.status === 'payment_review') { await notify(booking); return { success: false, status: 'payment_review' }; }
    const paymentFields = { razorpayPaymentId: paymentId, paidAt: new Date() };
    let confirmed;
    try {
      if (new Date(`${booking.date}T${booking.slot}:00+05:30`) <= new Date()) throw httpError(409, 'Time has passed');
      confirmed = await Booking.findOneAndUpdate({ _id: booking._id, status: 'pending_payment' }, {
        $set: { ...paymentFields, status: 'paid', holdExpiresAt: null, slotKey: slotKey(booking.date, booking.slot) },
      }, { new: true });
    } catch (error) {
      if (error.code !== 11000 && error.status !== 409) throw error;
    }
    if (!confirmed) {
      // An expired hold may have been sold again. Retain the payment for admin
      // reconciliation; never confirm two calls or automatically charge/refund.
      const review = await Booking.findOneAndUpdate({ _id: booking._id, status: { $in: ['pending_payment', 'cancelled'] } }, {
        $set: { ...paymentFields, status: 'payment_review' }, $unset: { slotKey: 1 },
      }, { new: true });
      if (review) { await notify(review); return { success: false, status: 'payment_review' }; }
      const latest = await Booking.findById(booking._id);
      if (latest?.status === 'paid' && latest.razorpayPaymentId === paymentId) {
        await notify(latest);
        return { success: true, status: 'paid', date: latest.date, slot: latest.slot };
      }
      return { success: false, status: 'payment_review' };
    }
    await notify(confirmed);
    return { success: true, status: 'paid', date: confirmed.date, slot: confirmed.slot };
  }

  async function verify(body) {
    requireReady();
    if (!body || typeof body.bookingId !== 'string' || !/^[a-f0-9]{24}$/i.test(body.bookingId)
      || !validId(body.razorpay_order_id, 'order') || !validId(body.razorpay_payment_id, 'pay')) {
      throw httpError(400, 'Invalid payment fields.');
    }
    const booking = await Booking.findById(body.bookingId);
    if (!booking) throw httpError(404, 'Booking not found.');
    if (body.razorpay_order_id !== booking.razorpayOrderId || !validSignature(
      `${booking.razorpayOrderId}|${body.razorpay_payment_id}`, body.razorpay_signature, process.env.RAZORPAY_KEY_SECRET,
    )) throw httpError(400, 'Payment signature mismatch.');
    return confirm(booking, body.razorpay_payment_id);
  }

  async function webhook(rawBody, signature) {
    requireReady();
    const event = parseWebhook(rawBody, signature);
    if (event.event !== 'payment.captured') return { received: true };
    const payment = event.payload?.payment?.entity;
    const booking = await Booking.findOne({ razorpayOrderId: payment.order_id });
    // Other orders on the same Razorpay account are outside this integration.
    if (!booking) return { received: true };
    await onceCaptured('booking', payment, () => confirm(booking, payment.id));
    return { received: true };
  }

  async function retryNotifications() {
    if (!ready() || !emailReady()) return;
    const pending = await Booking.find({ status: { $in: ['paid', 'payment_review'] }, $or: [
      { emailOwnerStatus: { $ne: 'sent' } }, { emailVisitorStatus: { $ne: 'sent' } },
    ] }).limit(50);
    for (const booking of pending) await notify(booking);
  }

  return { init, ready, settings, saveSettings, taken, create, verify, webhook, retryNotifications };
}

module.exports = { createBookingService, validSignature };
