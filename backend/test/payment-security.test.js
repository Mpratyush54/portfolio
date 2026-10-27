const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Counter = require('../models/RequestLimit');
const Receipt = require('../models/WebhookReceipt');
const { consume, limitRequests, apiRateLimits } = require('../services/rateLimits');
const { clientAddress, rateAddress } = require('../services/clientAddress');
const { parseWebhook, onceCaptured, webhookGuard } = require('../services/paymentSecurity');
const { createAdminAuth } = require('../services/adminAuth');
const fail = (promise, status) => assert.rejects(promise, error => error.status === status);

it('trusts Cloudflare visitor headers only behind a verified Cloudflare source', () => {
  assert.equal(clientAddress({ ip: '198.51.100.4', headers: { 'cf-connecting-ip': '203.0.113.1' } }), '198.51.100.4');
  assert.equal(clientAddress({ ip: '173.245.48.5', headers: { 'cf-connecting-ip': '203.0.113.1' } }), '203.0.113.1');
  assert.equal(clientAddress({ ip: '173.245.48.5', headers: { 'cf-connecting-ip': 'fake, 203.0.113.1' } }), '173.245.48.5');
  assert.equal(clientAddress({ ip: '173.245.48.5', headers: { 'cf-connecting-ip': ['203.0.113.1'] } }), '173.245.48.5');
  assert.equal(clientAddress({ ip: '2606:4700::1', headers: { 'cf-connecting-ip': '2001:db8::1' } }), '2001:db8::1');
  assert.equal(rateAddress('::ffff:192.0.2.4'), rateAddress('192.0.2.4'));
  assert.equal(rateAddress('::ffff:c000:204'), rateAddress('192.0.2.4'));
  assert.equal(rateAddress('2001:0db8:0001:0002::1'), rateAddress('2001:db8:1:2:ffff::2'));
  assert.notEqual(rateAddress('2001:db8:1:2::1'), rateAddress('2001:db8:1:3::1'));
});

describe('Distributed rate limits and webhook processing with MongoDB', () => {
  let mongo, servers = [];
  before(async () => {
    mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri());
    await Promise.all([Counter.init(), Receipt.init()]);
    process.env.RAZORPAY_WEBHOOK_SECRET = 'unit-webhook-secret';
  });
  after(async () => {
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await mongoose.disconnect(); await mongo.stop();
  });
  beforeEach(async () => { await Promise.all([Counter.deleteMany({}), Receipt.deleteMany({})]); });
  async function listen(app) {
    const server = app.listen(0, '127.0.0.1'); servers.push(server);
    await new Promise(resolve => server.once('listening', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }
  it('admits exactly the budget under a concurrent first-use race and stores no raw identities', async () => {
    const input = { scope: 'race', subject: 'private@example.com:private-invite', limit: 8, windowMs: 60000, now: Date.now() };
    const results = await Promise.allSettled(Array.from({ length: 40 }, () => consume(input)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 8);
    for (const r of results.filter(r => r.status === 'rejected')) {
      assert.equal(r.reason.status, 429); assert.ok(r.reason.retryAfter > 0);
    }
    const rows = await Counter.find().lean();
    assert.equal(rows.length, 1); assert.equal(rows[0].count, 40);
    assert.ok(!JSON.stringify(rows).includes('private'));
  });
  it('shares quotas across separate HTTP servers, reports Retry-After and ignores forged Cloudflare headers', async () => {
    const now=Date.now();
    const make = () => { const app = express(); app.get('/limited', limitRequests('shared-http', 3, 60000, undefined, ()=>now), (_,res) => res.json({ok:true})); return app; };
    const a = await listen(make()), b = await listen(make());
    for (let i=0;i<3;i++) assert.equal((await fetch((i%2?a:b)+'/limited')).status, 200);
    const blocked = await fetch(a+'/limited', { headers: { 'CF-Connecting-IP': '203.0.113.99', 'X-Forwarded-For': '203.0.113.99' } });
    assert.equal(blocked.status,429); assert.ok(Number(blocked.headers.get('retry-after'))>0);
  });
  it('keeps scope and window budgets separate without relying on asynchronous TTL deletion', async () => {
    const now = Date.now(), ms=60000, input={scope:'window',subject:'identity',limit:1,windowMs:ms,now};
    await consume(input); await fail(consume(input),429);
    await consume({...input,scope:'another-policy'});
    await consume({...input,now:(Math.floor(now/ms)+1)*ms});
  });
  it('shares invalid-login quotas across admin instances and still accepts correct credentials', async () => {
    const env={ADMIN_EMAIL:'admin@example.com',ADMIN_PASSWORD:'test-secret'};
    const make=()=>{const app=express();app.get('/admin',createAdminAuth(env),(_,res)=>res.json({ok:true}));return app;};
    const a=await listen(make()),b=await listen(make());
    for(let i=0;i<10;i++) assert.equal((await fetch((i%2?a:b)+'/admin')).status,401);
    const blocked=await fetch(b+'/admin');assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);
    assert.equal((await fetch(a+'/admin',{headers:{'x-admin-email':env.ADMIN_EMAIL,'x-admin-password':env.ADMIN_PASSWORD}})).status,200);
  });
  it('does not let invalid-webhook throttling consume the valid delivery path', async () => {
    const now=Date.now();
    const app=express();app.post('/hook',express.raw({type:'application/json',limit:'64kb'}),webhookGuard({now:()=>now}),(req,res)=>{
      try {parseWebhook(req.body,req.get('x-razorpay-signature'));res.json({received:true});}
      catch(e){res.status(e.status).json({error:e.message});}
    });
    const origin=await listen(app),body=JSON.stringify({event:'configuration.check'});
    for(let i=0;i<30;i++)assert.equal((await fetch(origin+'/hook',{method:'POST',headers:{'content-type':'application/json'},body})).status,400);
    assert.equal((await fetch(origin+'/hook',{method:'POST',headers:{'content-type':'application/json'},body})).status,429);
    const signature=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
    assert.equal((await fetch(origin+'/hook',{method:'POST',headers:{'content-type':'application/json','x-razorpay-signature':signature},body})).status,200);
  });
  it('rejects signed malformed payloads and identifiers before processing', () => {
    for(const value of [null,[],{}, {event:'payment.captured'}, {event:'payment.captured',payload:{payment:{entity:{id:'pay_bad!',order_id:'order_x'}}}}]) {
      const raw=Buffer.from(JSON.stringify(value)),signature=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
      assert.throws(()=>parseWebhook(raw,signature),e=>e.status===400);
    }
  });
  it('claims a captured payment once across concurrent workers and skips later replays', async () => {
    const p={id:'pay_race',order_id:'order_race'};let count=0,release;
    const barrier=new Promise(resolve=>{release=resolve;});
    const first=onceCaptured('booking',p,async()=>{count++;await barrier;});
    while(!count)await new Promise(resolve=>setTimeout(resolve,2));
    const concurrent=await Promise.allSettled(Array.from({length:10},()=>onceCaptured('booking',p,async()=>{count++;})));
    assert.ok(concurrent.every(r=>r.status==='rejected'&&r.reason.status===503));
    release();await first;
    await onceCaptured('booking',p,async()=>{count++;});assert.equal(count,1);
    await onceCaptured('quotation',p,async()=>{count++;});assert.equal(count,2);
  });
  it('releases failed claims and recovers expired leases rather than losing payment events', async () => {
    const p={id:'pay_retry',order_id:'order_retry'};let count=0;
    await assert.rejects(onceCaptured('booking',p,async()=>{count++;throw new Error('Temporary gateway outage');}));
    await onceCaptured('booking',p,async()=>{count++;});assert.equal(count,2);
    await Receipt.updateOne({},{$set:{completed:false,leaseUntil:new Date(0),lock:'crashed'}});
    await onceCaptured('booking',p,async()=>{count++;});assert.equal(count,3);
  });
  it('fails closed during storage outages while leaving health routing outside the limiter', async () => {
    const app=express();app.use('/api',apiRateLimits());app.get('/api/health',(_,res)=>res.json({probe:true}));app.get('/api/projects',(_,res)=>res.json([]));
    const origin=await listen(app);
    await mongoose.disconnect();
    try {
      assert.equal((await fetch(origin+'/api/health')).status,200);
      assert.equal((await fetch(origin+'/api/projects')).status,503);
      await fail(consume({scope:'down',subject:'ip',limit:1,windowMs:1000}),503);
    } finally {await mongoose.connect(mongo.getUri());}
  });
  it('bounds gateway waits and normalizes transport errors without exposing credentials', async () => {
    const { createGateway } = require('../services/razorpayGateway');
    const app=express(); app.get('/v1/payments/:id',()=>{});
    const origin=await listen(app);
    const gateway=createGateway({RAZORPAY_KEY_ID:'rzp_test_unit',RAZORPAY_KEY_SECRET:'private-unit-secret'},{timeoutMs:50});
    gateway.api.rq.defaults.baseURL=origin;
    await assert.rejects(gateway.payments.fetch('pay_timeout'),e=>e.statusCode===503 && !JSON.stringify(e).includes('private-unit-secret'));
    assert.equal(createGateway({}),null);
  });
});
