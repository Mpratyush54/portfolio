const crypto = require('crypto');
const mongoose = require('mongoose');
const Quote = require('../models/Quotation');
const { httpError } = require('./bookingValidation');
const { validSignature } = require('./bookingService');
const LABELS = ['Onboarding', 'MVP', 'Development complete', 'Deployment'];
const ACKS = ['scope', 'payments', 'terms', 'authority'];
const quotationTemplate = require('./quotationTemplate');
const { cleanEditor } = require('./quotationText');
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
    currency: q.currency,
    revision: q.revision,
    validUntil: q.validUntil.toISOString(),
    milestones: q.milestones.map((m) => ({
      label: m.label,
      percent: m.percent,
      amountPaise: m.amountPaise,
    })),
  };
  // Keep existing agreements' fingerprints stable when they have no attachments.
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
  // Older contracts recorded one full payment without a ledger.
  return m.paidAt ? m.amountPaise : (m.payments || []).reduce((sum, p) => sum + p.amountPaise, 0);
}
function payableAmount(m) {
  return m.orderId ? (m.orderAmountPaise ?? m.amountPaise) : (m.collectionPaise ?? (m.amountPaise - paidAmount(m)));
}
function validate(body) {
  body = cleanEditor(body);
  if (body.builder)
    body = { ...body, ...quotationTemplate.compile(body.builder) };
  const data = { builder: body.builder || null };
  for (const [key, max] of Object.entries({
    title: 160,
    clientName: 120,
    clientEmail: 254,
    seller: 2500,
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
  function view(q, admin = false) {
    const data = q.toObject();
    delete data.tokenHash;
    delete data.clientDraftId;
    delete data.lastDraftMutation;
    if (!admin) delete data.draftEditor;
    if (!q.acceptance?.at) delete data.acceptance;
    data.digest = digest(q);
    data.paymentsEnabled = Boolean(
      gateway() && process.env.RAZORPAY_WEBHOOK_SECRET,
    );
    data.milestones.forEach((m) => {
      m.paidPaise = paidAmount(m);
      m.remainingPaise = m.amountPaise - m.paidPaise;
      m.payablePaise = m.paidAt ? 0 : payableAmount(m);
      delete m.orderBusy;
      delete m.orderLock;
      delete m.orderLockedAt;
    });
    return data;
  }
  async function create(body) {
    ready();
    return view(
      await Quote.create({ ...validate(body), draftReady: true }),
      true,
    );
  }
  async function edit(id, body) {
    const q = await get(id);
    if (q.status !== 'draft')
      throw httpError(409, 'Invited terms are frozen. Create a revision.');
    if (body.version !== q.__v)
      throw httpError(409, 'Reload the latest draft.');
    Object.assign(q, validate(body));
    q.draftReady = true;
    q.draftValidation = undefined;
    q.draftEditor = undefined;
    return view(await save(q), true);
  }
  async function saveDraft(body) {
    ready();
    const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
    if (
      !uuid.test(body.clientDraftId || '') ||
      !uuid.test(body.mutationId || '') ||
      !body.editor ||
      Array.isArray(body.editor) ||
      typeof body.editor !== 'object'
    )
      throw httpError(400, 'Invalid draft request.');
    if (JSON.stringify(body.editor).length > 40000)
      throw httpError(413, 'Draft is too large.');
    const allowed = [
      'title',
      'clientName',
      'clientEmail',
      'seller',
      'scope',
      'exclusions',
      'timeline',
      'terms',
      'builder',
      'totalRupees',
      'validDate',
    ];
    const editor = cleanEditor(
      Object.fromEntries(
        allowed
          .filter((key) => body.editor[key] !== undefined)
          .map((key) => [key, body.editor[key]]),
      ),
    );
    let q = body.id
      ? await get(body.id)
      : await Quote.findOne({ clientDraftId: body.clientDraftId });
    if (q?.lastDraftMutation === body.mutationId) return view(q, true);
    if (q && (q.status !== 'draft' || q.__v !== body.version))
      throw httpError(
        409,
        'This draft changed elsewhere. Reload it before saving again.',
      );
    const isNew = !q;
    if (!q)
      q = new Quote({
        clientDraftId: body.clientDraftId,
        status: 'draft',
        title: 'Untitled quotation',
        validUntil: new Date(Date.now() + 14 * 86400000),
        milestones: [],
      });
    q.draftEditor = editor;
    q.lastDraftMutation = body.mutationId;
    q.title =
      typeof editor.title === 'string' && editor.title.trim()
        ? editor.title.trim().slice(0, 160)
        : 'Untitled quotation';
    q.clientName =
      typeof editor.clientName === 'string'
        ? editor.clientName.slice(0, 120)
        : '';
    q.clientEmail =
      typeof editor.clientEmail === 'string'
        ? editor.clientEmail.slice(0, 254)
        : '';
    q.draftReady = false;
    q.draftValidation = undefined;
    try {
      const paise = Number(editor.totalRupees) * 100;
      if (Math.abs(paise - Math.round(paise)) > 0.000001)
        throw httpError(400, 'Use whole paise.');
      Object.assign(
        q,
        validate({
          ...editor,
          totalPaise: Math.round(paise),
          validUntil: `${editor.validDate}T23:59:59+05:30`,
        }),
      );
      q.draftReady = true;
      q.draftValidation = undefined;
    } catch (error) {
      if (error.status !== 400) throw error;
      q.draftValidation = error.message;
    }
    try {
      return view(await save(q), true);
    } catch (error) {
      if (isNew && error.code === 11000) {
        const existing = await Quote.findOne({
          clientDraftId: body.clientDraftId,
        });
        if (existing?.lastDraftMutation === body.mutationId)
          return view(existing, true);
        throw httpError(409, 'Draft already exists. Reload the draft list.');
      }
      throw error;
    }
  }
  async function revise(id) {
    const q = await get(id);
    if (q.status === 'cancelled')
      throw httpError(409, 'This quotation already has a replacement.');
    // Paid contracts require an explicit change order; never silently replace them.
    if (q.milestones.some((m) => m.paidAt || m.orderId || m.orderBusy || m.payments.length))
      throw httpError(
        409,
        'Payments have started. Create a separate change quotation.',
      );
    const data = snapshot(q);
    if (q.draftReady === false)
      throw httpError(409, 'Finish this draft before creating a revision.');
    if (q.srs?.length) data.srs = q.srs.map((s) => s.toObject());
    if (q.builder) data.builder = q.builder;
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
    if (q.draftReady === false)
      throw httpError(
        409,
        'Complete the required fields before inviting the client.',
      );
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
      amountPaise: payableAmount(m),
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      index,
    });
    if (m.orderId) {
      const payments = await api.orders.fetchPayments(m.orderId);
      const captured = payments.items.find((p) => p.status === 'captured');
      if (captured) {
        await confirm(m.orderId, captured.id);
        return { alreadyPaid: true, quotation: view(await portal(token)) };
      }
      // Do not issue a competing order while a previous attempt can still capture.
      if (payments.items.some((p) => p.status !== 'failed'))
        throw httpError(409, 'A payment is processing. Wait and refresh its status before trying again.');
      return result(m.orderId);
    }
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
        amount: payableAmount(m),
        currency: 'INR',
        partial_payment: false,
        receipt: `q${q._id}_${index}_${(m.payments || []).length}`,
        notes: { quotationId: String(q._id), milestone: String(index) },
      });
      const saved = await Quote.updateOne(
        { _id: q._id, [`milestones.${index}.orderLock`]: lockToken },
        {
          $set: {
            [`milestones.${index}.orderId`]: created.id,
            [`milestones.${index}.orderAmountPaise`]: payableAmount(m),
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
  async function collection(id, index, body) {
    const q = await get(id);
    index = Number(index);
    const m = q.milestones[index];
    if (body.version !== q.__v) throw httpError(409, 'Reload the latest payment status.');
    if (q.status !== 'accepted' || !Number.isInteger(index) || !m?.approvedAt || m.paidAt ||
        (index > 0 && !q.milestones[index - 1].paidAt))
      throw httpError(409, 'This milestone is not payable.');
    // An issued order can still capture later. Never replace its amount.
    if (m.orderId || m.orderBusy) throw httpError(409, 'Checkout already prepared. Its payment must be reconciled before changing the amount.');
    const remaining = m.amountPaise - paidAmount(m);
    if (!Number.isSafeInteger(body.amountPaise) || body.amountPaise < 100 || body.amountPaise > remaining ||
        (remaining - body.amountPaise > 0 && remaining - body.amountPaise < 100))
      throw httpError(400, 'Enter at least ₹1, no more than the balance, leaving either zero or at least ₹1 due.');
    if (typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.length > 500)
      throw httpError(400, 'Provide a reason (5–500 characters) for the collection arrangement.');
    m.collectionPaise = body.amountPaise;
    m.collections.push({ amountPaise: body.amountPaise, reason: body.reason.trim(), at: new Date() });
    return view(await save(q), true);
  }
  async function confirm(orderId, paymentId, attempt = 0) {
    ready();
    if (typeof orderId !== 'string' || typeof paymentId !== 'string')
      throw httpError(400, 'Invalid payment identifiers.');
    const q = await Quote.findOne({ $or: [{ 'milestones.orderId': orderId }, { 'milestones.payments.orderId': orderId }] });
    if (!q) return false;
    const index = q.milestones.findIndex((m) => m.orderId === orderId || m.payments.some((p) => p.orderId === orderId)),
      m = q.milestones[index];
    const recorded = m.payments.find((p) => p.orderId === orderId);
    const expected = recorded?.amountPaise ?? m.orderAmountPaise ?? m.amountPaise;
    const api = gateway();
    if (!api) throw httpError(503, 'Payment verification unavailable.');
    const p = await api.payments.fetch(paymentId);
    if (
      p.order_id !== orderId ||
      p.id !== paymentId ||
      p.amount !== expected ||
      p.currency !== 'INR' ||
      p.status !== 'captured' ||
      (p.amount_refunded || 0) !== 0
    )
      throw httpError(409, 'Payment is not captured for this instalment.');
    if (recorded || m.paidAt) {
      if ((recorded?.paymentId ?? m.paymentId) !== paymentId)
        throw httpError(409, 'Payment requires manual reconciliation.');
      return true;
    }
    if (q.status !== 'accepted' || !m.approvedAt || (index > 0 && !q.milestones[index - 1].paidAt))
      throw httpError(409, 'Payment requires manual reconciliation.');
    const total = paidAmount(m) + expected;
    if (total > m.amountPaise) throw httpError(409, 'Payment exceeds the milestone balance.');
    const now = new Date();
    const complete = total === m.amountPaise;
    const updated = await Quote.updateOne(
      { _id: q._id, __v: q.__v, [`milestones.${index}.orderId`]: orderId },
      {
        $set: complete ? {
          [`milestones.${index}.paidAt`]: now,
          [`milestones.${index}.paymentId`]: paymentId,
        } : {},
        $push: { [`milestones.${index}.payments`]: { orderId, paymentId, amountPaise: expected, at: now } },
        $unset: {
          [`milestones.${index}.orderId`]: 1,
          [`milestones.${index}.orderAmountPaise`]: 1,
          [`milestones.${index}.collectionPaise`]: 1,
        },
        $inc: { __v: 1 },
      },
    );
    if (!updated.modifiedCount) {
      if (attempt >= 4) throw httpError(409, 'Payment status changed. Retry verification.');
      return confirm(orderId, paymentId, attempt + 1);
    }
    return true;
  }
  async function verify(token, body) {
    const q = await portal(token);
    if (
      !q.milestones.some((m) => m.orderId === body.razorpay_order_id || m.payments.some((p) => p.orderId === body.razorpay_order_id)) ||
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
    saveDraft,
    edit,
    revise,
    invite,
    revoke,
    accept,
    release,
    review,
    order,
    collection,
    verify,
    confirm,
    webhook,
    view,
    portal,
    get,
    defaults: DEFAULT_TERMS,
    template: () => ({
      terms: DEFAULT_TERMS,
      catalog: quotationTemplate.catalog,
      builder: quotationTemplate.defaults(),
    }),
    preview: (builder) => quotationTemplate.compile(builder),
    list: async () => {
      ready();
      return (await Quote.find().sort({ updatedAt: -1 }).limit(100)).map((q) =>
        view(q, true),
      );
    },
  };
}
module.exports = { createQuotationService, validate, digest, DEFAULT_TERMS };
