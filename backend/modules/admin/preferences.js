const { z } = require('zod');
const Pref = require('./AdminPreferences');
const { httpError } = require('../shared/errors');

const notificationSettingsSchema = z.object({
  digestHour: z.number().int().min(0).max(23),
  digestMinute: z.number().int().min(0).max(59),
  version: z.number().int(),
});

class NotificationPreferences {
  static view(row) {
    return {
      digestHour: row?.digestHour ?? 21,
      digestMinute: row?.digestMinute ?? 0,
      version: row?.version ?? 0,
      timezone: 'Asia/Kolkata',
      sender: process.env.MAIL_FROM || process.env.SMTP_USER || '',
      recipient: process.env.CONTACT_EMAIL || process.env.BOOKING_EMAIL || '',
      smtpConfigured: require('../shared/mailer').smtpReady(),
    };
  }

  static async read() {
    return NotificationPreferences.view(await Pref.findById('notifications').lean());
  }

  static async save(body) {
    const parsed = notificationSettingsSchema.safeParse(body);
    if (!parsed.success) throw httpError(400, 'Provide a valid daily summary time.');
    try {
      const result = await Pref.findOneAndUpdate(
        { _id: 'notifications', version: parsed.data.version },
        {
          $set: {
            digestHour: parsed.data.digestHour,
            digestMinute: parsed.data.digestMinute,
          },
          $inc: { version: 1 },
        },
        { upsert: parsed.data.version === 0, new: true },
      );
      if (!result) throw httpError(409, 'Settings changed. Reload before saving.');
    } catch (error) {
      if (error.code === 11000) throw httpError(409, 'Settings changed. Reload before saving.');
      throw error;
    }
    return NotificationPreferences.read();
  }
}

module.exports = {
  NotificationPreferences,
  read: () => NotificationPreferences.read(),
  save: (body) => NotificationPreferences.save(body),
};
