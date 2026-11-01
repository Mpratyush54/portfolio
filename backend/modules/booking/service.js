const mongoose = require('mongoose');
const Booking = require('./Booking');
const Settings = require('./BookingSettings');
const RequestLimit = require('../shared/RequestLimit');
const WebhookReceipt = require('../payments/WebhookReceipt');
const { DEFAULTS } = require('./settings');
const { BookingCalendar, HOLD_MS } = require('./slots');
const { BookingValidator } = require('./validation');
const { httpError } = require('../shared/errors');
const { consume } = require('../shared/rateLimits');
const { rateAddress } = require('../shared/clientAddress');
const { validSignature, parseWebhook, onceCaptured } = require('../payments/security');
const { correlationId } = require('../analytics/PostHogService');

class BookingService {
  constructor({
    gateway,
    sendEmails,
    emailReady = () => true,
    analytics = { capture: () => false },
    calendar = { enabled: () => false, upsert: async () => ({ skipped: true }) },
  }) {
    this.gateway = gateway;
    this.sendEmails = sendEmails;
    this.emailReady = emailReady;
    this.analytics = analytics;
    this.calendar = calendar;
    this.initialized = false;
  }

  async syncCalendar(booking) {
    if (!booking || !this.calendar?.upsert) return;
    try {
      await this.calendar.upsert(booking);
    } catch {
      console.error('[Booking calendar] Sync failed; payment and assignment still stand.');
    }
  }

  ready() {
    return this.initialized && mongoose.connection.readyState === 1;
  }

  requireReady() {
    if (!this.ready()) throw httpError(503, 'Booking storage is unavailable. Please try again shortly.');
  }

  track(event, properties, booking) {
    this.analytics.capture(
      event,
      {
        ...(booking?.correlationId ? { correlation_id: booking.correlationId } : {}),
        payment_kind: 'booking',
        ...properties,
      },
      'backend:booking',
    );
  }

  async init() {
    this.initialized = false;
    await Promise.all([Booking.init(), Settings.init(), RequestLimit.init(), WebhookReceipt.init()]);
    const old = await Booking.find({
      slotKey: { $exists: false },
      status: { $in: ['paid', 'pending_payment'] },
    });
    for (const booking of old) {
      const expiry = booking.holdExpiresAt || new Date(booking.createdAt.getTime() + HOLD_MS);
      if (booking.status === 'paid' || expiry > new Date()) {
        await Booking.updateOne(
          { _id: booking._id, slotKey: { $exists: false } },
          {
            $set: {
              slotKey: BookingCalendar.slotKey(booking.date, booking.slot),
              holdExpiresAt: booking.status === 'paid' ? null : expiry,
            },
          },
        );
      }
    }
    await Settings.findOneAndUpdate(
      { _id: 'booking' },
      { $setOnInsert: { ...DEFAULTS, version: 0 } },
      { upsert: true, new: true },
    );
    this.initialized = true;
  }

  async settings() {
    this.requireReady();
    return Settings.findById('booking').lean();
  }

  async saveSettings(body) {
    const current = await this.settings();
    if (!Number.isSafeInteger(body.version) || body.version !== current.version) {
      throw httpError(409, 'Settings changed. Reload them before saving.');
    }
    const validated = BookingValidator.settings(body, current);
    const saved = await Settings.findOneAndUpdate(
      { _id: 'booking', version: body.version },
      {
        $set: {
          minPaise: validated.minPaise,
          maxPaise: validated.maxPaise,
          blockedDates: validated.blockedDates,
        },
        $inc: { version: 1 },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!saved) throw httpError(409, 'Settings changed. Reload them before saving.');
    return saved;
  }

  async expireHolds() {
    this.requireReady();
    await Booking.updateMany(
      { status: 'pending_payment', holdExpiresAt: { $lte: new Date() } },
      { $unset: { slotKey: 1 } },
    );
  }

  async taken(from, to) {
    this.requireReady();
    return Booking.find({
      date: { $gte: from, $lte: to },
      status: { $in: ['paid', 'pending_payment'] },
    }).lean();
  }

  paymentsReady() {
    return Boolean(this.gateway() && process.env.RAZORPAY_WEBHOOK_SECRET);
  }

  async create(body, ip = '') {
    this.requireReady();
    if (!this.paymentsReady()) {
      throw httpError(503, 'Online payment is unavailable. Please email your preferred time.');
    }
    const details = BookingValidator.checkout(body);
    const requestCorrelationId = correlationId(body.correlationId);
    const calendar = new BookingCalendar(await this.settings());
    if (!calendar.isOpen(details.date, details.slot)) {
      throw httpError(400, 'That time is not available for booking.');
    }
    if (ip) {
      await consume({ scope: 'booking-orders-ip', subject: rateAddress(ip), limit: 8, windowMs: 15 * 60000 });
      await consume({ scope: 'booking-orders-email', subject: details.email, limit: 8, windowMs: 15 * 60000 });
    }
    const { start, end } = calendar.window();
    const pricing = calendar.priceFor(details.date, await this.taken(start, end), start, end);
    if (body.amountPaise !== pricing.amountPaise) {
      throw httpError(409, 'The price has changed. Refresh the available times and review the new total.');
    }
    const booking = await this.reserveSlot(details, pricing, requestCorrelationId, ip);
    return this.startCheckout(booking, details, pricing, requestCorrelationId);
  }

  async reserveSlot(details, pricing, requestCorrelationId, ip) {
    await this.expireHolds();
    try {
      return await Booking.create({
        ...details,
        amountPaise: pricing.amountPaise,
        currency: 'INR',
        slotKey: BookingCalendar.slotKey(details.date, details.slot),
        holdExpiresAt: new Date(Date.now() + HOLD_MS),
        correlationId: requestCorrelationId,
        ip,
      });
    } catch (error) {
      if (error.code === 11000) throw httpError(409, 'That slot was just taken. Pick another.');
      throw error;
    }
  }

  async startCheckout(booking, details, pricing, requestCorrelationId) {
    try {
      const order = await this.gateway().orders.create({
        amount: pricing.amountPaise,
        currency: 'INR',
        partial_payment: false,
        receipt: `disc_${booking._id}`,
        notes: {
          bookingId: String(booking._id),
          correlationId: requestCorrelationId,
          type: 'discovery_call',
        },
      });
      if (!order?.id) throw new Error('Gateway did not return an order ID');
      await Booking.updateOne({ _id: booking._id }, { $set: { razorpayOrderId: order.id } });
      this.track('booking_order_created', {
        correlation_id: requestCorrelationId,
        event_source: 'api',
        outcome: 'created',
      });
      return {
        success: true,
        bookingId: String(booking._id),
        orderId: order.id,
        correlationId: requestCorrelationId,
        amountPaise: pricing.amountPaise,
        amountLabel: pricing.amountLabel,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        date: details.date,
        slot: details.slot,
        slotLabel: BookingCalendar.formatSlotLabel(details.slot),
        holdExpiresAt: booking.holdExpiresAt,
      };
    } catch (error) {
      await Booking.updateOne(
        { _id: booking._id, status: 'pending_payment' },
        { $set: { status: 'cancelled' }, $unset: { slotKey: 1 } },
      );
      this.track('booking_order_failed', {
        correlation_id: requestCorrelationId,
        event_source: 'api',
        outcome: 'failed',
      });
      throw httpError(502, 'Could not create payment order. Please try again.');
    }
  }

  async notify(booking) {
    if (!this.emailReady()) return;
    for (const audience of ['owner', 'visitor']) {
      const status = audience === 'owner' ? 'emailOwnerStatus' : 'emailVisitorStatus';
      const claimedAt = audience === 'owner' ? 'emailOwnerClaimedAt' : 'emailVisitorClaimedAt';
      const claim = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          status: { $in: ['paid', 'payment_review'] },
          $or: [
            { [status]: { $exists: false } },
            { [status]: 'failed' },
            { [status]: 'sending', [claimedAt]: { $lt: new Date(Date.now() - 5 * 60_000) } },
          ],
        },
        { $set: { [status]: 'sending', [claimedAt]: new Date() } },
        { new: true },
      );
      if (!claim) continue;
      try {
        await this.sendEmails(claim.toObject(), audience);
        await Booking.updateOne({ _id: claim._id }, { $set: { [status]: 'sent' } });
      } catch {
        await Booking.updateOne({ _id: claim._id }, { $set: { [status]: 'failed' } });
        console.error('[Booking email] Delivery failed; details suppressed.');
      }
    }
  }

  paymentMatches(booking, payment, paymentId) {
    return (
      payment &&
      payment.id === paymentId &&
      payment.order_id === booking.razorpayOrderId &&
      payment.amount === booking.amountPaise &&
      payment.currency === booking.currency
    );
  }

  isCaptured(payment) {
    return payment.status === 'captured' && payment.captured === true && (payment.amount_refunded || 0) === 0;
  }

  paidResult(booking) {
    return { success: true, status: 'paid', date: booking.date, slot: booking.slot };
  }

  async confirm(booking, paymentId, eventSource = 'verification') {
    const gateway = this.gateway();
    if (!gateway) throw httpError(503, 'Payments are unavailable.');
    const payment = await gateway.payments.fetch(paymentId);
    if (!this.paymentMatches(booking, payment, paymentId)) {
      throw httpError(400, 'Payment does not match this booking.');
    }
    if (!this.isCaptured(payment)) {
      throw httpError(409, 'Payment is not captured in full. Please retry confirmation or contact support.');
    }
    if (['paid', 'completed'].includes(booking.status)) {
      if (booking.razorpayPaymentId !== paymentId) throw httpError(409, 'Booking already has a different payment.');
      this.track('booking_reconciliation_recovered', { event_source: eventSource, outcome: 'recovered' }, booking);
      await this.notify(booking);
      return this.paidResult(booking);
    }
    if (booking.status === 'payment_review') {
      await this.notify(booking);
      return { success: false, status: 'payment_review' };
    }
    const confirmed = await this.markPaid(booking, paymentId);
    if (confirmed) {
      this.track('booking_verification_confirmed', { event_source: eventSource, outcome: 'confirmed' }, booking);
      await this.notify(confirmed);
      await this.syncCalendar(confirmed);
      return this.paidResult(confirmed);
    }
    return this.sendToReview(booking, paymentId, eventSource);
  }

  async markPaid(booking, paymentId) {
    try {
      if (new Date(`${booking.date}T${booking.slot}:00+05:30`) <= new Date()) throw httpError(409, 'Time has passed');
      return await Booking.findOneAndUpdate(
        { _id: booking._id, status: 'pending_payment' },
        {
          $set: {
            razorpayPaymentId: paymentId,
            paidAt: new Date(),
            status: 'paid',
            holdExpiresAt: null,
            slotKey: BookingCalendar.slotKey(booking.date, booking.slot),
          },
        },
        { new: true },
      );
    } catch (error) {
      if (error.code !== 11000 && error.status !== 409) throw error;
      return null;
    }
  }

  async sendToReview(booking, paymentId, eventSource) {
    const review = await Booking.findOneAndUpdate(
      { _id: booking._id, status: { $in: ['pending_payment', 'cancelled'] } },
      {
        $set: { razorpayPaymentId: paymentId, paidAt: new Date(), status: 'payment_review' },
        $unset: { slotKey: 1 },
      },
      { new: true },
    );
    if (review) {
      this.track('booking_verification_review', { event_source: eventSource, outcome: 'review' }, booking);
      await this.notify(review);
      return { success: false, status: 'payment_review' };
    }
    const latest = await Booking.findById(booking._id);
    if (latest?.status === 'paid' && latest.razorpayPaymentId === paymentId) {
      this.track('booking_reconciliation_recovered', { event_source: eventSource, outcome: 'recovered' }, latest);
      await this.notify(latest);
      return this.paidResult(latest);
    }
    return { success: false, status: 'payment_review' };
  }

  async verify(body) {
    let booking;
    try {
      this.requireReady();
      BookingValidator.paymentConfirmation(body);
      booking = await Booking.findById(body.bookingId);
      if (!booking) throw httpError(404, 'Booking not found.');
      if (
        body.razorpay_order_id !== booking.razorpayOrderId ||
        !validSignature(
          `${booking.razorpayOrderId}|${body.razorpay_payment_id}`,
          body.razorpay_signature,
          process.env.RAZORPAY_KEY_SECRET,
        )
      ) {
        throw httpError(400, 'Payment signature mismatch.');
      }
      return await this.confirm(booking, body.razorpay_payment_id, 'verification');
    } catch (error) {
      this.track('booking_verification_failed', { event_source: 'verification', outcome: 'failed' }, booking);
      throw error;
    }
  }

  async webhook(rawBody, signature) {
    let booking;
    try {
      this.requireReady();
      const event = parseWebhook(rawBody, signature);
      if (event.event !== 'payment.captured') {
        this.track('booking_webhook_ignored', { event_source: 'webhook', outcome: 'ignored' });
        return { received: true };
      }
      const payment = event.payload?.payment?.entity;
      booking = await Booking.findOne({ razorpayOrderId: payment.order_id });
      if (!booking) {
        this.track('booking_webhook_ignored', { event_source: 'webhook', outcome: 'ignored' });
        return { received: true };
      }
      const processed = await onceCaptured('booking', payment, () => this.confirm(booking, payment.id, 'webhook'));
      this.track(
        processed ? 'booking_webhook_accepted' : 'booking_webhook_ignored',
        { event_source: 'webhook', outcome: processed ? 'accepted' : 'ignored' },
        booking,
      );
      return { received: true };
    } catch (error) {
      const rejected = error?.message === 'Invalid webhook signature.';
      this.track(
        rejected ? 'booking_webhook_rejected' : 'booking_webhook_failed',
        { event_source: 'webhook', outcome: rejected ? 'rejected' : 'failed' },
        booking,
      );
      throw error;
    }
  }

  async retryNotifications() {
    if (!this.ready() || !this.emailReady()) return;
    const pending = await Booking.find({
      status: { $in: ['paid', 'payment_review'] },
      $or: [{ emailOwnerStatus: { $ne: 'sent' } }, { emailVisitorStatus: { $ne: 'sent' } }],
    }).limit(50);
    for (const booking of pending) await this.notify(booking);
  }
}

function createBookingService(deps) {
  return new BookingService(deps);
}

module.exports = { BookingService, createBookingService, validSignature };
