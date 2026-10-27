const { before, after, beforeEach, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { PDFParse } = require('pdf-parse');
const Quote = require('../models/Quotation');
const Booking = require('../models/Booking');
const Contact = require('../models/ContactMessage');
const Invitation = require('../models/QuotationInvitation');
const Receipt = require('../models/PaymentReceipt');
const Digest = require('../models/DigestDelivery');
const { createQuotationService, validate, DEFAULT_TERMS } = require('../services/quotationService');
const links = require('../services/quotationInvitations');
const receipts = require('../services/paymentReceipts');
const lists = require('../services/adminLists');
const { createDigestRunner, digestDue } = require('../services/digest');
let mongo;
process.env.QUOTATION_INVITE_SECRET = 'b'.repeat(64);
before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); await Promise.all([Quote.init(), Invitation.init(), Receipt.init()]); });
after(async () => { await mongoose.disconnect(); await mongo.stop(); });
beforeEach(async () => { await Promise.all([Quote, Booking, Contact, Invitation, Receipt, Digest].map(M => M.deleteMany({}))); });
function body() {
  return { title: 'Client portal', clientName: 'Client', clientEmail: 'client@example.com', seller: 'Example provider', scope: 'Two page website', exclusions: 'Cloud costs', timeline: 'Four weeks', terms: DEFAULT_TERMS,
    totalPaise: 100003, validUntil: new Date(Date.now() + 86400000).toISOString() };
}
it('paginates 5,003 quotations without sending agreements, attachment metadata or invitation secrets', async () => {
  await Quote.insertMany(Array.from({ length: 5003 }, (_, i) => ({ title: `Project ${i}`, clientEmail: `client${i}@example.com`, status: i % 2 ? 'draft' : 'accepted', terms: 'Private agreement', tokenHash: crypto.randomBytes(32).toString('hex') })));
  const service = createQuotationService({ gateway: () => null });
  const first = await service.page({ page: '1', pageSize: '25' });
  assert.equal(first.total, 5003); assert.equal(first.pages, 201); assert.equal(first.rows.length, 25);
  assert.equal(first.rows[0].terms, undefined); assert.equal(first.rows[0].tokenHash, undefined);
  const last = await service.page({ page: '201', pageSize: '25' }); assert.equal(last.rows.length, 3);
  const match = await service.page({ q: 'client2999@example.com', page: '1', status: 'draft' });
  assert.equal(match.total, 1); assert.equal(match.rows[0].clientEmail, 'client2999@example.com');
  const literal = await service.page({ q: '.*', page: '1' }); assert.equal(literal.total, 0);
  const clamped = await service.page({ page: '9999' }); assert.equal(clamped.page, 201);
});
it('validates search, filters, dates and pagination; contact and booking pages remain bounded', async () => {
  for (const query of [{ page: '0' }, { pageSize: '1000' }, { q: { $ne: '' } }, { from: '2026-99-01' }, { from: '2026-02-30' }, { status: 'injected' }])
    assert.throws(() => lists.options(query, ['paid']), e => e.status === 400);
  await Contact.insertMany(Array.from({length: 205}, (_, i) => ({name:`Client ${i}`, email:'a@example.com', message:'Hello', intent:'hi'})));
  const page = await lists.page(Contact, {page:'3'}, ['pending']); assert.equal(page.total, 205); assert.equal(page.rows.length, 25);
});
it('protects booking assignments, rejects stale edits and cannot complete an unpaid booking', async (t) => {
  const express=require('express'), app=express();app.use(express.json());
  const admin=(req,res,next)=>req.get('x-preview-admin')==='yes'?next():res.sendStatus(401);
  app.use(require('../services/bookingRoutes').createBookingRouter({ready:()=>true},admin,()=>null));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const booking=await Booking.create({name:'Client',email:'a@example.com',date:'2026-11-01',slot:'18:00',amountPaise:119900,status:'pending_payment'});
  const url=`http://127.0.0.1:${server.address().port}/admin/bookings/${booking._id}`;
  const body={assignedTo:'Consultant',meetingUrl:'https://meet.example.com/call',adminNotes:'Review API requirements',updatedAt:booking.updatedAt.toISOString(),completed:false};
  const request=(payload,authenticated=true)=>fetch(url,{method:'PUT',headers:{'content-type':'application/json',...(authenticated?{'x-preview-admin':'yes'}:{})},body:JSON.stringify(payload)});
  assert.equal((await request(body,false)).status,401);
  assert.equal((await request({...body,completed:true})).status,409);
  const saved=await request(body);assert.equal(saved.status,200);assert.equal((await saved.json()).status,'pending_payment');
  assert.equal((await request(body)).status,409);
  assert.equal((await request({...body,meetingUrl:'javascript:alert(1)'})).status,400);
});
it('custom phase percentages reconcile paise exactly and reject invalid or zero-value phases', () => {
  const schedule = [{percent:40,timing:'before'},{percent:30,timing:'before'},{percent:20,timing:'after'},{percent:10,timing:'after'}];
  const q = validate({...body(), paymentSchedule:schedule});
  assert.equal(q.milestones.reduce((n,m)=>n+m.amountPaise,0),100003);
  assert.equal(q.milestones[1].timing,'before');
  assert.throws(()=>validate({...body(),paymentSchedule:schedule.map(m=>({...m,percent:20}))}),e=>e.status===400);
  assert.throws(()=>validate({...body(),paymentSchedule:schedule.map((m,i)=>({...m,timing:i===3?'before':m.timing}))}),e=>e.status===400);
});
it('recovers each invitation independently and revokes one without invalidating the other', async () => {
  const service = createQuotationService({gateway:()=>null});
  const q = await service.create(body());
  const a = await service.invite(q._id,q.__v,{label:'Primary contact'});
  const b = await service.invite(q._id,a.quotation.__v,{label:'Finance contact'});
  const rows = await links.list(q._id); assert.equal(rows.length,2); assert.equal(rows[0].tokenHash,undefined);
  const stored = await links.owned(q._id,a.invitation,true); assert.equal(links.token(stored),a.token);
  stored.revokedAt = new Date(); await stored.save();
  await assert.rejects(service.portal(a.token),e=>e.status===404);
  assert.equal(String((await service.portal(b.token))._id),String(q._id));
  const other = await service.create(body());
  await assert.rejects(links.owned(other._id,b.invitation),e=>e.status===404);
  await service.revoke(q._id); await assert.rejects(service.portal(b.token),e=>e.status===404);
});
it('queues the invitation email immediately when requested', async () => {
  const service = createQuotationService({ gateway: () => null });
  const q = await service.create(body());
  const original = links.notify;
  let notified = null;
  links.notify = async (invite) => { notified = invite; };
  try {
    const result = await service.invite(q._id, q.__v, { sendEmail: true });
    assert.ok(notified);
    assert.equal(String(notified._id), String(result.invitation));
  } finally {
    links.notify = original;
  }
});
it('queues one receipt per captured payment and retries only the failed delivery', async () => {
  const q = await Quote.create({...body(), milestones:[{label:'Onboarding',amountPaise:100003,payments:[{paymentId:'pay_receipt',orderId:'order_receipt',amountPaise:50000,at:new Date()}]}]});
  const payment = q.milestones[0].payments[0];
  await Promise.all(Array.from({length:6},()=>receipts.record(q,0,payment)));
  assert.equal(await Receipt.countDocuments(),1);
  const row = await Receipt.findOne(); assert.equal(row.balancePaise,50003);
  let sends=0;
  await receipts.deliver(row,{ready:()=>true,send:async()=>{throw Error('offline');}});
  assert.equal((await Receipt.findById(row._id)).status,'failed');
  assert.ok((await Receipt.findById(row._id)).nextAttemptAt > new Date());
  await Receipt.updateOne({ _id: row._id }, { $unset: { nextAttemptAt: 1 } }); // Explicit admin retry.
  await Promise.all(Array.from({length:5},()=>receipts.deliver(row,{ready:()=>true,send:async(_,buffer)=>{sends++;assert.equal(buffer.subarray(0,4).toString(),'%PDF');}})));
  assert.equal(sends,1); assert.equal((await Receipt.findById(row._id)).status,'sent');
  const parser = new PDFParse({data:await receipts.pdf(row)});const result=await parser.getText();await parser.destroy();
  assert.equal(result.total,1); assert.match(result.text,/500\.00/); assert.match(result.text,/500\.03/); assert.match(result.text,/not a GST tax invoice/);
});
it('sends a bookings-only digest, skips empty days and uses an activity checkpoint', async () => {
  let payload;
  const run=createDigestRunner({ready:()=>true,send:async(...args)=>{payload=args;}});
  assert.equal((await run({isMongoConnected:true})).reason,'empty');
  await Booking.create({name:'Client',email:'a@example.com',date:'2026-11-01',slot:'18:00',amountPaise:119900,status:'paid',paidAt:new Date()});
  const result=await run({isMongoConnected:true});assert.equal(result.sent,true);assert.equal(payload[0].length,0);assert.equal(payload[1].length,1);
  await Contact.create({name:'New client',email:'a@example.com',intent:'hi',message:'Question'});
  const second=await run({isMongoConnected:true,force:true});assert.equal(second.contactCount,1);assert.equal(second.bookingCount,0);
  assert.equal(digestDue(new Date('2026-10-27T15:29:00Z'),21,0),false);
  assert.equal(digestDue(new Date('2026-10-27T15:30:00Z'),21,0),true);
});
