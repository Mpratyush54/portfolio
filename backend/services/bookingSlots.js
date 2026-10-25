/** Discovery call availability — IST, 6–9 PM, book ≥3 days ahead. Dynamic fee by load. */

const bookingSettings = require('./bookingSettings');
const { validDate } = require('./bookingValidation');

const SLOT_HOURS = ['18:00', '19:00', '20:00', '21:00'];
const TZ = 'Asia/Kolkata';
const MIN_ADVANCE_DAYS = 3;
const WINDOW_DAYS = 21;

/** Reliable YYYY-MM-DD in Asia/Kolkata (avoids locale format quirks). */
function istParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError('Invalid time value');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const y = get('year');
  const m = get('month');
  const day = get('day');
  if (!y || !m || !day) {
    throw new RangeError('Invalid time value');
  }
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m || !validDate(ymd)) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function addDaysYmd(ymd, days) {
  const p = parseYmd(ymd);
  if (!p) throw new RangeError('Invalid time value');
  const utc = Date.UTC(p.y, p.mo - 1, p.d + days, 12, 0, 0);
  return istParts(new Date(utc));
}

function feePaiseBase() {
  const n = parseInt(process.env.DISCOVERY_FEE_PAISE || '49900', 10);
  return Number.isFinite(n) && n > 0 ? n : 49900;
}

/** @deprecated use priceForDate — kept for callers expecting a single fee */
function feePaise() {
  return feePaiseBase();
}

function formatAmount(paise) {
  return `₹${(paise / 100).toFixed(paise % 100 ? 2 : 0)}`;
}

function activeTaken(taken) {
  const holdMs = 20 * 60 * 1000;
  const now = Date.now();
  return (taken || []).filter((t) => {
    if (t.status === 'paid') return true;
    if (t.status !== 'pending_payment') return false;
    const expiry = t.holdExpiresAt
      ? new Date(t.holdExpiresAt).getTime()
      : new Date(t.createdAt || 0).getTime() + holdMs;
    return Number.isFinite(expiry) && expiry > now;
  });
}

/**
 * Load 0–1 from window fill + day scarcity.
 * Higher load → higher price.
 */
function loadForDate(date, taken, start, end) {
  const active = activeTaken(taken).filter((t) => t.date >= start && t.date <= end);
  const totalSlots = WINDOW_DAYS * SLOT_HOURS.length;
  const globalLoad = Math.min(1, active.length / Math.max(1, totalSlots));

  const dayTaken = active.filter((t) => t.date === date).length;
  const dayLoad = dayTaken / SLOT_HOURS.length;

  // Blend: day pressure matters more when that evening is filling up
  return Math.min(1, globalLoad * 0.55 + dayLoad * 0.45);
}

function demandLabel(load) {
  if (load >= 0.65) return 'High demand';
  if (load >= 0.35) return 'Busy';
  return 'Standard';
}

/**
 * Dynamic fee between admin min/max, scaled by load.
 * Rounded to whole rupees.
 */
function priceForDate(date, taken, start, end, settings = bookingSettings.read()) {
  const minP = settings.minPaise;
  const maxP = settings.maxPaise;
  const load = loadForDate(date, taken, start || bookingWindow().start, end || bookingWindow().end);
  // Interpolate min → max by load (0 = min, 1 = max)
  const raw = minP + (maxP - minP) * load;
  const paise = Math.round(raw / 100) * 100;
  const clamped = Math.min(maxP, Math.max(minP, paise));
  return {
    amountPaise: clamped,
    amountLabel: formatAmount(clamped),
    load: Math.round(load * 100) / 100,
    demand: demandLabel(load),
    basePaise: minP,
    baseLabel: formatAmount(minP),
    minPaise: minP,
    maxPaise: maxP,
    minLabel: formatAmount(minP),
    maxLabel: formatAmount(maxP),
  };
}

function configPublic(settings = bookingSettings.read()) {
  return {
    slots: SLOT_HOURS,
    minAdvanceDays: MIN_ADVANCE_DAYS,
    windowDays: WINDOW_DAYS,
    timezone: TZ,
    amountPaise: settings.minPaise,
    currency: 'INR',
    amountLabel: formatAmount(settings.minPaise),
    basePaise: settings.minPaise,
    baseLabel: formatAmount(settings.minPaise),
    minPaise: settings.minPaise,
    maxPaise: settings.maxPaise,
    minLabel: formatAmount(settings.minPaise),
    maxLabel: formatAmount(settings.maxPaise),
    blockedDates: settings.blockedDates,
    title: 'Discovery call',
    durationMin: 30,
    pricingNote: `Fee moves with demand between ${formatAmount(settings.minPaise)}–${formatAmount(settings.maxPaise)}.`,
  };
}

function bookingWindow() {
  const today = istParts();
  const start = addDaysYmd(today, MIN_ADVANCE_DAYS);
  const end = addDaysYmd(today, MIN_ADVANCE_DAYS + WINDOW_DAYS - 1);
  return { today, start, end };
}

/**
 * Build day → available slots map with per-day dynamic price.
 * @param {Array<{date:string,slot:string,status:string,createdAt?:string}>} taken
 */
function buildAvailability(taken, settings = bookingSettings.read()) {
  const { start, end } = bookingWindow();
  const closedDays = new Set(settings.blockedDates);
  const blocked = new Set(
    activeTaken(taken).map((t) => `${t.date}|${t.slot}`)
  );

  const days = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 60) {
    const dayClosed = closedDays.has(cursor);
    const pricing = priceForDate(cursor, taken, start, end, settings);
    const slots = SLOT_HOURS.map((slot) => ({
      slot,
      label: formatSlotLabel(slot),
      available: !dayClosed && !blocked.has(`${cursor}|${slot}`),
      amountPaise: pricing.amountPaise,
      amountLabel: pricing.amountLabel,
      demand: pricing.demand,
    }));
    days.push({
      date: cursor,
      label: formatDayLabel(cursor),
      slots,
      blocked: dayClosed,
      amountPaise: pricing.amountPaise,
      amountLabel: pricing.amountLabel,
      demand: pricing.demand,
      load: pricing.load,
    });
    cursor = addDaysYmd(cursor, 1);
    guard += 1;
  }

  return { ...configPublic(settings), start, end, days };
}

function formatSlotLabel(slot) {
  const [h, m] = slot.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm} IST`;
}

function formatDayLabel(ymd) {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const dt = new Date(Date.UTC(p.y, p.mo - 1, p.d, 12));
  return dt.toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function isValidSlot(date, slot, settings = bookingSettings.read()) {
  if (!SLOT_HOURS.includes(slot)) return false;
  if (!parseYmd(date)) return false;
  if (settings.blockedDates.includes(date)) return false;
  const { start, end } = bookingWindow();
  return date >= start && date <= end;
}

module.exports = {
  SLOT_HOURS,
  TZ,
  MIN_ADVANCE_DAYS,
  WINDOW_DAYS,
  feePaise,
  feePaiseBase,
  priceForDate,
  formatAmount,
  configPublic,
  bookingWindow,
  buildAvailability,
  isValidSlot,
  formatSlotLabel,
  istParts,
};
