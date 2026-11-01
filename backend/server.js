const mongoose = require('mongoose');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const { createGateway } = require('./modules/payments/gateway');
const { sendVisitorApprovalEmail, sendBookingPaidEmails, bookingSmtpReady } = require('./modules/shared/mailer');
const { createBookingService } = require('./modules/booking/service');
const { createQuotationService } = require('./modules/quotations/service');
const { createAdminAuth, createAdminLogin } = require('./modules/admin/auth');
const { createContactActions } = require('./modules/contact/actions');
const { startDailyDigestScheduler } = require('./modules/digest/service');
const { PostHogService } = require('./modules/analytics/PostHogService');
const { createApp } = require('./app');
const { GoogleCalendar } = require('./modules/calendar/GoogleCalendar');

function getRazorpay() {
  return createGateway(process.env);
}

const analytics = new PostHogService();
const calendar = new GoogleCalendar();
const quotationService = createQuotationService({ gateway: getRazorpay, analytics });
const bookingService = createBookingService({
  gateway: getRazorpay,
  sendEmails: sendBookingPaidEmails,
  emailReady: bookingSmtpReady,
  analytics,
  calendar,
});
const requireAdmin = createAdminAuth();
const adminLogin = createAdminLogin();

const contactActions = createContactActions({ sendEmail: sendVisitorApprovalEmail });

const app = createApp({
  bookingService,
  quotationService,
  requireAdmin,
  adminLogin,
  contactActions,
  getRazorpay,
  analytics,
  calendar,
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio')
  .then(async () => {
    console.log('MongoDB Connected');
    try { await bookingService.init(); } catch (error) { console.error('[Booking initialization]', error.message); }
  })
  .catch((error) => { console.error('MongoDB connection failed:', error.message); });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startDailyDigestScheduler();
  let retryingNotifications = false;
  setInterval(async () => {
    if (retryingNotifications) return;
    retryingNotifications = true;
    for (const [name, job] of [
      ['booking', () => bookingService.retryNotifications()],
      ['receipts', () => require('./modules/payments/receipts').retry(analytics)],
      ['invitations', () => require('./modules/quotations/invitations').retry(analytics)],
    ]) {
      try { await job(); }
      catch (error) {
        console.error(`[Notifications] ${name} worker failed (${error?.name || 'Error'}).`);
      }
    }
    retryingNotifications = false;
  }, 60_000).unref();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await analytics.shutdown();
    process.exit(0);
  });
}
