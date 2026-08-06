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

async function sendContactNotification({ name, email, phone, message }) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone || 'N/A');
  const safeMessage = escapeHtml(message);

  const notificationHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Contact Form Submission</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">Name</td><td style="padding: 8px;">${safeName}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">Email</td><td style="padding: 8px;">${safeEmail}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">Phone</td><td style="padding: 8px;">${safePhone}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">Message</td><td style="padding: 8px; white-space: pre-wrap;">${safeMessage}</td></tr>
      </table>
    </div>
  `;

  // Only notify the portfolio owner. Never send mail to the submitter's address
  // (prevents third-party email abuse via the contact form).
  await transporter.sendMail({
    from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
    to: process.env.CONTACT_EMAIL,
    replyTo: email,
    subject: `Portfolio Contact: ${name}`,
    html: notificationHtml,
  });
}

module.exports = { sendContactNotification };
