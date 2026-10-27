const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const DigestDelivery = require('../models/DigestDelivery');
const ContactMessage = require('../models/ContactMessage');
const Booking = require('../models/Booking');
const contactStore = require('./contactStore');
const { sendDailyDigest, smtpReady } = require('./mailer');

const STATE_FILE = path.join(__dirname, '..', 'data', 'digest-state.json');

function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function todayKey(tz = 'Asia/Kolkata') {
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

async function loadPending(isMongoConnected) {
  if (isMongoConnected) {
    return ContactMessage.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
  }
  return contactStore.list().filter((r) => r.status === 'pending');
}

/**
 * Email owner a digest of pending submissions.
 * No-op (no email) when the inbox is empty or already sent today.
 */
function createDigestRunner({ send = sendDailyDigest, ready = smtpReady } = {}) {
  let localSending = false;
  return async function runDailyDigest({ isMongoConnected, force = false } = {}) {
    if (!ready()) return { sent: false, reason: 'smtp' };
    if (process.env.MONGO_URI && !isMongoConnected) return { sent: false, reason: 'storage' };
    const key = todayKey();
    let pending, bookings = [], contactCount = 0, bookingCount = 0;
    const until = new Date();
    if (isMongoConnected) {
      const last = await DigestDelivery.findOne({ status: 'sent' }).sort({ windowEnd: -1, sentAt: -1 }).lean();
      const since = last?.windowEnd || last?.sentAt || new Date(Date.now() - 86400000);
      const contactsQuery = { createdAt: { $gt: since, $lte: until } };
      const bookingsQuery = { status: { $in: ['paid', 'completed', 'payment_review'] },
        $or: [{ createdAt: { $gt: since, $lte: until } }, { paidAt: { $gt: since, $lte: until } }] };
      [pending, bookings, contactCount, bookingCount] = await Promise.all([
        ContactMessage.find(contactsQuery).sort({ createdAt: -1 }).limit(50).lean(),
        Booking.find(bookingsQuery).sort({ paidAt: -1 }).limit(50).select('-ip -razorpaySignature').lean(),
        ContactMessage.countDocuments(contactsQuery), Booking.countDocuments(bookingsQuery),
      ]);
    } else { pending = await loadPending(false); contactCount = pending.length; }
    if (!pending.length && !bookings.length) return { sent: false, reason: 'empty', count: 0 };
    const token = randomUUID();
    if (isMongoConnected) {
      const stale = new Date(Date.now() - 5 * 60_000);
      const condition = force
        ? { $or: [{ status: { $ne: 'sending' } }, { claimedAt: { $lt: stale } }] }
        : { $or: [{ status: 'failed' }, { status: { $exists: false } }, { status: 'sending', claimedAt: { $lt: stale } }] };
      try {
        const claim = await DigestDelivery.findOneAndUpdate({ _id: key, ...condition }, {
          $set: { status: 'sending', token, claimedAt: new Date() },
        }, { upsert: true, new: true });
        if (!claim) return { sent: false, reason: 'already-sent' };
      } catch (error) {
        if (error.code === 11000) return { sent: false, reason: 'already-sent' };
        throw error;
      }
    } else {
      if (localSending || (!force && readState().lastSentDay === key)) return { sent: false, reason: 'already-sent' };
      localSending = true;
    }
    try {
      await send(pending, bookings, { contactCount, bookingCount });
      if (isMongoConnected) await DigestDelivery.updateOne({ _id: key, token }, { $set: { status: 'sent', sentAt: new Date(), windowEnd: until } });
      else writeState({ lastSentDay: key, lastCount: pending.length, lastSentAt: new Date().toISOString() });
      return { sent: true, count: contactCount + bookingCount, contactCount, bookingCount };
    } catch (error) {
      if (isMongoConnected) await DigestDelivery.updateOne({ _id: key, token }, { $set: { status: 'failed' } });
      throw error;
    } finally { localSending = false; }
  };
}

const runDailyDigest = createDigestRunner();

function digestDue(now, hour, minute) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const h = +parts.find(p => p.type === 'hour').value, m = +parts.find(p => p.type === 'minute').value;
  return h * 60 + m >= hour * 60 + minute;
}
function startDailyDigestScheduler(getMongoFlag) {
  let running = false;
  const tick = async () => {
    if (running || !getMongoFlag()) return;
    running = true;
    try {
      const prefs = await require('./adminPreferences').read();
      if (digestDue(new Date(), prefs.digestHour, prefs.digestMinute)) await runDailyDigest({ isMongoConnected: true });
    } catch { console.error('[Digest] Scheduled summary failed; will retry.'); }
    finally { running = false; }
  };
  void tick();
  return setInterval(tick, 60000).unref();
}
module.exports = { runDailyDigest, startDailyDigestScheduler, loadPending, createDigestRunner, digestDue };
