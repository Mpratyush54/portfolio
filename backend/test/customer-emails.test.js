const { it } = require('node:test');
const assert = require('node:assert/strict');
const messages = [];
require('nodemailer').createTransport = () => ({ sendMail: async m => { messages.push(m); } });
process.env.SMTP_HOST = 'smtp.example.invalid'; process.env.SMTP_USER = 'developer@example.com'; process.env.CONTACT_EMAIL = 'owner@example.com';
const mailer = require('../services/mailer');
it('attaches a receipt and identifies the configured sender after a verified booking payment', async () => {
  const booking = {name:'Client',email:'client@example.com',date:'2026-11-02',slot:'18:00',amountPaise:119900,razorpayPaymentId:'pay_example',razorpayOrderId:'order_example',status:'paid',paidAt:new Date()};
  await mailer.sendBookingPaidEmails(booking,'visitor');
  const message=messages.pop();assert.equal(message.to,booking.email);assert.match(message.html,/received.*1199/);assert.match(message.html,/developer@example.com/);
  assert.equal(message.attachments.length,1);assert.equal(message.attachments[0].content.subarray(0,4).toString(),'%PDF');
  await mailer.sendBookingPaidEmails({...booking,status:'payment_review'},'visitor');
  const review=messages.pop();assert.match(review.html,/selected time could not be confirmed/);assert.doesNotMatch(review.html,/Your discovery call is confirmed/);assert.equal(review.attachments.length,1);
});
it('invitation email explains review, changes and acceptance without automatic payment', async () => {
  await mailer.sendQuotationInvitation({title:'Client portal',clientName:'Client',clientEmail:'client@example.com',validUntil:'2026-12-01'},'https://example.com/proposal#private-token');
  const message=messages.pop();
  assert.match(message.from,/Pratyush Mishra/);
  assert.equal(message.replyTo,'owner@example.com');
  assert.match(message.subject,/Your quotation/);
  assert.match(message.text,/requested changes/);
  assert.match(message.text,/does not automatically charge/);
  assert.match(message.text,/valid until 1 December 2026/);
  assert.match(message.text,/Sent because a quotation was prepared/);
  assert.match(message.html,/proposal#private-token/);
  assert.match(message.html,/Review quotation and agreement/);
  assert.match(message.html,/Pratyushes\.dev/);
});
it('invitation email escapes client values and omits an invalid validity date', async () => {
  await mailer.sendQuotationInvitation({title:'<b>Client portal</b>',clientName:'<Client>',clientEmail:'client@example.com',validUntil:'not-a-date'},'https://example.com/proposal#private-token');
  const message=messages.pop();
  assert.match(message.html,/&lt;Client&gt;/);
  assert.doesNotMatch(message.html,/<Client>/);
  assert.match(message.html,/&lt;b&gt;Client portal&lt;\/b&gt;/);
  assert.doesNotMatch(message.text,/valid until/);
});
it('a bookings-only summary sends mail and an empty period sends none', async () => {
  const before=messages.length; await mailer.sendDailyDigest([],[]);assert.equal(messages.length,before);
  await mailer.sendDailyDigest([],[{name:'Client',email:'a@example.com',date:'2026-11-02',slot:'18:00',status:'paid',amountPaise:119900}],{contactCount:0,bookingCount:1});
  const message=messages.pop();assert.match(message.subject,/0 contacts.*1 bookings/);assert.match(message.html,/Paid bookings/);
});
