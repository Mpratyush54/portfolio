function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function validateSettings(body, current) {
  const result = { ...current };
  for (const [paise, rupees] of [['minPaise', 'minRupees'], ['maxPaise', 'maxRupees']]) {
    if (Object.hasOwn(body, paise) || Object.hasOwn(body, rupees)) {
      const input = Object.hasOwn(body, paise) ? body[paise] : body[rupees];
      const n = typeof input === 'number' ? input : NaN;
      const raw = Object.hasOwn(body, paise) ? n : n * 100;
      const amount = Math.round(raw);
      if (!Number.isSafeInteger(amount) || Math.abs(raw - amount) > 0.000001 || amount < 100 || amount > 10_000_000) {
        throw httpError(400, 'Fees must be valid amounts between ₹1 and ₹100,000.');
      }
      result[paise] = amount;
    }
  }
  if (result.maxPaise < result.minPaise) throw httpError(400, 'Max fee must be at least the min fee.');
  if (Object.hasOwn(body, 'blockedDates')) {
    if (!Array.isArray(body.blockedDates) || body.blockedDates.length > 366 || !body.blockedDates.every(validDate)) {
      throw httpError(400, 'Blocked dates must contain valid calendar dates (at most 366).');
    }
    result.blockedDates = [...new Set(body.blockedDates)].sort();
  }
  return result;
}

module.exports = { validDate, httpError, validateSettings };
