const { httpError } = require('../shared/errors');
const quotationTemplate = require('./template');
const { cleanEditor } = require('./text');
const { LABELS } = require('./helpers');
const { looksLikeEmail } = require('../shared/text');
const { PaymentPlan } = require('../payments/plan');

const FIELD_LIMITS = {
  title: 160,
  clientName: 120,
  clientEmail: 254,
  seller: 2500,
  scope: 7000,
  exclusions: 3000,
  timeline: 3000,
  terms: 14000,
};

class QuotationValidator {
  static validate(body) {
    body = cleanEditor(body);
    if (body.builder) {
      body = { ...body, ...quotationTemplate.compile(body.builder, body.paymentSchedule) };
    }
    const data = { builder: body.builder || null };
    for (const [key, max] of Object.entries(FIELD_LIMITS)) {
      if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > max) {
        throw httpError(400, `Provide ${key} (maximum ${max} characters).`);
      }
      data[key] = body[key].trim();
    }
    data.clientEmail = data.clientEmail.toLowerCase();
    if (!looksLikeEmail(data.clientEmail)) throw httpError(400, 'Provide a valid client email.');
    if (!Number.isSafeInteger(body.totalPaise) || body.totalPaise < 10000 || body.totalPaise > 100000000) {
      throw httpError(400, 'Total must be ₹100 to ₹10,00,000 in whole paise.');
    }
    data.totalPaise = body.totalPaise;
    if (body.paymentSchedule && !body.builder) {
      const wording = PaymentPlan.wording(body.paymentSchedule);
      data.terms +=
        '\n\nPayment schedule for this quotation (takes precedence over any generic phase percentages above)\n' +
        wording;
      if (data.terms.length > 14000) {
        throw httpError(400, 'Terms and payment schedule exceed 14000 characters.');
      }
    }
    data.validUntil = new Date(body.validUntil);
    if (
      !Number.isFinite(data.validUntil.getTime()) ||
      data.validUntil <= new Date() ||
      data.validUntil > new Date(Date.now() + 90 * 86400000)
    ) {
      throw httpError(400, 'Quote validity must be in the next 90 days.');
    }
    let allocated = 0;
    data.milestones = PaymentPlan.plan(body.paymentSchedule).map(({ percent, timing }, index) => {
      const amountPaise = index === 3 ? data.totalPaise - allocated : Math.floor((data.totalPaise * percent) / 100);
      allocated += amountPaise;
      if (amountPaise < 100) throw httpError(400, 'Each phase must be at least ₹1.');
      return { label: LABELS[index], percent, amountPaise, ...(body.paymentSchedule ? { timing } : {}) };
    });
    QuotationValidator.applyMinimumOnboarding(body, data);
    return data;
  }

  static applyMinimumOnboarding(body, data) {
    const minimumInput = body.minimumOnboardingRupees ?? body.minimumOnboardingPaise;
    if (minimumInput !== undefined && minimumInput !== null && minimumInput !== '' && !Number.isFinite(Number(minimumInput))) {
      throw httpError(400, 'Enter a valid minimum onboarding payment.');
    }
    const minimumOnboardingPaise =
      minimumInput === undefined || minimumInput === null || minimumInput === ''
        ? 0
        : body.minimumOnboardingRupees !== undefined
          ? Math.round(Number(minimumInput) * 100)
          : Math.round(Number(minimumInput));
    if (!minimumOnboardingPaise) {
      data.minimumOnboardingPaise = undefined;
      return data;
    }
    const validPaise =
      body.minimumOnboardingRupees === undefined
        ? Number.isSafeInteger(minimumOnboardingPaise)
        : Number.isFinite(Number(minimumInput)) &&
          Math.abs(Number(minimumInput) * 100 - minimumOnboardingPaise) < 0.000001;
    if (!validPaise || minimumOnboardingPaise < 100 || minimumOnboardingPaise > data.totalPaise) {
      throw httpError(
        400,
        'Minimum onboarding payment must be between ₹1 and the quotation total, using whole paise.',
      );
    }
    if (data.milestones[0].amountPaise < minimumOnboardingPaise) {
      throw httpError(400, 'The onboarding phase is below the minimum payment. Increase its share.');
    }
    data.minimumOnboardingPaise = minimumOnboardingPaise;
    data.terms += `\n\nMinimum onboarding payment: ₹${(minimumOnboardingPaise / 100).toLocaleString('en-IN')}. The onboarding phase cannot be collected below this amount.`;
    if (data.terms.length > 14000) {
      throw httpError(400, 'Terms exceed 14000 characters after adding the minimum onboarding payment.');
    }
    return data;
  }
}

function validate(body) {
  return QuotationValidator.validate(body);
}

module.exports = { QuotationValidator, validate };
