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

async function sendContactNotification({ name, email, phone, message }) {
  const thankYouHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Thank you for reaching out, ${name}!</h2>
      <p>I've received your message and will get back to you as soon as possible.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 14px;">Your message:</p>
      <blockquote style="border-left: 4px solid #2563eb; padding-left: 16px; color: #374151; margin: 12px 0;">
        ${message}
      </blockquote>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">— Pratyush Mishra</p>
    </div>
  `;

  const notificationHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Contact Form Submission</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">Name</td><td style="padding: 8px;">${name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">Email</td><td style="padding: 8px;">${email}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">Phone</td><td style="padding: 8px;">${phone || 'N/A'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">Message</td><td style="padding: 8px; white-space: pre-wrap;">${message}</td></tr>
      </table>
    </div>
  `;

  await transporter.sendMail({
    from: `"Pratyush Mishra" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Thank you for reaching out!',
    html: thankYouHtml,
  });

  await transporter.sendMail({
    from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
    to: process.env.CONTACT_EMAIL,
    subject: `Portfolio Contact: ${name}`,
    html: notificationHtml,
  });
}

module.exports = { sendContactNotification };
