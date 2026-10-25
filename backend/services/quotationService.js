const crypto = require('crypto');
const mongoose = require('mongoose');
const Quote = require('../models/Quotation');
const { httpError } = require('./bookingValidation');
const { validSignature } = require('./bookingService');
const LABELS = ['Onboarding', 'MVP', 'Development complete', 'Deployment'];
const ACKS = ['scope', 'payments', 'terms', 'authority'];
const DEFAULT_TERMS = `Deliverables and acceptance: Only the written scope is included. Each delivered milestone is available for review against that scope; report specific defects or approve it in this portal. Silence does not count as acceptance.

Payments: 25% is due before onboarding, 25% after MVP approval, 40% after development approval, and 10% after deployment approval. Work on the next phase begins after the preceding payment is captured. The quotation total is the final amount payable, including any applicable taxes specified by the provider. A quotation is not a tax invoice.

Changes and dependencies: New features, extra revisions, content entry, hosting, domains and third-party subscriptions are excluded unless listed in scope. Changes require a separate written quotation accepted by both parties before work starts. The client supplies content, access and timely feedback; client or third-party delays may change the written timeline.

Cancellation and refunds: Either party may request cancellation by email. Completed and accepted work remains payable. Unperformed work and unused advances are reconciled in writing, with any agreed refund initiated within 7 business days; bank processing may take longer. Mandatory legal rights remain unaffected. No automatic blanket non-refundable deposit applies.

Handover and intellectual property: Agreed project-specific source and deliverables transfer after full payment. Pre-existing tools and third-party components retain their existing ownership and licences. Production access and secrets are handed over securely; hosting and ongoing operations require a separate agreement.

Support: 30 calendar days from the recorded production deployment date cover reproducible defects in the agreed scope. New features, design changes, third-party outages, new platform requirements and changes by others are excluded. Report issues to the provider contact in this quotation. No ongoing maintenance or uptime promise is included.

Privacy and confidentiality: Client contact details, quotation acceptance and payment references are used to administer this project and resolve disputes. Razorpay handles payment credentials; this site does not store card details. Both parties protect confidential project information. Contact the provider for access, correction or deletion requests, subject to required record retention.

Disputes: Contact the provider first to seek a written resolution. Applicable law, venue, business identity, tax treatment and any additional project-specific commitments must be stated by the provider before inviting acceptance.`;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
function snapshot(q) {
  return {
    title: q.title,
    clientName: q.clientName,
    clientEmail: q.clientEmail,
    seller: q.seller,
    scope: q.scope,
    exclusions: q.exclusions,
    timeline: q.timeline,
    terms: q.terms,
    totalPaise: q.totalPaise,
    currency: q.currency,
    revision: q.revision,
    validUntil: q.validUntil.toISOString(),
    milestones: q.milestones.map((m) => ({
      label: m.label,
      percent: m.percent,
      amountPaise: m.amountPaise,
    })),
  };
}
function digest(q) {
  return hash(JSON.stringify(snapshot(q)));
}
function validate(body) {
  const data = {};
  for (const [key, max] of Object.entries({
    title: 160,
    clientName: 120,
    clientEmail: 254,
    seller: 1500,
    scope: 7000,
    exclusions: 3000,
    timeline: 3000,
    terms: 14000,
  })) {
    if (
      typeof body[key] !== 'string' ||
      !body[key].trim() ||
      body[key].length > max
    )
      throw httpError(400, `Provide ${key} (maximum ${max} characters).`);
    data[key] = body[key].trim();
  }
  data.clientEmail = data.clientEmail.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.clientEmail))
    throw httpError(400, 'Provide a valid client email.');
  if (
    !Number.isSafeInteger(body.totalPaise) ||
    body.totalPaise < 10000 ||
    body.totalPaise > 100000000
  )
    throw httpError(400, 'Total must be ₹100 to ₹10,00,000 in whole paise.');
  data.totalPaise = body.totalPaise;
  data.validUntil = new Date(body.validUntil);
  if (
    !Number.isFinite(data.validUntil.getTime()) ||
    data.validUntil <= new Date() ||
    data.validUntil > new Date(Date.now() + 90 * 86400000)
  )
    throw httpError(400, 'Quote validity must be in the next 90 days.');
  // Allocate residual paise to the final instalment; never round the total upward.
  let allocated = 0;
  data.milestones = [25, 25, 40, 10].map((percent, i) => {
    const amountPaise =
      i === 3
        ? data.totalPaise - allocated
        : Math.floor((data.totalPaise * percent) / 100);
    allocated += amountPaise;
    return { label: LABELS[i], percent, amountPaise };
  });
  return data;
}
function createQuotationService({ gateway }) {
  const ready = () => {
    if (mongoose.connection.readyState !== 1)
      throw httpError(503, 'Quotation storage is unavailable.');
  };
  async function get(id) {
    ready();
    if (!/^[a-f\d]{24}$/i.test(id || ''))
      throw httpError(404, 'Quotation not found.');
    const q = await Quote.findById(id);
    if (!q) throw httpError(404, 'Quotation not found.');
    return q;
  }
  async function save(q) {
    try {
      return await q.save();
    } catch (e) {
      if (e.name === 'VersionError')
        throw httpError(
          409,
          'This quotation changed. Reload before trying again.',
        );
      throw e;
    }
  }
  async function portal(token) {
    ready();
    if (typeof token !== 'string' || !/^[a-f\d]{64}$/.test(token))
      throw httpError(404, 'Invitation not found.');
    const q = await Quote.findOne({
      tokenHash: hash(token),
      tokenExpiresAt: { $gt: new Date() },
      status: { $in: ['invited', 'accepted'] },
    });
    if (!q)
      throw httpError(
        404,
        'Invitation expired or revoked. Ask for a new link.',
      );
    return q;
  }
  function view(q) {
    const data = q.toObject();
    delete data.tokenHash;
    if (!q.acceptance?.at) delete data.acceptance;
    data.digest = digest(q);
    data.paymentsEnabled = Boolean(
      gateway() && process.env.RAZORPAY_WEBHOOK_SECRET,
    );
    data.milestones.forEach((m) => {
      delete m.orderBusy;
      delete m.orderLock;
      delete m.orderLockedAt;
    });
    return data;
  }
  async function create(body) {
    ready();
    return view(await Quote.create(validate(body)));
  }
  async function edit(id, body) {
    const q = await get(id);
    if (q.status !== 'draft')
      throw httpError(409, 'Invited terms are frozen. Create a revision.');
    if (body.version !== q.__v)
      throw httpError(409, 'Reload the latest draft.');
    Object.assign(q, validate(body));
    return view(await save(q));
  }
  async function revise(id) {
    const q = await get(id);
    if (q.status === 'cancelled')
      throw httpError(409, 'This quotation already has a replacement.');
    // Paid contracts require an explicit change order; never silently replace them.
    if (q.milestones.some((m) => m.paidAt || m.orderId || m.orderBusy))
      throw httpError(
        409,
        'Payments have started. Create a separate change quotation.',
      );
    const data = snapshot(q);
    delete data.milestones;
    data.validUntil = new Date(Date.now() + 14 * 86400000);
    const revised = await Quote.create({
      ...data,
      milestones: q.milestones.map((m) => ({
        label: m.label,
        percent: m.percent,
        amountPaise: m.amountPaise,
      })),
      revision: q.revision + 1,
      previousId: q._id,
    });
    q.status = 'cancelled';
    q.tokenHash = undefined;
    try {
      await save(q);
    } catch (error) {
      await Quote.deleteOne({ _id: revised._id });
      throw error;
    }
    return view(revised);
  }
  async function invite(id, version) {
    const q = await get(id);
    if (version !== q.__v)
      throw httpError(
        409,
        'Reload and review the current quotation before creating an invitation.',
      );
    if (q.status === 'cancelled')
      throw httpError(409, 'Quotation is cancelled.');
    if (q.status !== 'accepted' && q.validUntil <= new Date())
      throw httpError(409, 'Update the expired quotation first.');
    const token = crypto.randomBytes(32).toString('hex');
    q.tokenHash = hash(token);
    q.tokenExpiresAt = new Date(Date.now() + 365 * 86400000);
    if (q.status === 'draft') q.status = 'invited';
    await save(q);
    return { token, quotation: view(q) };
  }
  async function revoke(id) {
    const q = await get(id);
    q.tokenHash = undefined;
    q.tokenExpiresAt = undefined;
    await save(q);
    return view(q);
  }
  async function accept(token, body) {
    const q = await portal(token);
    if (q.status === 'accepted') return view(q);
    if (q.validUntil <= new Date())
      throw httpError(410, 'This quotation has expired.');
    if (body.digest !== digest(q))
      throw httpError(
        409,
        'Terms changed. Reload and read the current quotation.',
      );
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.length > 120 ||
      typeof body.email !== 'string' ||
      body.email.trim().toLowerCase() !== q.clientEmail ||
      !Array.isArray(body.acknowledgements) ||
      !ACKS.every((a) => body.acknowledgements.includes(a))
    )
      throw httpError(
        400,
        'Confirm your name, invited email and every acknowledgement.',
      );
    q.acceptance = {
      name: body.name.trim(),
      email: q.clientEmail,
      at: new Date(),
      digest: digest(q),
      version: q.revision,
      acknowledgements: ACKS,
    };
    q.status = 'accepted';
    q.milestones[0].releasedAt = new Date();
    q.milestones[0].approvedAt = new Date();
    return view(await save(q));
  }
  async function release(id, index, evidence) {
    const q = await get(id);
    index = Number(index);
    if (
      q.status !== 'accepted' ||
      !Number.isInteger(index) ||
      index < 1 ||
      index > 3 ||
      !q.milestones[index - 1].paidAt
    )
      throw httpError(409, 'The previous phase must be paid first.');
    const m = q.milestones[index];
    if (m.approvedAt || m.paidAt)
      throw httpError(409, 'This milestone is already approved.');
    if (
      typeof evidence !== 'string' ||
      evidence.trim().length < 10 ||
      evidence.length > 3000
    )
      throw httpError(
        400,
        'Describe the delivery and provide review or deployment details.',
      );
    m.evidence = evidence.trim();
    m.releasedAt = new Date();
    m.feedback = '';
    if (index === 3 && !q.deployedAt) {
      q.deployedAt = new Date();
      q.supportEndsAt = new Date(q.deployedAt.getTime() + 30 * 86400000);
    }
    return view(await save(q));
  }
  async function review(token, index, body) {
    const q = await portal(token);
    index = Number(index);
    const m = q.milestones[index];
    if (body.version !== q.__v)
      throw httpError(
        409,
        'Delivery details changed. Refresh and review them before approving.',
      );
    if (
      q.status !== 'accepted' ||
      !Number.isInteger(index) ||
      index < 1 ||
      index > 3 ||
      !m?.releasedAt ||
      m.approvedAt
    )
      throw httpError(409, 'Milestone is not awaiting review.');
    if (body.approve === true) m.approvedAt = new Date();
    else {
      if (
        typeof body.feedback !== 'string' ||
        body.feedback.trim().length < 5 ||
        body.feedback.length > 3000
      )
        throw httpError(400, 'Describe the changes needed.');
      m.feedback = body.feedback.trim();
      m.releasedAt = undefined;
    }
    return view(await save(q));
  }
  async function order(token, index) {
    const q = await portal(token);
    index = Number(index);
    const m = q.milestones[index];
    if (
      q.status !== 'accepted' ||
      !Number.isInteger(index) ||
      !m ||
      !m.approvedAt ||
      m.paidAt ||
      (index > 0 && !q.milestones[index - 1].paidAt)
    )
      throw httpError(409, 'This instalment is not payable.');
    const api = gateway();
    if (!api || !process.env.RAZORPAY_WEBHOOK_SECRET)
      throw httpError(503, 'Payments are not enabled yet.');
    const result = (id) => ({
      orderId: id,
      amountPaise: m.amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      index,
    });
    if (m.orderId) return result(m.orderId);
    const lockToken = crypto.randomUUID();
    const lock = await Quote.updateOne(
      {
        _id: q._id,
        __v: q.__v,
        status: 'accepted',
        $or: [
          { [`milestones.${index}.orderBusy`]: { $ne: true } },
          {
            [`milestones.${index}.orderLockedAt`]: {
              $lt: new Date(Date.now() - 5 * 60000),
            },
          },
        ],
      },
      {
        $set: {
          [`milestones.${index}.orderBusy`]: true,
          [`milestones.${index}.orderLock`]: lockToken,
          [`milestones.${index}.orderLockedAt`]: new Date(),
        },
        $inc: { __v: 1 },
      },
    );
    if (!lock.modifiedCount)
      throw httpError(
        409,
        'Payment preparation is in progress. Reload shortly.',
      );
    try {
      const created = await api.orders.create({
        amount: m.amountPaise,
        currency: 'INR',
        receipt: `q${q._id}_${index}`,
        notes: { quotationId: String(q._id), milestone: String(index) },
      });
      const saved = await Quote.updateOne(
        { _id: q._id, [`milestones.${index}.orderLock`]: lockToken },
        {
          $set: {
            [`milestones.${index}.orderId`]: created.id,
            [`milestones.${index}.orderBusy`]: false,
          },
          $unset: { [`milestones.${index}.orderLock`]: 1 },
          $inc: { __v: 1 },
        },
      );
      if (!saved.modifiedCount)
        throw httpError(
          409,
          'Payment preparation expired. Reload before trying again.',
        );
      return result(created.id);
    } catch (error) {
      await Quote.updateOne(
        { _id: q._id, [`milestones.${index}.orderLock`]: lockToken },
        {
          $set: { [`milestones.${index}.orderBusy`]: false },
          $unset: { [`milestones.${index}.orderLock`]: 1 },
          $inc: { __v: 1 },
        },
      );
      throw error;
    }
  }
  async function confirm(orderId, paymentId) {
    ready();
    const q = await Quote.findOne({ 'milestones.orderId': orderId });
    if (!q) return false;
    const index = q.milestones.findIndex((m) => m.orderId === orderId),
      m = q.milestones[index];
    const api = gateway();
    if (!api) throw httpError(503, 'Payment verification unavailable.');
    const p = await api.payments.fetch(paymentId);
    if (
      p.order_id !== orderId ||
      p.amount !== m.amountPaise ||
      p.currency !== 'INR' ||
      p.status !== 'captured'
    )
      throw httpError(409, 'Payment is not captured for this instalment.');
    if (m.paidAt) {
      if (m.paymentId !== paymentId)
        throw httpError(409, 'Payment requires manual reconciliation.');
      return true;
    }
    await Quote.updateOne(
      { _id: q._id, [`milestones.${index}.paidAt`]: null },
      {
        $set: {
          [`milestones.${index}.paidAt`]: new Date(),
          [`milestones.${index}.paymentId`]: paymentId,
        },
        $inc: { __v: 1 },
      },
    );
    return true;
  }
  async function verify(token, body) {
    const q = await portal(token);
    if (
      !q.milestones.some((m) => m.orderId === body.razorpay_order_id) ||
      !validSignature(
        `${body.razorpay_order_id}|${body.razorpay_payment_id}`,
        body.razorpay_signature,
        process.env.RAZORPAY_KEY_SECRET,
      )
    )
      throw httpError(400, 'Invalid payment signature.');
    await confirm(body.razorpay_order_id, body.razorpay_payment_id);
    return view(await portal(token));
  }
  async function webhook(raw, signature) {
    if (
      !Buffer.isBuffer(raw) ||
      !validSignature(raw, signature, process.env.RAZORPAY_WEBHOOK_SECRET)
    )
      throw httpError(400, 'Invalid webhook signature.');
    let event;
    try {
      event = JSON.parse(raw.toString('utf8'));
    } catch {
      throw httpError(400, 'Invalid webhook body.');
    }
    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      if (
        typeof payment?.order_id !== 'string' ||
        typeof payment?.id !== 'string'
      )
        throw httpError(400, 'Invalid payment event.');
      await confirm(payment.order_id, payment.id);
    }
    return { received: true };
  }
  return {
    create,
    edit,
    revise,
    invite,
    revoke,
    accept,
    release,
    review,
    order,
    verify,
    confirm,
    webhook,
    view,
    portal,
    get,
    defaults: DEFAULT_TERMS,
    list: async () => {
      ready();
      return (await Quote.find().sort({ createdAt: -1 }).limit(100)).map(view);
    },
  };
}
module.exports = { createQuotationService, validate, digest, DEFAULT_TERMS };
