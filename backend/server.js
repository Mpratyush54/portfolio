const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
