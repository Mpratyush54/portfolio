const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 30000,
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sender(name = 'Client services') {
  return `"${name}" <${process.env.MAIL_FROM || process.env.SMTP_USER}>`;
}
const INTENT_LABEL = {
  hire: 'Hire me',
  freelance: 'Freelance project',
  hi: 'Just say hi',
};

function smtpReady() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.CONTACT_EMAIL);
}

function bookingSmtpReady() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

/** Thank-you to the visitor — only when you click "Send yes" in admin. */
async function sendVisitorApprovalEmail(msg) {
  if (!smtpReady()) {
    throw new Error('SMTP is not configured');
  }

  const intent = INTENT_LABEL[msg.intent] || msg.intent;
  const safeName = escapeHtml(msg.name);
  const safeIntent = escapeHtml(intent);

  const counterHtml = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <p>Hi ${safeName},</p>
      <p>Thanks for reaching out via Pratyush’s portfolio
        (<strong>${safeIntent}</strong>). Your note is in — he’ll get back to you soon.</p>
      <p style="color:#555;">— Pratyush</p>
    </div>
  `;

  await transporter.sendMail({
    from: sender(),
    to: msg.email,
    replyTo: process.env.CONTACT_EMAIL,
    subject: 'Got your message — thanks for writing',
    html: counterHtml,
  });
}

/** @deprecated use sendVisitorApprovalEmail — kept for older callers */
async function sendApprovedContactEmails(msg) {
  return sendVisitorApprovalEmail(msg);
}

/** Daily owner digest — call only when pending.length > 0. */
async function sendDailyDigest(pending, bookings = [], totals = {}) {
  if (!smtpReady()) {
    throw new Error('SMTP is not configured');
  }
  if (!pending?.length && !bookings.length) {
    return; // never email an empty day
  }

  const rows = pending.map((msg) => {
    const intent = INTENT_LABEL[msg.intent] || msg.intent;
    const when = msg.createdAt
      ? new Date(msg.createdAt).toLocaleString('en-IN', { timeZone: process.env.DIGEST_TZ || 'Asia/Kolkata' })
      : '';
    return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
          <strong>${escapeHtml(msg.name)}</strong><br/>
          <a href="mailto:${escapeHtml(msg.email)}">${escapeHtml(msg.email)}</a>
          ${msg.phone ? `<br/>${escapeHtml(msg.phone)}` : ''}
        </td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
          ${escapeHtml(intent)}<br/>
          <span style="color:#6b7280;font-size:12px;">${escapeHtml(when)}</span>
        </td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:pre-wrap;">
          ${escapeHtml(msg.message)}
        </td>
      </tr>
    `;
  }).join('');

  const bookingRows = bookings.map(b => `<tr><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(b.name)}<br/>${escapeHtml(b.email)}</td><td>${escapeHtml(b.date)} ${escapeHtml(b.slot)} IST<br/>${escapeHtml(b.status)}</td><td>INR ${(b.amountPaise / 100).toFixed(2)}<br/>${escapeHtml(b.assignedTo || 'Unassigned')}</td></tr>`).join('');
  const adminUrl = process.env.ADMIN_URL || 'https://pratyushes.dev/admin';
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; color: #111;">
      <h2 style="margin:0 0 8px;">Daily activity summary</h2>
      <p style="color:#4b5563;margin:0 0 16px;">
        ${totals.contactCount ?? pending.length} new contacts and ${totals.bookingCount ?? bookings.length} paid bookings since the last summary.
        Up to 50 entries per section appear below. Open admin to search the full history.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;background:#f3f4f6;">
            <th style="padding:10px;">From</th>
            <th style="padding:10px;">Intent</th>
            <th style="padding:10px;">Message</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <h3>Paid bookings</h3><table style="width:100%;border-collapse:collapse;font-size:14px"><tbody>${bookingRows || '<tr><td>No new paid bookings.</td></tr>'}</tbody></table>
      <p style="margin:20px 0 0;">
        <a href="${escapeHtml(adminUrl)}" style="color:#111;font-weight:600;">Open admin inbox →</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: sender(),
    to: process.env.CONTACT_EMAIL,
    subject: `[Daily summary] ${totals.contactCount ?? pending.length} contacts · ${totals.bookingCount ?? bookings.length} bookings`,
    html,
  });
}

/** Owner alert + visitor confirmation after a paid discovery booking. */
async function sendBookingPaidEmails(booking, audience = 'both') {
  if (!bookingSmtpReady()) throw new Error('SMTP is not configured');

  const when = `${booking.date} · ${booking.slot} IST`;
  const amount = require('./bookingSlots').formatAmount(booking.amountPaise || 0);
  const safeName = escapeHtml(booking.name);
  const safeEmail = escapeHtml(booking.email);
  const safeWhen = escapeHtml(when);
  const safeNote = escapeHtml(booking.note || '—');
  const safeAmount = escapeHtml(amount);
  const safePay = escapeHtml(booking.razorpayPaymentId || '');
  const review = booking.status === 'payment_review';

  const bookingInbox =
    (process.env.BOOKING_EMAIL || 'developer@pratyushes.dev').trim() ||
    process.env.CONTACT_EMAIL;

  if (audience === 'owner' || audience === 'both') await transporter.sendMail({
    from: sender(),
    to: bookingInbox,
    messageId: `<booking-owner-${booking._id}@pratyushes.dev>`,
    subject: `[Booking] ${review ? 'Payment needs scheduling review' : 'Discovery call'} · ${booking.date} ${booking.slot}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <h2 style="margin:0 0 8px;">${review ? 'Payment received; slot needs review' : 'Discovery call booked'}</h2>
        <p><strong>${safeName}</strong> · <a href="mailto:${safeEmail}">${safeEmail}</a>
          ${booking.phone ? `<br/>${escapeHtml(booking.phone)}` : ''}</p>
        <p>When: <strong>${safeWhen}</strong><br/>Paid: <strong>${safeAmount}</strong>
          ${safePay ? `<br/>Payment: ${safePay}` : ''}</p>
        <p style="white-space:pre-wrap;color:#374151;">${safeNote}</p>
      </div>
    `,
  });

  if (audience === 'visitor' || audience === 'both') await transporter.sendMail({
    from: sender(),
    to: booking.email,
    messageId: `<booking-visitor-${booking._id}@pratyushes.dev>`,
    replyTo: bookingInbox,
    subject: review ? 'Payment received — appointment needs confirmation' : 'Payment received — discovery call confirmed',
    attachments: [{ filename: `receipt-${booking.razorpayPaymentId}.pdf`, content: await require('./paymentReceipts').pdf({
      paymentId: booking.razorpayPaymentId, orderId: booking.razorpayOrderId, name: booking.name, email: booking.email,
      title: '30-minute technical consultation', phase: when, amountPaise: booking.amountPaise, paidAt: booking.paidAt || new Date(),
    }) }],
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <p>Hi ${safeName},</p>
        <p>${review ? 'Your payment was received, but the selected time could not be confirmed. We will contact you to arrange another time or a refund. Please do not make another payment.' : `Your discovery call is confirmed for <strong>${safeWhen}</strong>.`}</p>
        <p>We have received ${safeAmount}. Your payment receipt is attached. Payment reference: ${safePay}.<br/>${review ? 'We will email you about the next steps.' : 'We will email the meeting link before the call.'} Project messages come from ${escapeHtml(process.env.MAIL_FROM || process.env.SMTP_USER)}.</p>
        <p>Questions? Reply here or write <a href="mailto:${escapeHtml(bookingInbox)}">${escapeHtml(bookingInbox)}</a>.</p>
        <p style="color:#555;">— Pratyush</p>
      </div>
    `,
  });
}

async function sendQuotationInvitation(q, url, invitationId) {
  if (!bookingSmtpReady()) throw new Error('SMTP is not configured');
  await transporter.sendMail({ from: sender(), to: q.clientEmail, replyTo: process.env.BOOKING_EMAIL || process.env.CONTACT_EMAIL,
    ...(invitationId ? { messageId: `<quotation-invite-${invitationId}@pratyushes.dev>` } : {}),
    subject: `Please review your quotation — ${q.title}`,
    text: `Hi ${q.clientName},\nYour quotation for ${q.title} is ready. Please review the scope, payment schedule and agreement: ${url}\nYou can accept and pay the initial instalment, or reply with questions or requested changes. Acceptance does not automatically charge you.\nThis private link is intended only for you.`,
    html: `<p>Hi ${escapeHtml(q.clientName)},</p><p>Your quotation for <strong>${escapeHtml(q.title)}</strong> is ready.</p><p><a href="${escapeHtml(url)}">Review your quotation and agreement</a></p><p>Please review the scope, payment schedule and terms. You can accept and pay the initial instalment, or reply with questions or requested changes. Acceptance does not automatically charge you.</p><p>This link is private. Project messages come from ${escapeHtml(process.env.MAIL_FROM || process.env.SMTP_USER)}.</p>` });
}
async function sendPaymentReceipt(receipt, buffer) {
  if (!bookingSmtpReady()) throw new Error('SMTP is not configured');
  const { money, reference } = require('./paymentReceipts');
  await transporter.sendMail({ from: sender(), to: receipt.email, replyTo: process.env.BOOKING_EMAIL || process.env.CONTACT_EMAIL,
    messageId: `<${reference(receipt.paymentId)}@pratyushes.dev>`,
    subject: `Payment received — ${receipt.title}`,
    text: `Hi ${receipt.name},\nWe have received ${money(receipt.amountPaise)} for ${receipt.phase} — ${receipt.title}.\nPayment reference: ${receipt.paymentId}.\nProject balance remaining: ${money(receipt.balancePaise)}. Your receipt is attached.\nWe will email you about the next steps. Messages come from ${process.env.MAIL_FROM || process.env.SMTP_USER}.`,
    attachments: [{ filename: `${reference(receipt.paymentId)}.pdf`, content: buffer, contentType: 'application/pdf' }] });
}

module.exports = {
  sendQuotationInvitation, sendPaymentReceipt,
  sendVisitorApprovalEmail,
  sendApprovedContactEmails,
  sendDailyDigest,
  sendBookingPaidEmails,
  INTENT_LABEL,
  smtpReady,
  bookingSmtpReady,
};
