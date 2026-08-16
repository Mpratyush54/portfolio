const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10kb' }));

const { sendApprovedContactEmails, INTENT_LABEL } = require('./services/mailer');
const contactStore = require('./services/contactStore');
const ContactMessage = require('./models/ContactMessage');

// In-memory rate limiter
const rateStore = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 3;

function getRateKey(ip, email) {
  return `${ip}::${email}`;
}

function isRateLimited(ip, email) {
  const now = Date.now();
  const key = getRateKey(ip, email);
  const globalKey = `ip::${ip}`;

  [key, globalKey].forEach((k) => {
    if (!rateStore.has(k)) {
      rateStore.set(k, []);
    }
    const timestamps = rateStore.get(k).filter((t) => now - t < WINDOW_MS);
    rateStore.set(k, timestamps);
  });

  const byIpAndEmail = rateStore.get(key).length;
  const byIp = rateStore.get(globalKey).length;

  return byIpAndEmail >= MAX_REQUESTS || byIp >= MAX_REQUESTS * 2;
}

function recordAttempt(ip, email) {
  const now = Date.now();
  const key = getRateKey(ip, email);
  const globalKey = `ip::${ip}`;
  rateStore.get(key).push(now);
  rateStore.get(globalKey).push(now);
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateStore) {
    const filtered = v.filter((t) => now - t < WINDOW_MS);
    if (filtered.length) rateStore.set(k, filtered);
    else rateStore.delete(k);
  }
}, 60 * 1000);

const curatedProjects = require('./data/projects');

let isMongoConnected = false;
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio')
  .then(() => { console.log('MongoDB Connected'); isMongoConnected = true; })
  .catch(() => { console.log('MongoDB Connection Failed (Using Curated Data)'); });

const Project = require('./models/Project');
const { syncMetaOnly } = require('./services/gitFetcher');

// Admin auth
function requireAdmin(req, res, next) {
  const pw = process.env.ADMIN_PASSWORD || 'admin123';
  if (req.headers['x-admin-password'] !== pw) return res.status(401).json({ error: 'Unauthorized' });
  next();
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

app.get('/api/admin/status', requireAdmin, async (req, res) => {
  res.json({
    total: curatedProjects.length,
    sources: {
      github: curatedProjects.filter(p => p.source === 'github').length,
      gitlab: curatedProjects.filter(p => p.source === 'gitlab').length
    },
    mongoConnected: isMongoConnected
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
    const status = req.query.status;
    let rows = [];
    if (isMongoConnected) {
      const q = status ? { status } : {};
      rows = await ContactMessage.find(q).sort({ createdAt: -1 }).lean();
    } else {
      rows = contactStore.list();
      if (status) rows = rows.filter(r => r.status === status);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/contacts/:id/approve', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    let msg = null;
    if (isMongoConnected) {
      msg = await ContactMessage.findById(id);
      if (!msg) return res.status(404).json({ error: 'Not found' });
      if (msg.status === 'approved' && msg.emailSentAt) {
        return res.json({ success: true, message: 'Already approved and emailed.' });
      }
    } else {
      msg = contactStore.findById(id);
      if (!msg) return res.status(404).json({ error: 'Not found' });
      if (msg.status === 'approved' && msg.emailSentAt) {
        return res.json({ success: true, message: 'Already approved and emailed.' });
      }
    }

    await sendApprovedContactEmails(msg);

    const patch = {
      status: 'approved',
      approvedAt: new Date(),
      emailSentAt: new Date(),
    };

    if (isMongoConnected) {
      Object.assign(msg, patch);
      await msg.save();
      res.json({ success: true, message: 'Approved — owner + visitor emails sent.', item: msg });
    } else {
      const updated = contactStore.update(id, {
        ...patch,
        approvedAt: patch.approvedAt.toISOString(),
        emailSentAt: patch.emailSentAt.toISOString(),
      });
      res.json({ success: true, message: 'Approved — owner + visitor emails sent.', item: updated });
    }
  } catch (err) {
    console.error('[Contact approve]', err);
    res.status(500).json({ error: err.message || 'Failed to approve' });
  }
});

app.post('/api/admin/contacts/:id/reject', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (isMongoConnected) {
      const msg = await ContactMessage.findByIdAndUpdate(
        id,
        { $set: { status: 'rejected', rejectedAt: new Date() } },
        { new: true }
      );
      if (!msg) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true, item: msg });
    }
    const existing = contactStore.findById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = contactStore.update(id, {
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
    });
    res.json({ success: true, item: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CONTACT ROUTE =====

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_LIMITS = { name: 100, email: 254, phone: 40, company: 120, message: 5000 };
const VALID_INTENTS = new Set(['hire', 'freelance', 'hi']);

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, company, message, website, intent } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

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

    if (isRateLimited(ip, trimmed.email.toLowerCase())) {
      return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
    }

    recordAttempt(ip, trimmed.email.toLowerCase());

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
    console.error('[Contact] Error:', err);
    res.status(500).json({ error: 'Failed to save message. Please try again later.' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
