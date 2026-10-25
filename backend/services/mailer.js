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
    from: `"Pratyush Mishra" <${process.env.SMTP_USER}>`,
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
async function sendDailyDigest(pending) {
  if (!smtpReady()) {
    throw new Error('SMTP is not configured');
  }
  if (!pending?.length) {
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

  const adminUrl = process.env.ADMIN_URL || 'https://pratyushes.dev/admin';
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; color: #111;">
      <h2 style="margin:0 0 8px;">Portfolio inbox · ${pending.length} pending</h2>
      <p style="color:#4b5563;margin:0 0 16px;">
        New contact notes waiting for you. Open admin and tap <strong>Send yes</strong>
        only for people you want a thank-you email sent to.
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
      <p style="margin:20px 0 0;">
        <a href="${escapeHtml(adminUrl)}" style="color:#111;font-weight:600;">Open admin inbox →</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Portfolio Desk" <${process.env.SMTP_USER}>`,
    to: process.env.CONTACT_EMAIL,
    subject: `[Portfolio] ${pending.length} pending contact${pending.length === 1 ? '' : 's'}`,
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

  const bookingInbox =
    (process.env.BOOKING_EMAIL || 'developer@pratyushes.dev').trim() ||
    process.env.CONTACT_EMAIL;

  if (audience === 'owner' || audience === 'both') await transporter.sendMail({
    from: `"Portfolio Desk" <${process.env.SMTP_USER}>`,
    to: bookingInbox,
    subject: `[Booking] Discovery call · ${booking.date} ${booking.slot}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <h2 style="margin:0 0 8px;">Discovery call booked</h2>
        <p><strong>${safeName}</strong> · <a href="mailto:${safeEmail}">${safeEmail}</a>
          ${booking.phone ? `<br/>${escapeHtml(booking.phone)}` : ''}</p>
        <p>When: <strong>${safeWhen}</strong><br/>Paid: <strong>${safeAmount}</strong>
          ${safePay ? `<br/>Payment: ${safePay}` : ''}</p>
        <p style="white-space:pre-wrap;color:#374151;">${safeNote}</p>
      </div>
    `,
  });

  if (audience === 'visitor' || audience === 'both') await transporter.sendMail({
    from: `"Pratyush Mishra" <${process.env.SMTP_USER}>`,
    to: booking.email,
    replyTo: bookingInbox,
    subject: 'Discovery call confirmed',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <p>Hi ${safeName},</p>
        <p>Your discovery call is confirmed for <strong>${safeWhen}</strong>.</p>
        <p>I’ll send a meeting link to this email before the call. Amount paid: ${safeAmount}.</p>
        <p>Questions? Reply here or write <a href="mailto:${escapeHtml(bookingInbox)}">${escapeHtml(bookingInbox)}</a>.</p>
        <p style="color:#555;">— Pratyush</p>
      </div>
    `,
  });
}

module.exports = {
  sendVisitorApprovalEmail,
  sendApprovedContactEmails,
  sendDailyDigest,
  sendBookingPaidEmails,
  INTENT_LABEL,
  smtpReady,
  bookingSmtpReady,
};
