const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Booking = require('../models/Booking');
const Settings = require('../models/BookingSettings');
const Contact = require('../models/ContactMessage');
const RequestLimit = require('../models/RequestLimit');
const DigestDelivery = require('../models/DigestDelivery');
const { createDigestRunner } = require('../services/digest');
const { createBookingService, validSignature } = require('../services/bookingService');
const { createContactActions } = require('../services/contactActions');
const { validDate, validateSettings } = require('../services/bookingValidation');
const slots = require('../services/bookingSlots');
const express = require('express');
const { createBookingRouter, handleBookingError } = require('../services/bookingRoutes');
const { createAdminAuth } = require('../services/adminAuth');

describe('Booking and admin with a real MongoDB', () => {
  let mongo, service, gateway, emails, sequence, payment;
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    process.env.RAZORPAY_KEY_SECRET = 'test-key-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
  });
  after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
  beforeEach(async () => {
    await Promise.all([Booking.deleteMany({}), Settings.deleteMany({}), Contact.deleteMany({}), RequestLimit.deleteMany({}), DigestDelivery.deleteMany({})]);
    emails = 0; sequence = 0; payment = null;
    gateway = {
      orders: { create: async () => ({ id: `order_${++sequence}` }) },
      payments: { fetch: async () => payment },
    };
    service = createBookingService({ gateway: () => gateway, sendEmails: async () => { emails++; } });
    await service.init();
  });
  const rejectsStatus = (promise, status) => assert.rejects(promise, error => error.status === status);
  async function details() {
    const config = await service.settings();
    const { start, end } = slots.bookingWindow();
    const pricing = slots.priceForDate(start, await service.taken(start, end), start, end, config);
    return { name: 'Test Customer', email: 'person@example.com', phone: '', note: '',
      date: start, slot: '18:00', acceptTerms: true, amountPaise: pricing.amountPaise };
  }
  function paymentFor(order, overrides = {}) {
    payment = { id: 'pay_test', order_id: order.orderId, amount: order.amountPaise,
      currency: 'INR', status: 'captured', captured: true, ...overrides };
    return { bookingId: order.bookingId, razorpay_order_id: order.orderId,
      razorpay_payment_id: payment.id,
      razorpay_signature: crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${order.orderId}|${payment.id}`).digest('hex') };
  }

  it('only one concurrent request can reserve a slot before the gateway responds', async () => {
    const input = await details();
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => service.create(input)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await Booking.countDocuments({ status: 'pending_payment' }), 1);
    assert.equal(sequence, 1);
  });
  it('rejects a populated spam field before reserving a slot and accepts the normal empty field', async () => {
    const input = await details();
    await rejectsStatus(service.create({ ...input, website: true }), 400);
    await rejectsStatus(service.create({ ...input, website: 'https://spam.example' }), 400);
    assert.equal(sequence, 0);
    assert.equal(await Booking.countDocuments(), 0);
    assert.ok((await service.create({ ...input, website: false })).orderId);
    assert.equal(sequence, 1);
  });
  it('frees the reservation when order creation fails', async () => {
    const input = await details();
    gateway.orders.create = async () => { throw new Error('gateway failure'); };
    await rejectsStatus(service.create(input), 502);
    assert.equal(await Booking.countDocuments({ slotKey: { $exists: true } }), 0);
    gateway.orders.create = async () => ({ id: 'order_retry' });
    assert.ok((await service.create(input)).orderId);
  });
  it('shares checkout attempt limits across booking service instances', async () => {
    const input = await details();
    const second = createBookingService({ gateway: () => gateway, sendEmails: async () => {} });
    await second.init();
    for (let i = 0; i < 8; i++) {
      try { await service.create(input, '192.0.2.10'); } catch (error) { assert.equal(error.status, 409); }
    }
    await rejectsStatus(second.create(input, '192.0.2.10'), 429);
  });
  it('does not confirm a late payment after another customer takes the slot', async () => {
    const first = await service.create(await details());
    await Booking.updateOne({ _id: first.bookingId }, { $set: { holdExpiresAt: new Date(Date.now() - 1000) } });
    const second = await service.create(await details());
    const result = await service.verify(paymentFor(first));
    assert.equal(result.status, 'payment_review');
    assert.equal(emails, 0);
    assert.equal((await service.verify(paymentFor(second))).status, 'paid');
    assert.equal(await Booking.countDocuments({ status: 'paid' }), 1);
  });
  it('confirms an expired order if the slot has not been reassigned', async () => {
    const order = await service.create(await details());
    await Booking.updateOne({ _id: order.bookingId }, { $set: { holdExpiresAt: new Date(0) }, $unset: { slotKey: 1 } });
    assert.equal((await service.verify(paymentFor(order))).status, 'paid');
  });
  it('requires captured payments and checks gateway order, amount and currency', async () => {
    const order = await service.create(await details());
    for (const bad of [{ amount: 1 }, { currency: 'USD' }, { order_id: 'other' }]) {
      await rejectsStatus(service.verify(paymentFor(order, bad)), 400);
    }
    await rejectsStatus(service.verify(paymentFor(order, { captured: false, status: 'authorized' })), 409);
    assert.equal((await Booking.findById(order.bookingId)).status, 'pending_payment');
  });
  it('rejects malformed IDs and invalid payment signatures', async () => {
    await rejectsStatus(service.verify({ bookingId: {} }), 400);
    const order = await service.create(await details());
    await rejectsStatus(service.verify({ ...paymentFor(order), razorpay_signature: 'bad' }), 400);
    assert.equal(validSignature('x', '0'.repeat(64), ''), false);
  });
  it('concurrent verification confirms and emails once', async () => {
    const order = await service.create(await details());
    const verification = paymentFor(order);
    const results = await Promise.all(Array.from({ length: 8 }, () => service.verify(verification)));
    assert.ok(results.every(result => result.status === 'paid'));
    assert.equal(emails, 2);
  });
  it('webhook confirms payment without any browser callback and tolerates delivery retries', async () => {
    const order = await service.create(await details());
    paymentFor(order);
    const raw = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: payment } } }));
    const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    await service.webhook(raw, signature);
    await service.webhook(raw, signature);
    assert.equal((await Booking.findById(order.bookingId)).status, 'paid');
    assert.equal(emails, 2);
    await rejectsStatus(service.webhook(Buffer.from('{}'), signature), 400);
    await rejectsStatus(service.webhook(raw, undefined), 400);
  });
  it('rejects stale totals and missing consent before creating payment orders', async () => {
    const input = await details();
    await rejectsStatus(service.create({ ...input, amountPaise: input.amountPaise + 100 }), 409);
    await rejectsStatus(service.create({ ...input, acceptTerms: false }), 400);
    assert.equal(sequence, 0);
  });
  it('retries only failed email recipients without sending a second owner alert', async () => {
    const sent = { owner: 0, visitor: 0 };
    const withMail = createBookingService({ gateway: () => gateway, sendEmails: async (booking, audience) => {
      sent[audience]++;
      if (audience === 'visitor' && sent.visitor === 1) throw new Error('Temporary SMTP outage');
    } });
    await withMail.init();
    const order = await withMail.create(await details());
    await withMail.verify(paymentFor(order));
    await withMail.retryNotifications();
    assert.deepEqual(sent, { owner: 1, visitor: 2 });
    assert.equal((await Booking.findById(order.bookingId)).emailVisitorStatus, 'sent');
  });
  it('validates input lengths, types, email and blocked days', async () => {
    const input = await details();
    for (const patch of [{ name: ' ' }, { email: 'bad' }, { phone: 'x'.repeat(41) }, { email: {} }, { date: '2026-02-30' }]) {
      await rejectsStatus(service.create({ ...input, ...patch }), 400);
    }
    const config = await service.settings();
    await service.saveSettings({ version: config.version, blockedDates: [input.date] });
    await rejectsStatus(service.create(input), 400);
  });
  it('persists settings across service restart and rejects stale saves', async () => {
    const saved = await service.saveSettings({ version: 0, minRupees: 500, maxRupees: 1000 });
    assert.equal(saved.minPaise, 50000);
    await service.init();
    assert.equal((await service.settings()).minPaise, 50000);
    await rejectsStatus(service.saveSettings({ version: 0, minRupees: 2 }), 409);
  });
  it('only one simultaneous settings save succeeds', async () => {
    const results = await Promise.allSettled([
      service.saveSettings({ version: 0, minRupees: 500 }),
      service.saveSettings({ version: 0, minRupees: 600 }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await service.settings()).version, 1);
  });
  it('rejects invalid fees and impossible blocked dates rather than silently clamping', async () => {
    for (const bad of [{ minRupees: null }, { minRupees: '' }, { minRupees: -1 }, { minRupees: 0.001 },
      { minPaise: 100.5 }, { maxRupees: 1 }, { minRupees: Infinity }, { blockedDates: ['2026-02-30'] }, { blockedDates: 'tomorrow' }]) {
      await rejectsStatus(service.saveSettings({ version: 0, ...bad }), 400);
    }
    assert.equal((await service.settings()).version, 0);
    assert.equal(validDate('2024-02-29'), true);
    assert.equal(validDate('2026-02-29'), false);
    assert.equal(validateSettings({ minRupees: 1.1 }, { minPaise: 100, maxPaise: 1000 }).minPaise, 110);
    assert.equal(slots.formatAmount(110), '₹1.10');
  });
  it('migrates active older bookings into unique slot reservations', async () => {
    const input = await details();
    await Booking.create({ ...input, status: 'paid', currency: 'INR' });
    await service.init();
    await rejectsStatus(service.create(await details()), 409);
  });
  it('fails closed when historical paid bookings conflict', async () => {
    const input = await details();
    await Booking.create([{ ...input, status: 'paid' }, { ...input, status: 'paid' }]);
    await assert.rejects(service.init(), error => error.code === 11000);
    assert.equal(service.ready(), false);
  });
  it('refuses checkout before durable storage is initialized', async () => {
    const offline = createBookingService({ gateway: () => gateway, sendEmails: async () => {} });
    await rejectsStatus(offline.create(await details()), 503);
  });

  async function newContact() {
    return Contact.create({ intent: 'hire', name: 'Test', email: 'person@example.com', message: 'Hello' });
  }
  it('admin simultaneous approvals send only one visitor email', async () => {
    const contact = await newContact();
    let sent = 0;
    const actions = createContactActions({ connected: () => true, sendEmail: async () => { sent++; await new Promise(resolve => setTimeout(resolve, 20)); } });
    await Promise.allSettled(Array.from({ length: 8 }, () => actions.approve(String(contact._id))));
    await actions.approve(String(contact._id));
    assert.equal(sent, 1);
    assert.equal((await Contact.findById(contact._id)).status, 'approved');
    await rejectsStatus(actions.reject(String(contact._id)), 409);
  });
  it('reject cannot race an in-progress approval; failed mail can be retried', async () => {
    const contact = await newContact();
    let mailStarted;
    const started = new Promise(resolve => { mailStarted = resolve; });
    let finish;
    const actions = createContactActions({ connected: () => true, sendEmail: async () => {
      mailStarted(); await new Promise(resolve => { finish = resolve; }); throw new Error('smtp failed');
    } });
    const approval = actions.approve(String(contact._id));
    const assertion = rejectsStatus(approval, 502);
    await started;
    await rejectsStatus(actions.reject(String(contact._id)), 409);
    finish(); await assertion;
    const retry = createContactActions({ connected: () => true, sendEmail: async () => {} });
    await retry.approve(String(contact._id));
    assert.equal((await Contact.findById(contact._id)).status, 'approved');
  });
  it('returns client errors for invalid IDs and prevents approving rejected contacts', async () => {
    const actions = createContactActions({ connected: () => true, sendEmail: async () => {} });
    await rejectsStatus(actions.approve('bad'), 400);
    const contact = await newContact();
    await actions.reject(String(contact._id));
    await rejectsStatus(actions.approve(String(contact._id)), 409);
  });
  it('a shared daily digest claim survives restart and prevents duplicate sends', async () => {
    await newContact();
    let sends = 0;
    const makeRunner = () => createDigestRunner({ ready: () => true, send: async () => { sends++; } });
    const results = await Promise.all(Array.from({ length: 6 }, () => makeRunner()({ isMongoConnected: true })));
    assert.equal(results.filter(result => result.sent).length, 1);
    assert.equal((await makeRunner()({ isMongoConnected: true })).sent, false);
    assert.equal(sends, 1);
  });
  it('HTTP routes preserve raw webhook bytes and protect admin settings', async (t) => {
    const app = express();
    app.post('/api/bookings/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
      try { res.json(await service.webhook(req.body, req.headers['x-razorpay-signature'])); }
      catch (error) { handleBookingError(res, error); }
    });
    app.use(express.json());
    app.use('/api', createBookingRouter(service, createAdminAuth({ ADMIN_PASSWORD: 'secret', ADMIN_EMAIL: 'admin@example.com' }), () => gateway));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    assert.equal((await fetch(`${base}/admin/booking-settings`)).status, 401);
    const config = await fetch(`${base}/admin/booking-settings`, { headers: { 'x-admin-email': 'admin@example.com', 'x-admin-password': 'secret' } });
    assert.equal(config.headers.get('cache-control'), 'no-store');
    assert.equal((await config.json()).version, 0);
    const order = await service.create(await details());
    paymentFor(order);
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: payment } } }, null, 2);
    const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    const response = await fetch(`${base}/bookings/webhook`, { method: 'POST', headers: {
      'content-type': 'application/json', 'x-razorpay-signature': signature,
    }, body: raw });
    assert.equal(response.status, 200);
    assert.equal((await Booking.findById(order.bookingId)).status, 'paid');
  });
});
