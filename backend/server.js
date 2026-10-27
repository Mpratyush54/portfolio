const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const { apiRateLimits, consume } = require('./services/rateLimits');
const { clientAddress, rateAddress } = require('./services/clientAddress');
const { webhookGuard } = require('./services/paymentSecurity');
const guardWebhook = webhookGuard();

app.use(cors());
// Only enable forwarding behind the known ingress hop; never trust arbitrary
// client-supplied forwarding headers on a directly exposed development server.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isSafeInteger(proxyHops) && proxyHops > 0) app.set('trust proxy', proxyHops);
// Capture the exact signed bytes before the JSON body parser.
app.post('/api/bookings/webhook', express.raw({ type: 'application/json', limit: '64kb' }), guardWebhook, async (req, res) => {
  try { res.json(await bookingService.webhook(req.body, req.headers['x-razorpay-signature'])); }
  catch (error) { handleBookingError(res, error); }
});
app.post('/api/quotations/webhook', express.raw({ type: 'application/json', limit: '64kb' }), guardWebhook, async (req, res) => {
  try {
    res.json(await quotationService.webhook(req.body, req.get('x-razorpay-signature')));
  } catch (error) { handleBookingError(res, error); }
});
app.use('/api', apiRateLimits());
app.use(express.json({ limit: '48kb' }));

const { createGateway } = require('./services/razorpayGateway');
const { sendVisitorApprovalEmail, sendBookingPaidEmails, INTENT_LABEL } = require('./services/mailer');
const contactStore = require('./services/contactStore');
const ContactMessage = require('./models/ContactMessage');
const { createBookingService } = require('./services/bookingService');
const { createQuotationService } = require('./services/quotationService');
const { createQuotationRouter } = require('./services/quotationRoutes');
const quotationService = createQuotationService({ gateway: getRazorpay });
const { createBookingRouter, handleBookingError } = require('./services/bookingRoutes');
const { createAdminAuth, createAdminLogin } = require('./services/adminAuth');
const { bookingSmtpReady } = require('./services/mailer');
const bookingService = createBookingService({ gateway: getRazorpay, sendEmails: sendBookingPaidEmails, emailReady: bookingSmtpReady });
const { startDailyDigestScheduler, runDailyDigest } = require('./services/digest');

const curatedProjects = require('./data/projects');

let isMongoConnected = false;
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio')
  .then(async () => {
    console.log('MongoDB Connected'); isMongoConnected = true;
    try { await bookingService.init(); } catch (error) { console.error('[Booking initialization]', error.message); }
  })
  .catch(() => { console.log('MongoDB Connection Failed (Using Curated Data)'); });

mongoose.connection.on('disconnected', () => { isMongoConnected = false; });
mongoose.connection.on('connected', () => { isMongoConnected = true; });

// Never silently move configured production inboxes to container-local files.
app.use(['/api/contact', '/api/admin/contacts', '/api/admin/digest'], (req, res, next) => {
  if (process.env.MONGO_URI && !isMongoConnected) return res.status(503).json({ error: 'Storage is temporarily unavailable.' });
  next();
});

const Project = require('./models/Project');
const { syncMetaOnly } = require('./services/gitFetcher');

const requireAdmin = createAdminAuth();
const adminLogin = createAdminLogin();
const { createContactActions } = require('./services/contactActions');
const contactActions = createContactActions({ connected: () => isMongoConnected, sendEmail: sendVisitorApprovalEmail });

function getRazorpay() {
  return createGateway(process.env);
}

// Merge curated data with optional live metadata from DB
function mergeWithDb(dbProjects) {
  if (!dbProjects || !dbProjects.length) return curatedProjects;
  const map = {};
  dbProjects.forEach(d => { map[d.sourceUrl] = d; });
  // Curated data is always authoritative. Sync only adds lastSyncedAt.
  return curatedProjects.map(c => {
    const live = map[c.sourceUrl];
    return live ? { ...c, lastSyncedAt: live.lastSyncedAt || c.lastSyncedAt } : c;
  });
}

// Readiness waits for durable storage and booking indexes, independently of payments.
app.get('/api/health', (req, res) => {
  const ready = isMongoConnected && bookingService.ready();
  res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({ ready });
});

// ===== PUBLIC ROUTES =====

app.get('/api/projects', async (req, res) => {
  console.log('[API] Fetching projects...');
  try {
    const { source } = req.query;
    let projects;
    if (isMongoConnected) {
      const dbProjects = await Project.find({}).sort({ updatedAt: -1 });
      projects = mergeWithDb(dbProjects);
    } else {
      projects = [...curatedProjects];
    }
    if (source) projects = projects.filter(p => p.source === source);
    // Assign IDs for frontend routing
    projects = projects.map((p, i) => ({ ...p, _id: String(i + 1) }));
    res.json(projects);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/projects/:id', async (req, res) => {
    console.log('[API] Fetching projects...');

  const { id } = req.params;
  try {
    let projects;
    if (isMongoConnected) {
      const dbProjects = await Project.find({});
      projects = mergeWithDb(dbProjects);
    } else {
      projects = [...curatedProjects];
    }
    projects = projects.map((p, i) => ({ ...p, _id: String(i + 1) }));
    const project = projects.find(p => p._id === id);
    if (!project) return res.status(404).json({ message: 'Not found' });
    res.json(project);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ===== ADMIN ROUTES =====

// Exchange credentials for a short-lived signed session. The browser stores the
// token instead of keeping the admin password after sign-in.
app.post('/api/admin/session', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json(await adminLogin(req));
  } catch (error) {
    if (error.status === 429) res.set('Retry-After', String(error.retryAfter || 60));
    res.status(error.status || 503).json({
      error: error.status === 401 ? 'Invalid email or password.' : error.status ? error.message : 'Could not sign in.',
    });
  }
});

app.get('/api/admin/status', requireAdmin, async (req, res) => {
  let counts = null;
  if (isMongoConnected) {
    try {
      const Booking = require('./models/Booking');
      const Quotation = require('./models/Quotation');
      const [pendingContacts, paidBookings, reviewBookings, draftQuotes, invitedQuotes, acceptedQuotes] = await Promise.all([
        ContactMessage.countDocuments({ status: 'pending' }),
        Booking.countDocuments({ status: 'paid' }),
        Booking.countDocuments({ status: 'payment_review' }),
        Quotation.countDocuments({ status: 'draft' }),
        Quotation.countDocuments({ status: 'invited' }),
        Quotation.countDocuments({ status: 'accepted' }),
      ]);
      counts = { pendingContacts, paidBookings, reviewBookings, draftQuotes, invitedQuotes, acceptedQuotes };
    } catch {
      counts = null;
    }
  }
  res.json({
    total: curatedProjects.length,
    sources: {
      github: curatedProjects.filter(p => p.source === 'github').length,
      gitlab: curatedProjects.filter(p => p.source === 'gitlab').length
    },
    mongoConnected: isMongoConnected,
    counts,
  });
});

app.post('/api/admin/sync', requireAdmin, async (req, res) => {
  try {
    const meta = await syncMetaOnly();
    let updated = 0;

    if (isMongoConnected) {
      for (const m of meta) {
        const existing = await Project.findOne({ sourceUrl: m.sourceUrl });
        if (existing) {
          await Project.findByIdAndUpdate(existing._id, {
            $set: {
              languageStats: m.languageStats,
              timeline: m.timeline,
              status: m.status,
              lastSyncedAt: new Date()
            }
          });
          updated++;
        } else {
          const curated = curatedProjects.find(c => c.sourceUrl === m.sourceUrl);
          if (curated) {
            await Project.create({
              ...curated,
              languageStats: m.languageStats,
              timeline: m.timeline,
              status: m.status,
              lastSyncedAt: new Date()
            });
            updated++;
          }
        }
      }
    }
    res.json({ success: true, message: `Metadata synced for ${updated}/${meta.length} projects` });
  } catch (err) {
    console.error('[Sync] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/contacts', requireAdmin, async (req, res) => {
  try {
    if (isMongoConnected && req.query.page) return res.json(await require('./services/adminLists').page(ContactMessage, req.query,
      ['pending', 'approved', 'rejected'], { select: '-ip -approvalClaim -approvalClaimAt' }));
    const status = req.query.status;
    if (status && !['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid contact status.' });
    let rows = [];
    if (isMongoConnected) {
      const q = status ? { status } : {};
      rows = await ContactMessage.find(q).sort({ createdAt: -1 }).limit(100).select('-ip -approvalClaim -approvalClaimAt').lean();
    } else {
      rows = contactStore.list();
      if (status) rows = rows.filter(r => r.status === status);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/admin/notification-settings', requireAdmin, async (req, res) => {
  try { res.json(await require('./services/adminPreferences').read()); } catch (e) { handleBookingError(res, e); }
});
app.put('/api/admin/notification-settings', requireAdmin, async (req, res) => {
  try { res.json(await require('./services/adminPreferences').save(req.body)); } catch (e) { handleBookingError(res, e); }
});

app.post('/api/admin/contacts/:id/approve', requireAdmin, async (req, res) => {
  try { res.json(await contactActions.approve(req.params.id)); }
  catch (error) { handleBookingError(res, error); }
});

app.post('/api/admin/contacts/:id/reject', requireAdmin, async (req, res) => {
  try { res.json(await contactActions.reject(req.params.id)); }
  catch (error) { handleBookingError(res, error); }
});

// ===== CONTACT ROUTE =====

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_LIMITS = { name: 100, email: 254, phone: 40, company: 120, message: 5000 };
const VALID_INTENTS = new Set(['hire', 'freelance', 'hi']);

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, company, message, website, intent } = req.body || {};
    const ip = clientAddress(req);

    // Honeypot — bots fill hidden fields; humans leave them empty
    if (website) {
      return res.json({ success: true, message: 'Thanks — Pratyush will get back to you soon.' });
    }

    if (!VALID_INTENTS.has(intent)) {
      return res.status(400).json({ error: 'Please choose Hire me, Freelance, or Just say hi.' });
    }

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    const trimmed = {
      intent,
      name: String(name).trim(),
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : '',
      company: company ? String(company).trim() : '',
      message: String(message).trim(),
      ip: String(ip || ''),
    };

    if (!trimmed.name || !trimmed.message) return res.status(400).json({ error: 'Name and message cannot be blank.' });

    if (!EMAIL_RE.test(trimmed.email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (trimmed.name.length > CONTACT_LIMITS.name ||
        trimmed.email.length > CONTACT_LIMITS.email ||
        trimmed.phone.length > CONTACT_LIMITS.phone ||
        trimmed.company.length > CONTACT_LIMITS.company ||
        trimmed.message.length > CONTACT_LIMITS.message) {
      return res.status(400).json({ error: 'One or more fields exceed the maximum length.' });
    }

    await consume({ scope: 'contact-ip', subject: rateAddress(ip), limit: 6, windowMs: 3600000 });
    await consume({ scope: 'contact-ip-email', subject: [rateAddress(ip), trimmed.email.toLowerCase()], limit: 3, windowMs: 3600000 });

    // Store only — emails go out after admin approval
    if (isMongoConnected) {
      await ContactMessage.create(trimmed);
    } else {
      contactStore.create(trimmed);
    }

    res.json({
      success: true,
      message: 'Thanks — Pratyush will get back to you soon.',
      intentLabel: INTENT_LABEL[intent],
    });
  } catch (err) {
    if (err.status) return handleBookingError(res, err);
    console.error('[Contact] Failed to save contact message.');
    res.status(500).json({ error: 'Failed to save message. Please try again later.' });
  }
});

// Manual digest trigger (admin) — still no-ops when inbox is empty
app.post('/api/admin/digest/run', requireAdmin, async (req, res) => {
  try {
    const result = await runDailyDigest({
      isMongoConnected,
      force: req.query.force === '1' || req.body?.force === true,
    });
    res.json(result);
  } catch (err) {
    console.error('[Digest manual]', err);
    res.status(500).json({ error: err.message || 'Digest failed' });
  }
});

app.use('/api', createBookingRouter(bookingService, requireAdmin, getRazorpay));
app.use('/api', createQuotationRouter(quotationService, requireAdmin));

// Malformed JSON and invalid Mongo IDs are client errors, not HTML error pages.
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  console.error('[API] Request failed; request and upstream details suppressed.');
  res.status(500).json({ error: 'Request failed.' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startDailyDigestScheduler(() => isMongoConnected);
  let retryingNotifications = false;
  setInterval(async () => {
    if (retryingNotifications) return;
    retryingNotifications = true;
    for (const [name, job] of [
      ['booking', () => bookingService.retryNotifications()],
      ['receipts', () => require('./services/paymentReceipts').retry()],
      ['invitations', () => require('./services/quotationInvitations').retry()],
    ]) {
      try { await job(); }
      catch (error) {
        console.error(`[Notifications] ${name} worker failed (${error?.name || 'Error'}).`);
      }
    }
    retryingNotifications = false;
  }, 60_000).unref();
});
