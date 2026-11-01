const { httpError } = require('../shared/errors');

const LABELS = ['Onboarding', 'MVP', 'Development complete', 'Deployment'];
const DEFAULT_PERCENTS = [25, 25, 40, 10];

class PaymentPlan {
  static plan(value) {
    if (value === undefined) {
      return DEFAULT_PERCENTS.map((percent, index) => ({
        percent,
        timing: index ? 'after' : 'before',
      }));
    }
    if (!PaymentPlan.isValid(value)) {
      throw httpError(
        400,
        'Four phase percentages must total 100%; each must be at least 1%. Onboarding is paid before work.',
      );
    }
    return value.map((milestone) => ({ percent: milestone.percent, timing: milestone.timing }));
  }

  static isValid(value) {
    if (!Array.isArray(value) || value.length !== 4) return false;
    let total = 0;
    for (let index = 0; index < value.length; index++) {
      const milestone = value[index];
      if (!milestone || !Number.isInteger(milestone.percent) || milestone.percent < 1 || milestone.percent > 97) {
        return false;
      }
      if (milestone.timing !== 'before' && milestone.timing !== 'after') return false;
      if (index === 0 && milestone.timing !== 'before') return false;
      if (index === 3 && milestone.timing !== 'after') return false;
      total += milestone.percent;
    }
    return total === 100;
  }

  static wording(value) {
    const lines = PaymentPlan.plan(value).map((milestone, index) => {
      const when =
        milestone.timing === 'before'
          ? index
            ? 'before this phase begins, after the client approves the phase plan and payment request'
            : 'before project work begins, after agreement acceptance'
          : 'the client explicitly approves the agreed delivery for this phase';
      return `${LABELS[index]}: ${milestone.percent}% payable ${when}.`;
    });
    return `${lines.join('\n')}\nNo automatic debits. Previous phases must be paid in full before the next payment. Source/IP handover follows full payment.`;
  }
}

module.exports = {
  PaymentPlan,
  plan: (value) => PaymentPlan.plan(value),
  wording: (value) => PaymentPlan.wording(value),
};
