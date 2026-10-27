const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const Receipt = require('../models/PaymentReceipt');
const money = value => `INR ${(value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const reference = id => 'RCPT-' + String(id).replace(/^pay_/, '').toUpperCase();
async function pdf(receipt) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 52, info: { Title: 'Payment receipt' } });
    doc.registerFont('Body', require('path').join(__dirname, '../assets/fonts/NotoSans-Regular.ttf'));
    doc.registerFont('Devanagari', require('path').join(__dirname, '../assets/fonts/NotoSansDevanagari-Regular.ttf'));
    const chunks = []; doc.on('data', x => chunks.push(x)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.fontSize(10).fillColor('#526071').text('PAYMENT CONFIRMATION');
    doc.moveDown().fontSize(28).fillColor('#172033').text('Payment receipt');
    doc.moveDown(0.4).fontSize(11).fillColor('#526071').text(reference(receipt.paymentId));
    doc.moveDown().fontSize(10).text(`Issued by ${process.env.MAIL_FROM || process.env.SMTP_USER || 'Service provider'}`);
    doc.moveDown().fontSize(11).fillColor('#172033');
    const lines = [
      ['Received from', receipt.name], ['Email', receipt.email],
      ['Service', receipt.title], ['Phase / appointment', receipt.phase],
      ['Payment date', new Date(receipt.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'],
      ['Amount received', money(receipt.amountPaise)], ['Project balance', receipt.balancePaise === undefined ? 'Not applicable' : money(receipt.balancePaise)],
      ['Payment provider', 'Razorpay'], ['Payment reference', receipt.paymentId], ['Order reference', receipt.orderId],
    ];
    for (const [label, value] of lines) {
      doc.font('Helvetica-Bold').text(label); doc.font(/[\u0900-\u097f]/.test(String(value)) ? 'Devanagari' : 'Body').text(String(value || '—'), { width: 480 }); doc.moveDown(0.8);
    }
    doc.moveDown().fontSize(9).fillColor('#526071').text('This receipt acknowledges a payment verified as captured. It is not a GST tax invoice. Any required tax invoice is supplied separately.');
    doc.end();
  });
}
async function record(q, index, payment) {
  const paid = q.milestones.reduce((sum, m) => sum + (m.paidAt ? m.amountPaise : m.payments.reduce((s, p) => s + p.amountPaise, 0)), 0);
  try { await Receipt.updateOne({ paymentId: payment.paymentId }, { $setOnInsert: {
    paymentId: payment.paymentId, orderId: payment.orderId, quotationId: q._id, name: q.clientName,
    email: q.clientEmail, title: q.title, phase: q.milestones[index].label,
    amountPaise: payment.amountPaise, balancePaise: q.totalPaise - paid, paidAt: payment.at, status: 'pending',
  } }, { upsert: true }); } catch (e) { if (e.code !== 11000) throw e; }
}
async function deliver(row, { ready = require('./mailer').bookingSmtpReady, send = require('./mailer').sendPaymentReceipt } = {}) {
  if (!ready()) return;
  const claim = crypto.randomUUID();
  const claimed = await Receipt.findOneAndUpdate({ _id: row._id, $or: [{ status: { $in: ['pending', 'failed'] } },
    { status: 'sending', claimedAt: { $lt: new Date(Date.now() - 300000) } }],
    $and: [{ $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: new Date() } }] }] },
  { $set: { status: 'sending', claim, claimedAt: new Date() }, $inc: { attempts: 1 } }, { new: true });
  if (!claimed) return;
  try {
    await send(claimed.toObject(), await pdf(claimed));
    await Receipt.updateOne({ _id: row._id, claim }, { $set: { status: 'sent', sentAt: new Date() } });
  } catch { await Receipt.updateOne({ _id: row._id, claim }, { $set: { status: 'failed',
    nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(6, claimed.attempts - 1))) } }); }
}
async function retry() {
  if (!require('./mailer').bookingSmtpReady()) return;
  for (const row of await Receipt.find({ $or: [
    { status: { $in: ['pending', 'failed'] }, $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: new Date() } }] },
    { status: 'sending', claimedAt: { $lt: new Date(Date.now() - 300000) } },
  ] }).sort({ createdAt: 1 }).limit(25)) await deliver(row);
}
module.exports = { pdf, record, retry, deliver, reference, money };
