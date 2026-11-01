const { z } = require('zod');
const { httpError } = require('../shared/errors');
const { looksLikeEmail } = require('../shared/text');

const LIMITS = { name: 100, email: 254, phone: 40, company: 120, message: 5000 };
const INTENTS = ['hire', 'freelance', 'hi'];

class ContactValidator {
  static submission(body) {
    const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    if (input.website) return { spam: true };
    if (!INTENTS.includes(input.intent)) {
      throw httpError(400, 'Please choose Hire me, Freelance, or Just say hi.');
    }
    if (!input.name || !input.email || !input.message) {
      throw httpError(400, 'Name, email, and message are required.');
    }
    const details = {
      intent: input.intent,
      name: String(input.name).trim(),
      email: String(input.email).trim(),
      phone: input.phone ? String(input.phone).trim() : '',
      company: input.company ? String(input.company).trim() : '',
      message: String(input.message).trim(),
    };
    if (!details.name || !details.message) {
      throw httpError(400, 'Name and message cannot be blank.');
    }
    if (!looksLikeEmail(details.email)) {
      throw httpError(400, 'Please provide a valid email address.');
    }
    for (const [field, limit] of Object.entries(LIMITS)) {
      if (details[field].length > limit) {
        throw httpError(400, 'One or more fields exceed the maximum length.');
      }
    }
    return details;
  }

  static listStatus(status) {
    if (!status) return '';
    const parsed = z.enum(['pending', 'approved', 'rejected']).safeParse(status);
    if (!parsed.success) throw httpError(400, 'Invalid contact status.');
    return parsed.data;
  }
}

module.exports = { ContactValidator, LIMITS, INTENTS };
