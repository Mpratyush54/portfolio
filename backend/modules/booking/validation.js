const { z } = require('zod');
const { httpError } = require('../shared/errors');
const { isMongoObjectId, looksLikeEmail, parseIsoDate } = require('../shared/text');
const { validId } = require('../payments/security');

const FIELD_LIMITS = { name: 100, email: 254, phone: 40, note: 2000, date: 10, slot: 5 };

class BookingValidator {
  static isCalendarDate(value) {
    if (!parseIsoDate(value)) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  static settings(body, current) {
    const result = { ...current };
    for (const [paise, rupees] of [
      ['minPaise', 'minRupees'],
      ['maxPaise', 'maxRupees'],
    ]) {
      if (!Object.hasOwn(body, paise) && !Object.hasOwn(body, rupees)) continue;
      const input = Object.hasOwn(body, paise) ? body[paise] : body[rupees];
      const n = typeof input === 'number' ? input : NaN;
      const raw = Object.hasOwn(body, paise) ? n : n * 100;
      const amount = Math.round(raw);
      if (!Number.isSafeInteger(amount) || Math.abs(raw - amount) > 0.000001 || amount < 100 || amount > 10_000_000) {
        throw httpError(400, 'Fees must be valid amounts between ₹1 and ₹100,000.');
      }
      result[paise] = amount;
    }
    if (result.maxPaise < result.minPaise) throw httpError(400, 'Max fee must be at least the min fee.');
    if (Object.hasOwn(body, 'blockedDates')) {
      if (!Array.isArray(body.blockedDates) || body.blockedDates.length > 366 || !body.blockedDates.every((d) => BookingValidator.isCalendarDate(d))) {
        throw httpError(400, 'Blocked dates must contain valid calendar dates (at most 366).');
      }
      result.blockedDates = [...new Set(body.blockedDates)].sort();
    }
    return result;
  }

  static checkout(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Invalid booking details.');
    if (body.website) throw httpError(400, 'Unable to create booking.');
    const details = {};
    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
      const input = body[field] ?? '';
      if (typeof input !== 'string' || input.trim().length > limit) throw httpError(400, `Invalid ${field}.`);
      details[field] = input.trim();
    }
    details.email = details.email.toLowerCase();
    if (!details.name || !looksLikeEmail(details.email)) throw httpError(400, 'A name and valid email are required.');
    if (body.acceptTerms !== true) throw httpError(400, 'Please accept the terms before paying.');
    return details;
  }

  static paymentConfirmation(body) {
    if (
      !body ||
      typeof body.bookingId !== 'string' ||
      !isMongoObjectId(body.bookingId) ||
      !validId(body.razorpay_order_id, 'order') ||
      !validId(body.razorpay_payment_id, 'pay')
    ) {
      throw httpError(400, 'Invalid payment fields.');
    }
    return body;
  }

  static assignment(body) {
    const parsed = z
      .object({
        assignedTo: z.string().max(120).default(''),
        meetingUrl: z.string().max(500).default(''),
        adminNotes: z.string().max(2000).default(''),
        updatedAt: z.string().refine((value) => Number.isFinite(new Date(value).getTime())),
        completed: z.boolean(),
      })
      .safeParse(body);
    if (!parsed.success) throw httpError(400, 'Invalid assignment details.');
    if (parsed.data.meetingUrl) BookingValidator.httpsMeetingUrl(parsed.data.meetingUrl);
    return parsed.data;
  }

  static httpsMeetingUrl(value) {
    let link;
    try {
      link = new URL(value);
    } catch {
      throw httpError(400, 'Provide a valid HTTPS meeting link.');
    }
    if (link.protocol !== 'https:' || link.username || link.password) {
      throw httpError(400, 'Meeting link must use HTTPS and contain no credentials.');
    }
    return link;
  }
}

function validDate(value) {
  return BookingValidator.isCalendarDate(value);
}

function validateSettings(body, current) {
  return BookingValidator.settings(body, current);
}

module.exports = { BookingValidator, validDate, validateSettings };
