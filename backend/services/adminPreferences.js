const Pref = require('../models/AdminPreferences');
const { httpError } = require('./bookingValidation');
async function read() {
  const p = await Pref.findById('notifications').lean();
  return { digestHour: p?.digestHour ?? 21, digestMinute: p?.digestMinute ?? 0, version: p?.version ?? 0,
    timezone: 'Asia/Kolkata', sender: process.env.MAIL_FROM || process.env.SMTP_USER || '',
    recipient: process.env.CONTACT_EMAIL || process.env.BOOKING_EMAIL || '',
    smtpConfigured: require('./mailer').smtpReady() };
}
async function save(body) {
  if (!Number.isInteger(body.digestHour) || body.digestHour < 0 || body.digestHour > 23 ||
      !Number.isInteger(body.digestMinute) || body.digestMinute < 0 || body.digestMinute > 59 || !Number.isInteger(body.version))
    throw httpError(400, 'Provide a valid daily summary time.');
  try {
    const result = await Pref.findOneAndUpdate({ _id: 'notifications', version: body.version },
      { $set: { digestHour: body.digestHour, digestMinute: body.digestMinute }, $inc: { version: 1 } }, { upsert: body.version === 0, new: true });
    if (!result) throw httpError(409, 'Settings changed. Reload before saving.');
  } catch (e) { if (e.code === 11000) throw httpError(409, 'Settings changed. Reload before saving.'); throw e; }
  return read();
}
module.exports = { read, save };
