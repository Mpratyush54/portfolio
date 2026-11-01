const { DEFAULTS } = require('./settings');
const { BookingValidator } = require('./validation');
const { parseIsoDate } = require('../shared/text');

const SLOT_HOURS = ['18:00', '19:00', '20:00', '21:00'];
const TZ = 'Asia/Kolkata';
const MIN_ADVANCE_DAYS = 3;
const WINDOW_DAYS = 21;
const HOLD_MS = 20 * 60 * 1000;

class BookingCalendar {
  constructor(settings = DEFAULTS) {
    this.settings = settings;
  }

  static today(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) throw new RangeError('Invalid time value');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const part = (type) => parts.find((item) => item.type === type)?.value;
    const year = part('year');
    const month = part('month');
    const day = part('day');
    if (!year || !month || !day) throw new RangeError('Invalid time value');
    return `${year}-${month}-${day}`;
  }

  static parseDay(ymd) {
    const parsed = parseIsoDate(ymd);
    if (!parsed || !BookingValidator.isCalendarDate(ymd)) return null;
    return parsed;
  }

  static addDays(ymd, days) {
    const parsed = BookingCalendar.parseDay(ymd);
    if (!parsed) throw new RangeError('Invalid time value');
    return BookingCalendar.today(new Date(Date.UTC(parsed.y, parsed.mo - 1, parsed.d + days, 12, 0, 0)));
  }

  static formatAmount(paise) {
    return `₹${(paise / 100).toFixed(paise % 100 ? 2 : 0)}`;
  }

  static formatSlotLabel(slot) {
    const [hour, minute] = slot.split(':').map(Number);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const twelveHour = ((hour + 11) % 12) + 1;
    return `${twelveHour}:${String(minute).padStart(2, '0')} ${suffix} IST`;
  }

  static formatDayLabel(ymd) {
    const parsed = BookingCalendar.parseDay(ymd);
    if (!parsed) return ymd;
    return new Date(Date.UTC(parsed.y, parsed.mo - 1, parsed.d, 12)).toLocaleDateString('en-IN', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  static slotKey(date, slot) {
    return `${date}|${slot}`;
  }

  static window() {
    const today = BookingCalendar.today();
    const start = BookingCalendar.addDays(today, MIN_ADVANCE_DAYS);
    const end = BookingCalendar.addDays(today, MIN_ADVANCE_DAYS + WINDOW_DAYS - 1);
    return { today, start, end };
  }

  static activeTaken(taken) {
    const now = Date.now();
    return (taken || []).filter((row) => {
      if (row.status === 'paid') return true;
      if (row.status !== 'pending_payment') return false;
      const expiry = row.holdExpiresAt
        ? new Date(row.holdExpiresAt).getTime()
        : new Date(row.createdAt || 0).getTime() + HOLD_MS;
      return Number.isFinite(expiry) && expiry > now;
    });
  }

  static demandLabel(load) {
    if (load >= 0.65) return 'High demand';
    if (load >= 0.35) return 'Busy';
    return 'Standard';
  }

  window() {
    return BookingCalendar.window();
  }

  blocked() {
    return this.settings.blockedDates || [];
  }

  isOpen(date, slot) {
    if (!SLOT_HOURS.includes(slot)) return false;
    if (!BookingCalendar.parseDay(date)) return false;
    if (this.blocked().includes(date)) return false;
    const { start, end } = this.window();
    return date >= start && date <= end;
  }

  loadFor(date, taken, start, end) {
    const active = BookingCalendar.activeTaken(taken).filter((row) => row.date >= start && row.date <= end);
    const globalLoad = Math.min(1, active.length / Math.max(1, WINDOW_DAYS * SLOT_HOURS.length));
    const dayLoad = active.filter((row) => row.date === date).length / SLOT_HOURS.length;
    return Math.min(1, globalLoad * 0.55 + dayLoad * 0.45);
  }

  priceFor(date, taken, start, end) {
    const bounds = this.window();
    const minP = this.settings.minPaise;
    const maxP = this.settings.maxPaise;
    const load = this.loadFor(date, taken, start || bounds.start, end || bounds.end);
    const paise = Math.round((minP + (maxP - minP) * load) / 100) * 100;
    const amountPaise = Math.min(maxP, Math.max(minP, paise));
    return {
      amountPaise,
      amountLabel: BookingCalendar.formatAmount(amountPaise),
      load: Math.round(load * 100) / 100,
      demand: BookingCalendar.demandLabel(load),
      basePaise: minP,
      baseLabel: BookingCalendar.formatAmount(minP),
      minPaise: minP,
      maxPaise: maxP,
      minLabel: BookingCalendar.formatAmount(minP),
      maxLabel: BookingCalendar.formatAmount(maxP),
    };
  }

  publicConfig() {
    const min = this.settings.minPaise;
    const max = this.settings.maxPaise;
    return {
      slots: SLOT_HOURS,
      minAdvanceDays: MIN_ADVANCE_DAYS,
      windowDays: WINDOW_DAYS,
      timezone: TZ,
      amountPaise: min,
      currency: 'INR',
      amountLabel: BookingCalendar.formatAmount(min),
      basePaise: min,
      baseLabel: BookingCalendar.formatAmount(min),
      minPaise: min,
      maxPaise: max,
      minLabel: BookingCalendar.formatAmount(min),
      maxLabel: BookingCalendar.formatAmount(max),
      blockedDates: this.blocked(),
      title: 'Technical consultation',
      durationMin: 30,
      pricingNote:
        min === max
          ? `Fixed fee: ${BookingCalendar.formatAmount(min)} for one 30-minute technical consultation.`
          : `The selected slot fee is shown before payment, between ${BookingCalendar.formatAmount(min)} and ${BookingCalendar.formatAmount(max)}.`,
    };
  }

  availability(taken) {
    const { start, end } = this.window();
    const closedDays = new Set(this.blocked());
    const reserved = new Set(
      BookingCalendar.activeTaken(taken).map((row) => BookingCalendar.slotKey(row.date, row.slot)),
    );
    const days = [];
    let cursor = start;
    let guard = 0;
    while (cursor <= end && guard < 60) {
      const pricing = this.priceFor(cursor, taken, start, end);
      const closed = closedDays.has(cursor);
      days.push({
        date: cursor,
        label: BookingCalendar.formatDayLabel(cursor),
        blocked: closed,
        amountPaise: pricing.amountPaise,
        amountLabel: pricing.amountLabel,
        demand: pricing.demand,
        load: pricing.load,
        slots: SLOT_HOURS.map((slot) => ({
          slot,
          label: BookingCalendar.formatSlotLabel(slot),
          available: !closed && !reserved.has(BookingCalendar.slotKey(cursor, slot)),
          amountPaise: pricing.amountPaise,
          amountLabel: pricing.amountLabel,
          demand: pricing.demand,
        })),
      });
      cursor = BookingCalendar.addDays(cursor, 1);
      guard += 1;
    }
    return { ...this.publicConfig(), start, end, days };
  }
}

function feePaiseBase() {
  const n = parseInt(process.env.DISCOVERY_FEE_PAISE || '49900', 10);
  return Number.isFinite(n) && n > 0 ? n : 49900;
}

function calendar(settings) {
  return new BookingCalendar(settings);
}

module.exports = {
  BookingCalendar,
  SLOT_HOURS,
  TZ,
  MIN_ADVANCE_DAYS,
  WINDOW_DAYS,
  HOLD_MS,
  feePaiseBase,
  feePaise: feePaiseBase,
  formatAmount: BookingCalendar.formatAmount,
  formatSlotLabel: BookingCalendar.formatSlotLabel,
  istParts: BookingCalendar.today,
  bookingWindow: BookingCalendar.window,
  configPublic: (settings) => calendar(settings).publicConfig(),
  priceForDate: (date, taken, start, end, settings) => calendar(settings).priceFor(date, taken, start, end),
  buildAvailability: (taken, settings) => calendar(settings).availability(taken),
  isValidSlot: (date, slot, settings) => calendar(settings).isOpen(date, slot),
};
