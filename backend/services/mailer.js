const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
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

/** Owner inbox + polite counter-email to the visitor — only after admin approve. */
async function sendApprovedContactEmails(msg) {
  if (!smtpReady()) {
    throw new Error('SMTP is not configured');
  }

  const intent = INTENT_LABEL[msg.intent] || msg.intent;
  const safe = {
    name: escapeHtml(msg.name),
    email: escapeHtml(msg.email),
    phone: escapeHtml(msg.phone || 'N/A'),
    company: escapeHtml(msg.company || 'N/A'),
    message: escapeHtml(msg.message),
    intent: escapeHtml(intent),
  };

  const notificationHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111827;">Approved contact · ${safe.intent}</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: bold;">Intent</td><td style="padding: 8px;">${safe.intent}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Name</td><td style="padding: 8px;">${safe.name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Email</td><td style="padding: 8px;">${safe.email}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Phone</td><td style="padding: 8px;">${safe.phone}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Company</td><td style="padding: 8px;">${safe.company}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Message</td><td style="padding: 8px; white-space: pre-wrap;">${safe.message}</td></tr>
      </table>
    </div>
  `;

  await transporter.sendMail({
    from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
    to: process.env.CONTACT_EMAIL,
    replyTo: msg.email,
    subject: `[${intent}] ${msg.name}`,
    html: notificationHtml,
  });

  const counterHtml = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <p>Hi ${safe.name},</p>
      <p>Thanks for reaching out via pratyush’s portfolio
        (<strong>${safe.intent}</strong>). Your note is in — he’ll get back to you soon.</p>
      <p style="color:#555;">— Portfolio desk</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Pratyush Mishra" <${process.env.SMTP_USER}>`,
    to: msg.email,
    subject: 'Got your message — thanks for writing',
    html: counterHtml,
  });
}

module.exports = { sendApprovedContactEmails, INTENT_LABEL, smtpReady };
