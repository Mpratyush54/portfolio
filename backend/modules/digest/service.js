const { randomUUID } = require('crypto');
const DigestDelivery = require('./DigestDelivery');
const ContactMessage = require('../contact/ContactMessage');
const Booking = require('../booking/Booking');
const { mongoReady } = require('../shared/mongo');
const { sendDailyDigest, smtpReady } = require('../shared/mailer');

class DigestService {
  constructor({ send = sendDailyDigest, ready = smtpReady } = {}) {
    this.send = send;
    this.ready = ready;
  }

  static todayKey(tz = 'Asia/Kolkata') {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  static due(now, hour, minute) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const currentHour = Number(parts.find((part) => part.type === 'hour').value);
    const currentMinute = Number(parts.find((part) => part.type === 'minute').value);
    return currentHour * 60 + currentMinute >= hour * 60 + minute;
  }

  async run({ force = false } = {}) {
    if (!this.ready()) return { sent: false, reason: 'smtp' };
    if (!mongoReady()) return { sent: false, reason: 'storage' };
    const key = DigestService.todayKey();
    const until = new Date();
    const last = await DigestDelivery.findOne({ status: 'sent' }).sort({ windowEnd: -1, sentAt: -1 }).lean();
    const since = last?.windowEnd || last?.sentAt || new Date(Date.now() - 86400000);
    const contactsQuery = { createdAt: { $gt: since, $lte: until } };
    const bookingsQuery = {
      status: { $in: ['paid', 'completed', 'payment_review'] },
      $or: [{ createdAt: { $gt: since, $lte: until } }, { paidAt: { $gt: since, $lte: until } }],
    };
    const [pending, bookings, contactCount, bookingCount] = await Promise.all([
      ContactMessage.find(contactsQuery).sort({ createdAt: -1 }).limit(50).lean(),
      Booking.find(bookingsQuery).sort({ paidAt: -1 }).limit(50).select('-ip -razorpaySignature').lean(),
      ContactMessage.countDocuments(contactsQuery),
      Booking.countDocuments(bookingsQuery),
    ]);
    if (!pending.length && !bookings.length) return { sent: false, reason: 'empty', count: 0 };
    const token = randomUUID();
    const stale = new Date(Date.now() - 5 * 60_000);
    const condition = force
      ? { $or: [{ status: { $ne: 'sending' } }, { claimedAt: { $lt: stale } }] }
      : { $or: [{ status: 'failed' }, { status: { $exists: false } }, { status: 'sending', claimedAt: { $lt: stale } }] };
    try {
      const claim = await DigestDelivery.findOneAndUpdate(
        { _id: key, ...condition },
        { $set: { status: 'sending', token, claimedAt: new Date() } },
        { upsert: true, new: true },
      );
      if (!claim) return { sent: false, reason: 'already-sent' };
    } catch (error) {
      if (error.code === 11000) return { sent: false, reason: 'already-sent' };
      throw error;
    }
    try {
      await this.send(pending, bookings, { contactCount, bookingCount });
      await DigestDelivery.updateOne(
        { _id: key, token },
        { $set: { status: 'sent', sentAt: new Date(), windowEnd: until } },
      );
      return { sent: true, count: contactCount + bookingCount, contactCount, bookingCount };
    } catch (error) {
      await DigestDelivery.updateOne({ _id: key, token }, { $set: { status: 'failed' } });
      throw error;
    }
  }

  static startScheduler() {
    let running = false;
    const runner = createDigestRunner();
    const tick = async () => {
      if (running || !mongoReady()) return;
      running = true;
      try {
        const prefs = await require('../admin/preferences').read();
        if (DigestService.due(new Date(), prefs.digestHour, prefs.digestMinute)) await runner();
      } catch {
        console.error('[Digest] Scheduled summary failed; will retry.');
      } finally {
        running = false;
      }
    };
    void tick();
    return setInterval(tick, 60000).unref();
  }
}

function createDigestRunner(deps) {
  const service = new DigestService(deps);
  return (options) => service.run(options);
}

const runDailyDigest = createDigestRunner();

module.exports = {
  DigestService,
  runDailyDigest,
  startDailyDigestScheduler: () => DigestService.startScheduler(),
  createDigestRunner,
  digestDue: DigestService.due,
};
