const { httpError } = require('./bookingValidation');
const labels = ['Onboarding', 'MVP', 'Development complete', 'Deployment'];
function plan(value) {
  if (value === undefined) return [25, 25, 40, 10].map((percent, i) => ({ percent, timing: i ? 'after' : 'before' }));
  if (!Array.isArray(value) || value.length !== 4 || value.some((m, i) => !m ||
      !Number.isInteger(m.percent) || m.percent < 1 || m.percent > 97 ||
      !['before', 'after'].includes(m.timing) || (!i && m.timing !== 'before') || (i === 3 && m.timing !== 'after')) ||
      value.reduce((n, m) => n + m.percent, 0) !== 100)
    throw httpError(400, 'Four phase percentages must total 100%; each must be at least 1%. Onboarding is paid before work.');
  return value.map(m => ({ percent: m.percent, timing: m.timing }));
}
function wording(value) {
  return plan(value).map((m, i) => `${labels[i]}: ${m.percent}% payable ${m.timing === 'before'
    ? (i ? 'before this phase begins, after the client approves the phase plan and payment request' : 'before project work begins, after agreement acceptance')
    : 'the client explicitly approves the agreed delivery for this phase'}.`).join('\n') +
    '\nNo automatic debits. Previous phases must be paid in full before the next payment. Source/IP handover follows full payment.';
}
module.exports = { plan, wording };
