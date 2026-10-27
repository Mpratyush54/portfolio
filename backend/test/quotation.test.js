const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Quote = require('../models/Quotation');
const {
  createQuotationService,
  validate,
  DEFAULT_TERMS,
} = require('../services/quotationService');
const body = () => ({
  title: 'Client website',
  clientName: 'Client',
  clientEmail: 'client@example.com',
  seller: 'Provider name, contact, address and tax details',
  scope:
    'Landing page; three pages; contact form. Acceptance: the listed pages function on mobile.',
  exclusions: 'Hosting, domains, new features',
  timeline: 'Four weeks after content and access are supplied',
  terms: DEFAULT_TERMS,
  totalPaise: 100003,
  validUntil: new Date(Date.now() + 86400000).toISOString(),
});
const fail = (p, status) => assert.rejects(p, (e) => e.status === status);
describe('Versioned quotations with MongoDB and fake Razorpay', () => {
  let mongo, service, payment, orders;
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook';
    await Quote.init();
  });
  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });
  beforeEach(async () => {
    await Quote.deleteMany({});
    orders = 0;
    payment = null;
    service = createQuotationService({
      gateway: () => ({
        orders: {
          create: async () => ({ id: 'order_' + ++orders }),
          fetchPayments: async (id) => ({ items: payment?.order_id === id ? [payment] : [] }),
        },
        payments: { fetch: async () => payment },
      }),
    });
  });
  async function invite(id) {
    return service.invite(id, (await service.get(id)).__v);
  }
  async function review(token, index, body) {
    return service.review(token, index, {
      ...body,
      version: (await service.portal(token)).__v,
    });
  }
  async function invited() {
    const q = await service.create(body());
    return invite(q._id);
  }
  async function accepted() {
    const i = await invited();
    await service.accept(i.token, {
      name: 'Client',
      email: 'client@example.com',
      digest: i.quotation.digest,
      acknowledgements: ['scope', 'payments', 'terms', 'authority'],
    });
    return i;
  }
  async function pay(token, index) {
    const order = await service.order(token, index);
    payment = {
      id: 'pay_' + index,
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: 'INR',
      status: 'captured',
    };
    return service.verify(token, {
      razorpay_order_id: order.orderId,
      razorpay_payment_id: payment.id,
      razorpay_signature: crypto
        .createHmac('sha256', 'secret')
        .update(order.orderId + '|' + payment.id)
        .digest('hex'),
    });
  }
  it('persists guided choices and exact edited clauses through draft reload and revision', async () => {
    const template = require('../services/quotationTemplate');
    const builder = template.defaults();
    Object.assign(builder.provider, {
      name: 'Provider',
      email: 'provider@example.com',
      address: 'Example address',
      taxStatus: 'not_registered',
      venue: 'Bengaluru, Karnataka',
    });
    builder.scopeNotes =
      'Two named pages with working forms on mobile and desktop.';
    builder.clauses[0].text += ' One handover call is included.';
    const created = await service.create({ ...body(), builder });
    assert.match(created.terms, /One handover call/);
    const loaded = service.view(await service.get(created._id));
    assert.deepEqual(loaded.builder.features, builder.features);
    assert.equal(loaded.terms, created.terms);
    const replacement = await service.revise(created._id);
    assert.equal(replacement.builder.clauses[0].text, builder.clauses[0].text);
    assert.equal(replacement.terms, created.terms);
  });
  it('allocates fractional rupees without losing or adding paise', () => {
    const q = validate(body());
    assert.equal(
      q.milestones.reduce((s, m) => s + m.amountPaise, 0),
      100003,
    );
    assert.deepEqual(
      q.milestones.map((m) => m.percent),
      [25, 25, 40, 10],
    );
    assert.throws(() => validate({ ...body(), totalPaise: 10000.1 }));
  });
  it('freezes invited terms and rejects stale or incomplete acceptance', async () => {
    const i = await invited();
    await fail(service.edit(i.quotation._id, { ...body(), version: 0 }), 409);
    await fail(
      service.accept(i.token, {
        name: 'Client',
        email: 'client@example.com',
        digest: 'old',
        acknowledgements: [],
      }),
      409,
    );
    await fail(
      service.accept(i.token, {
        name: 'Client',
        email: 'other@example.com',
        digest: i.quotation.digest,
        acknowledgements: ['scope', 'payments', 'terms', 'authority'],
      }),
      400,
    );
    await fail(service.order(i.token, 0), 409);
  });
  it('keeps hashed capabilities private and rotates old links', async () => {
    const i = await invited();
    assert.equal(i.quotation.tokenHash, undefined);
    assert.equal(i.quotation.acceptance, undefined);
    const db = await Quote.findById(i.quotation._id);
    assert.notEqual(db.tokenHash, i.token);
    const next = await invite(db.id);
    await fail(service.portal(i.token), 404);
    assert.equal((await service.portal(next.token)).id, db.id);
  });
  it('rejects expired acceptance', async () => {
    const i = await invited();
    await Quote.updateOne(
      { _id: i.quotation._id },
      { $set: { validUntil: new Date(0) } },
    );
    await fail(service.accept(i.token, {}), 410);
  });
  it('creates a fresh revision and revokes the original invitation', async () => {
    const i = await invited();
    const q = await service.revise(i.quotation._id);
    assert.equal(q.revision, 2);
    assert.equal(q.status, 'draft');
    await fail(service.portal(i.token), 404);
  });
  it('runs all four phases with client approval, captured payments and support date', async () => {
    const i = await accepted();
    const id = i.quotation._id;
    await fail(service.release(id, 1, 'MVP delivery for review'), 409);
    let q = await pay(i.token, 0);
    const digest = q.acceptance.digest;
    for (let index = 1; index < 4; index++) {
      await service.release(
        id,
        index,
        'Delivered agreed scope: https://example.com/review',
      );
      await fail(service.order(i.token, index), 409);
      await review(i.token, index, { approve: true });
      q = await pay(i.token, index);
    }
    assert.equal(
      q.milestones.every((m) => m.paidAt),
      true,
    );
    assert.equal(q.acceptance.digest, digest);
    assert.equal(
      new Date(q.supportEndsAt) - new Date(q.deployedAt),
      30 * 86400000,
    );
    await fail(service.revise(id), 409);
  });
  it('reuses checkout orders and handles duplicate confirmation', async () => {
    const i = await accepted();
    const order = await service.order(i.token, 0);
    assert.equal((await service.order(i.token, 0)).orderId, order.orderId);
    assert.equal(orders, 1);
    await pay(i.token, 0);
    assert.equal(await service.confirm('order_1', 'pay_0'), true);
  });
  it('collects an admin-approved part payment once, preserves debt and locks the next milestone', async () => {
    const i = await accepted();
    let q = await service.portal(i.token);
    const originalDigest = service.view(q).digest;
    await service.collection(q.id, 0, { version: q.__v, amountPaise: 5000, reason: 'Client agreed smaller initial collection' });
    const order = await service.order(i.token, 0);
    assert.equal(order.amountPaise, 5000);
    q = await service.portal(i.token);
    await fail(service.collection(q.id, 0, { version: q.__v, amountPaise: 6000, reason: 'Attempt to change issued checkout' }), 409);
    payment = { id: 'partial', order_id: order.orderId, amount: 5000, currency: 'INR', status: 'captured' };
    await Promise.all([service.confirm(order.orderId, 'partial'), service.confirm(order.orderId, 'partial')]);
    q = service.view(await service.portal(i.token));
    assert.equal(q.milestones[0].paidPaise, 5000);
    assert.equal(q.milestones[0].remainingPaise, 20000);
    assert.equal(q.milestones[0].paidAt, undefined);
    assert.equal(q.milestones[0].payments.length, 1);
    assert.equal(q.digest, originalDigest);
    assert.equal(q.totalPaise, 100003);
    await fail(service.release(q._id, 1, 'Trying to bypass outstanding balance'), 409);
    await fail(service.revise(q._id), 409);
    const balance = await service.order(i.token, 0);
    assert.equal(balance.amountPaise, 20000);
    // An old signed retry must not clear or credit the newer balance order.
    assert.equal(await service.confirm(order.orderId, 'partial'), true);
    assert.equal((await service.portal(i.token)).milestones[0].orderId, balance.orderId);
    payment = { id: 'balance', order_id: balance.orderId, amount: 20000, currency: 'INR', status: 'captured' };
    await service.confirm(balance.orderId, 'balance');
    q = service.view(await service.portal(i.token));
    assert.ok(q.milestones[0].paidAt);
    assert.equal(q.milestones[0].paidPaise, 25000);
    assert.equal(q.milestones[0].remainingPaise, 0);
    assert.equal(q.milestones[0].payments.length, 2);
    await service.release(q._id, 1, 'MVP now eligible for client review');
  });
  it('allows admin to arrange a smaller onboarding payment before acceptance without changing terms', async () => {
    const i = await invited();
    const q = await service.portal(i.token);
    const updated = await service.collection(q.id, 0, { version: q.__v, amountPaise: 5000, reason: 'Smaller onboarding payment agreed with client' });
    assert.equal(updated.digest, i.quotation.digest);
    await fail(service.order(i.token, 0), 409);
    await service.accept(i.token, { name: 'Client', email: 'client@example.com', digest: updated.digest, acknowledgements: ['scope', 'payments', 'terms', 'authority'] });
    assert.equal((await service.order(i.token, 0)).amountPaise, 5000);
  });
  it('rejects invalid, stale and premature collection arrangements', async () => {
    const i = await accepted();
    const q = await service.portal(i.token);
    for (const amountPaise of [0, -1, 99, 24999, 25001, 1.5, '5000']) {
      await fail(service.collection(q.id, 0, { version: q.__v, amountPaise, reason: 'Client arrangement' }), 400);
    }
    await fail(service.collection(q.id, 0, { version: q.__v + 1, amountPaise: 5000, reason: 'Client arrangement' }), 409);
    await fail(service.collection(q.id, 1, { version: q.__v, amountPaise: 5000, reason: 'Client arrangement' }), 409);
    await fail(service.collection(q.id, 0, { version: q.__v, amountPaise: 5000, reason: '' }), 400);
  });
  it('rejects cross-quotation verification even with an otherwise valid signature', async () => {
    const first = await accepted(), second = await accepted();
    const order = await service.order(first.token, 0);
    await fail(service.verify(second.token, {
      razorpay_order_id: order.orderId, razorpay_payment_id: 'pay',
      razorpay_signature: crypto.createHmac('sha256', 'secret').update(order.orderId + '|pay').digest('hex'),
    }), 400);
  });
  it('recovers a captured payment after the browser callback and webhook were lost', async () => {
    const i = await accepted();
    const order = await service.order(i.token, 0);
    payment = { id: 'lost_callback', order_id: order.orderId, amount: order.amountPaise, currency: 'INR', status: 'captured' };
    const recovered = await service.order(i.token, 0);
    assert.equal(recovered.alreadyPaid, true);
    assert.ok(recovered.quotation.milestones[0].paidAt);
    assert.equal(orders, 1);
  });
  it('blocks competing checkout while a gateway payment is processing', async () => {
    const i = await accepted();
    const order = await service.order(i.token, 0);
    payment = { id: 'processing', order_id: order.orderId, amount: order.amountPaise, currency: 'INR', status: 'authorized' };
    await fail(service.order(i.token, 0), 409);
    assert.equal(orders, 1);
  });
  it('serialises simultaneous order creation', async () => {
    const i = await accepted();
    const results = await Promise.allSettled([
      service.order(i.token, 0),
      service.order(i.token, 0),
    ]);
    assert.ok(results.some((r) => r.status === 'fulfilled'));
    assert.equal(orders, 1);
  });
  it('never marks mismatched amount or authorised payment as paid', async () => {
    const i = await accepted();
    const order = await service.order(i.token, 0);
    payment = {
      id: 'bad',
      order_id: order.orderId,
      amount: order.amountPaise + 1,
      currency: 'INR',
      status: 'captured',
    };
    await fail(service.confirm(order.orderId, 'bad'), 409);
    payment.amount = order.amountPaise;
    payment.status = 'authorized';
    await fail(service.confirm(order.orderId, 'bad'), 409);
    assert.equal(
      (await service.portal(i.token)).milestones[0].paidAt,
      undefined,
    );
  });
  it('rejects stale draft writes and revokes links without deleting contracts', async () => {
    const q = await service.create(body());
    await service.edit(q._id, {
      ...body(),
      version: q.__v,
      title: 'Updated project',
    });
    await fail(service.edit(q._id, { ...body(), version: q.__v }), 409);
    const invitation = await invite(q._id);
    await service.revoke(q._id);
    await fail(service.portal(invitation.token), 404);
    assert.equal((await service.get(q._id)).title, 'Updated project');
  });
  it('recovers a crashed checkout preparation after its ownership lease expires', async () => {
    const i = await accepted();
    await Quote.updateOne(
      { _id: i.quotation._id },
      {
        $set: {
          'milestones.0.orderBusy': true,
          'milestones.0.orderLock': 'old',
          'milestones.0.orderLockedAt': new Date(Date.now() - 6 * 60000),
        },
      },
    );
    const order = await service.order(i.token, 0);
    assert.equal(order.orderId, 'order_1');
  });
  it('confirms exact signed raw webhook bytes, tolerates duplicates and rejects tampering', async () => {
    const i = await accepted();
    const order = await service.order(i.token, 0);
    payment = {
      id: 'pay_hook',
      order_id: order.orderId,
      amount: order.amountPaise,
      currency: 'INR',
      status: 'captured',
    };
    const raw = Buffer.from(
      JSON.stringify(
        {
          event: 'payment.captured',
          payload: { payment: { entity: payment } },
        },
        null,
        2,
      ),
    );
    const signature = crypto
      .createHmac('sha256', 'webhook')
      .update(raw)
      .digest('hex');
    await service.webhook(raw, signature);
    await service.webhook(raw, signature);
    assert.equal(
      (await service.portal(i.token)).milestones[0].paymentId,
      'pay_hook',
    );
    await fail(service.webhook(Buffer.from('{}'), signature), 400);
  });
  it('rejects stale delivery approvals and invitations', async () => {
    const q = await service.create(body());
    await fail(service.invite(q._id, q.__v + 1), 409);
    const i = await accepted();
    await pay(i.token, 0);
    await service.release(i.quotation._id, 1, 'MVP first delivery to review');
    const stale = await service.portal(i.token);
    await service.release(
      i.quotation._id,
      1,
      'MVP replaced delivery to review',
    );
    await fail(
      service.review(i.token, 1, { approve: true, version: stale.__v }),
      409,
    );
  });
  it('allows scoped change requests and requires delivery again before approval', async () => {
    const i = await accepted();
    await pay(i.token, 0);
    await service.release(i.quotation._id, 1, 'MVP is available for review');
    await review(i.token, 1, {
      approve: false,
      feedback: 'Contact form fails validation',
    });
    await fail(review(i.token, 1, { approve: true }), 409);
    await service.release(
      i.quotation._id,
      1,
      'Contact form fixed, please review',
    );
    await review(i.token, 1, { approve: true });
    assert.ok((await service.portal(i.token)).milestones[1].approvedAt);
  });
});
