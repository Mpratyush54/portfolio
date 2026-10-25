const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const DigestDelivery = require('../models/DigestDelivery');
const ContactMessage = require('../models/ContactMessage');
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

function todayKey(tz = process.env.DIGEST_TZ || 'Asia/Kolkata') {
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
    const pending = await loadPending(isMongoConnected);
    if (!pending.length) return { sent: false, reason: 'empty', count: 0 };
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
      await send(pending);
      if (isMongoConnected) await DigestDelivery.updateOne({ _id: key, token }, { $set: { status: 'sent', sentAt: new Date() } });
      else writeState({ lastSentDay: key, lastCount: pending.length, lastSentAt: new Date().toISOString() });
      return { sent: true, count: pending.length };
    } catch (error) {
      if (isMongoConnected) await DigestDelivery.updateOne({ _id: key, token }, { $set: { status: 'failed' } });
      throw error;
    } finally { localSending = false; }
  };
}

const runDailyDigest = createDigestRunner();

function msUntilNextDigestHour() {
  const hour = Math.min(23, Math.max(0, parseInt(process.env.DIGEST_HOUR || '9', 10)));
  const tz = process.env.DIGEST_TZ || 'Asia/Kolkata';

  // Approximate next run using UTC offset via formatting local parts
  const now = new Date();
  let localHour = now.getUTCHours();
  let localMin = now.getUTCMinutes();
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    localHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    localMin = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  } catch { /* use UTC */ }

  let delayMin = (hour - localHour) * 60 - localMin;
  if (delayMin <= 1) delayMin += 24 * 60;
  return delayMin * 60 * 1000;
}

function startDailyDigestScheduler(getMongoFlag) {
  const scheduleNext = () => {
    const wait = msUntilNextDigestHour();
    console.log(`[Digest] next check in ${Math.round(wait / 60000)} min`);
    setTimeout(async () => {
      try {
        await runDailyDigest({ isMongoConnected: !!getMongoFlag() });
      } catch (err) {
        console.error('[Digest] failed', err);
      } finally {
        scheduleNext();
      }
    }, wait);
  };
  scheduleNext();
}

module.exports = { runDailyDigest, startDailyDigestScheduler, loadPending, createDigestRunner };
