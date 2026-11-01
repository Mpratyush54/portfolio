const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Contact = require('../modules/contact/ContactMessage');
const Booking = require('../modules/booking/Booking');
const { createContactActions } = require('../modules/contact/actions');
const { createBookingService } = require('../modules/booking/service');
const { createQuotationService } = require('../modules/quotations/service');
const { AdminOperator } = require('../modules/operator/AdminOperator');
const { Grokbot } = require('../modules/operator/Grokbot');
const { createOperatorRouter } = require('../modules/operator/routes');
const { GoogleCalendar } = require('../modules/calendar/GoogleCalendar');
const { createAdminAuth } = require('../modules/admin/auth');

describe('Grokbot admin operator', () => {
  let mongo;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all([Contact.init(), Booking.init()]);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([Contact.deleteMany({}), Booking.deleteMany({})]);
  });

  function operator(calendar) {
    return new AdminOperator({
      bookingService: createBookingService({
        gateway: () => null,
        sendEmails: async () => {},
        calendar,
      }),
      quotationService: createQuotationService({ gateway: () => null }),
      contactActions: createContactActions({ sendEmail: async () => {} }),
      calendar,
    });
  }

  it('lists and approves contacts through named tools', async () => {
    const row = await Contact.create({
      intent: 'hire',
      name: 'Asha',
      email: 'asha@example.com',
      message: 'Need a site',
    });
    const bot = new Grokbot({ operator: operator() });
    const listed = await bot.invoke('list_contacts', { status: 'pending' });
    assert.equal(listed.total, 1);
    assert.equal(listed.rows[0].email, 'asha@example.com');
    assert.equal(listed.rows[0].ip, undefined);
    const approved = await bot.invoke('approve_contact', { id: String(row._id) });
    assert.equal(approved.success, true);
    assert.equal((await Contact.findById(row._id)).status, 'approved');
  });

  it('assigns a paid booking and writes a calendar event when Google is configured', async () => {
    const calls = [];
    const calendar = new GoogleCalendar({
      env: {
        GOOGLE_CALENDAR_ID: 'primary',
        GOOGLE_OAUTH_CLIENT_ID: 'client',
        GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
        GOOGLE_OAUTH_REFRESH_TOKEN: 'refresh',
      },
      request: async (url, options = {}) => {
        calls.push({ url: String(url), method: options.method, body: options.body });
        if (String(url).includes('oauth2.googleapis.com')) {
          return { ok: true, json: async () => ({ access_token: 'ya29.test', expires_in: 3600 }) };
        }
        return { ok: true, json: async () => ({ id: 'evt_1', htmlLink: 'https://calendar.google.com/event?eid=1' }) };
      },
    });
    const booking = await Booking.create({
      name: 'Client',
      email: 'client@example.com',
      date: '2026-11-10',
      slot: '18:00',
      amountPaise: 119900,
      status: 'paid',
    });
    const bot = new Grokbot({ operator: operator(calendar) });
    const saved = await bot.invoke('assign_booking', {
      id: String(booking._id),
      assignedTo: 'Pratyush',
      meetingUrl: 'https://meet.example.com/call',
      adminNotes: 'Discuss API',
      updatedAt: booking.updatedAt.toISOString(),
      completed: false,
    });
    assert.equal(saved.assignedTo, 'Pratyush');
    assert.equal((await Booking.findById(booking._id)).calendarEventId, 'evt_1');
    assert.ok(calls.some((call) => String(call.url).includes('/calendars/primary/events')));
    const event = JSON.parse(calls.find((call) => String(call.url).includes('/calendars/primary/events')).body);
    assert.equal(event.start.timeZone, 'Asia/Kolkata');
    assert.equal(event.start.dateTime, '2026-11-10T18:00:00+05:30');
    assert.equal(event.end.dateTime, '2026-11-10T18:30:00+05:30');
  });

  it('rejects unknown tools and refuses the HTTP API without admin or bot credentials', async () => {
    const bot = new Grokbot({ operator: operator() });
    await assert.rejects(bot.invoke('delete_everything'), (error) => error.status === 400);

    const app = express();
    app.use(express.json());
    app.use('/api', createOperatorRouter({
      grokbot: bot,
      requireAdmin: createAdminAuth({ ADMIN_PASSWORD: 'secret', ADMIN_EMAIL: 'admin@example.com' }),
      env: { GROKBOT_TOKEN: 'bot-secret' },
    }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/operator`;
    try {
      assert.equal((await fetch(`${base}/tools`)).status, 401);
      const allowed = await fetch(`${base}/invoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-grokbot-token': 'bot-secret' },
        body: JSON.stringify({ name: 'workspace_status' }),
      });
      assert.equal(allowed.status, 200);
      const body = await allowed.json();
      assert.equal(typeof body.counts.pendingContacts, 'number');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('walks Grok tool calls until it can answer in prose', async () => {
    await Contact.create({ intent: 'hi', name: 'Ravi', email: 'ravi@example.com', message: 'Hello' });
    let turns = 0;
    const bot = new Grokbot({
      operator: operator(),
      env: { XAI_API_KEY: 'xai-test', GROK_MODEL: 'grok-4-fast' },
      request: async (_url, options) => {
        turns += 1;
        const payload = JSON.parse(options.body);
        if (turns === 1) {
          return {
            ok: true,
            json: async () => ({
              choices: [{
                message: {
                  content: '',
                  tool_calls: [{
                    id: 'call_1',
                    function: { name: 'list_contacts', arguments: '{"status":"pending"}' },
                  }],
                },
              }],
            }),
          };
        }
        assert.ok(payload.messages.some((message) => message.role === 'tool'));
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'There is one pending contact from Ravi.' } }],
          }),
        };
      },
    });
    const result = await bot.chat('What contacts need a reply?');
    assert.match(result.reply, /Ravi/);
    assert.equal(result.steps[0].name, 'list_contacts');
    assert.equal(result.steps[0].result.total, 1);
  });
});
