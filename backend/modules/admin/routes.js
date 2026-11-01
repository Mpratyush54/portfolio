const express = require('express');
const ContactMessage = require('../contact/ContactMessage');
const Booking = require('../booking/Booking');
const Quotation = require('../quotations/Quotation');
const Project = require('../projects/Project');
const curatedProjects = require('../../data/projects');
const { syncMetaOnly } = require('../projects/gitFetcher');
const preferences = require('./preferences');
const { handleHttpError } = require('../shared/errors');
const { runDailyDigest } = require('../digest/service');
const { mongoReady } = require('../shared/mongo');

class AdminRouter {
  constructor({ requireAdmin, adminLogin }) {
    this.requireAdmin = requireAdmin;
    this.adminLogin = adminLogin;
  }

  send(res, work) {
    return work.then((payload) => res.json(payload)).catch((error) => handleHttpError(res, error));
  }

  create() {
    const router = express.Router();
    router.post('/admin/session', (req, res) => this.login(req, res));
    router.get('/admin/status', this.requireAdmin, (req, res) => this.send(res, this.status()));
    router.post('/admin/sync', this.requireAdmin, (req, res) => this.send(res, this.sync()));
    router.get('/admin/notification-settings', this.requireAdmin, (req, res) =>
      this.send(res, preferences.read()),
    );
    router.put('/admin/notification-settings', this.requireAdmin, (req, res) =>
      this.send(res, preferences.save(req.body)),
    );
    router.post('/admin/digest/run', this.requireAdmin, (req, res) =>
      this.send(res, this.runDigest(req)),
    );
    return router;
  }

  async login(req, res) {
    res.set('Cache-Control', 'no-store');
    try {
      res.json(await this.adminLogin(req));
    } catch (error) {
      if (error.status === 429) res.set('Retry-After', String(error.retryAfter || 60));
      res.status(error.status || 503).json({
        error: error.status === 401 ? 'Invalid email or password.' : error.status ? error.message : 'Could not sign in.',
      });
    }
  }

  async status() {
    let counts = null;
    try {
      const [pendingContacts, paidBookings, reviewBookings, draftQuotes, invitedQuotes, acceptedQuotes] =
        await Promise.all([
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
    return {
      total: curatedProjects.length,
      sources: {
        github: curatedProjects.filter((project) => project.source === 'github').length,
        gitlab: curatedProjects.filter((project) => project.source === 'gitlab').length,
      },
      mongoConnected: mongoReady(),
      counts,
    };
  }

  async sync() {
    const meta = await syncMetaOnly();
    let updated = 0;
    for (const row of meta) {
      const existing = await Project.findOne({ sourceUrl: row.sourceUrl });
      const live = {
        languageStats: row.languageStats,
        timeline: row.timeline,
        status: row.status,
        lastSyncedAt: new Date(),
      };
      if (existing) {
        await Project.findByIdAndUpdate(existing._id, { $set: live });
        updated += 1;
        continue;
      }
      const curated = curatedProjects.find((project) => project.sourceUrl === row.sourceUrl);
      if (!curated) continue;
      await Project.create({ ...curated, ...live });
      updated += 1;
    }
    return { success: true, message: `Metadata synced for ${updated}/${meta.length} projects` };
  }

  runDigest(req) {
    return runDailyDigest({
      force: req.query.force === '1' || req.body?.force === true,
    });
  }
}

function createAdminRouter(deps) {
  return new AdminRouter(deps).create();
}

module.exports = { AdminRouter, createAdminRouter };
