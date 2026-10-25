const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'booking-settings.json');

const DEFAULTS = {
  minPaise: 29900, // ₹299
  maxPaise: 149900, // ₹1,499
  /** Full days closed: YYYY-MM-DD */
  blockedDates: [],
  updatedAt: null,
};

function read() {
  try {
    if (!fs.existsSync(FILE)) return { ...DEFAULTS, blockedDates: [] };
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return normalize(raw);
  } catch {
    return { ...DEFAULTS, blockedDates: [] };
  }
}

function normalize(raw = {}) {
  const minPaise = clampInt(raw.minPaise, DEFAULTS.minPaise, 100, 10_000_000);
  let maxPaise = clampInt(raw.maxPaise, DEFAULTS.maxPaise, 100, 10_000_000);
  if (maxPaise < minPaise) maxPaise = minPaise;

  const blockedDates = Array.isArray(raw.blockedDates)
    ? [...new Set(
        raw.blockedDates
          .map((d) => String(d || '').trim())
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      )].sort()
    : [];

  return {
    minPaise,
    maxPaise,
    blockedDates,
    updatedAt: raw.updatedAt || null,
  };
}

function clampInt(v, fallback, min, max) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function write(patch) {
  const next = normalize({ ...read(), ...patch, updatedAt: new Date().toISOString() });
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

function isBlocked(date) {
  return read().blockedDates.includes(String(date));
}

module.exports = {
  DEFAULTS,
  read,
  write,
  normalize,
  isBlocked,
};
