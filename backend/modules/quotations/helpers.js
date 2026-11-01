const crypto = require('crypto');
const quotationTemplate = require('./template');

const LABELS = ['Onboarding', 'MVP', 'Development complete', 'Deployment'];
const ACKS = ['scope', 'payments', 'terms', 'authority'];
const DEFAULT_TERMS = quotationTemplate.clauses
  .map((c, i) => `${i + 1}. ${c.title}\n${c.text}`)
  .join('\n\n');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
function snapshot(q) {
  const result = {
    title: q.title,
    clientName: q.clientName,
    clientEmail: q.clientEmail,
    seller: q.seller,
    scope: q.scope,
    exclusions: q.exclusions,
    timeline: q.timeline,
    terms: q.terms,
    totalPaise: q.totalPaise,
    ...(q.minimumOnboardingPaise ? { minimumOnboardingPaise: q.minimumOnboardingPaise } : {}),
    currency: q.currency,
    revision: q.revision,
    validUntil: q.validUntil.toISOString(),
    milestones: q.milestones.map((m) => ({
      label: m.label,
      percent: m.percent,
      amountPaise: m.amountPaise,
      ...(m.timing ? { timing: m.timing } : {}),
    })),
  };
  if (q.srs?.length)
    result.srs = q.srs.map((s) => ({
      fileId: String(s.fileId),
      name: s.name,
      size: s.size,
      sha256: s.sha256,
    }));
  return result;
}
function digest(q) {
  return hash(JSON.stringify(snapshot(q)));
}
function paidAmount(m) {
  return m.paidAt ? m.amountPaise : (m.payments || []).reduce((sum, p) => sum + p.amountPaise, 0);
}
function payableAmount(m) {
  return m.orderId ? (m.orderAmountPaise ?? m.amountPaise) : (m.collectionPaise ?? (m.amountPaise - paidAmount(m)));
}
module.exports = { LABELS, ACKS, DEFAULT_TERMS, hash, snapshot, digest, paidAmount, payableAmount };
