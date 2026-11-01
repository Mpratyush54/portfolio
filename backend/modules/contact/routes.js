const express = require('express');
const ContactMessage = require('./ContactMessage');
const { ContactValidator } = require('./validation');
const { clientAddress, rateAddress } = require('../shared/clientAddress');
const { consume } = require('../shared/rateLimits');
const { handleHttpError } = require('../shared/errors');
const { INTENT_LABEL } = require('../shared/mailer');
const adminLists = require('../admin/lists');

const STATUSES = ['pending', 'approved', 'rejected'];
const THANKS = 'Thanks — Pratyush will get back to you soon.';

class ContactRouter {
  constructor({ contactActions, requireAdmin }) {
    this.contactActions = contactActions;
    this.requireAdmin = requireAdmin;
  }

  send(res, work, fallbackStatus = 500, fallbackMessage = 'Failed to save message. Please try again later.') {
    return work
      .then((payload) => res.json(payload))
      .catch((error) => {
        if (error.status) return handleHttpError(res, error);
        console.error('[Contact] Operation failed; details suppressed.');
        return res.status(fallbackStatus).json({ error: fallbackMessage });
      });
  }

  create() {
    const router = express.Router();
    router.post('/contact', (req, res) => this.send(res, this.submit(req)));
    router.get('/admin/contacts', this.requireAdmin, (req, res) =>
      this.send(res, this.list(req.query), 500, 'Could not load contacts.'),
    );
    router.post('/admin/contacts/:id/approve', this.requireAdmin, (req, res) =>
      this.send(res, this.contactActions.approve(req.params.id), 500, 'Could not update contact.'),
    );
    router.post('/admin/contacts/:id/reject', this.requireAdmin, (req, res) =>
      this.send(res, this.contactActions.reject(req.params.id), 500, 'Could not update contact.'),
    );
    return router;
  }

  async submit(req) {
    const details = ContactValidator.submission(req.body);
    if (details.spam) return { success: true, message: THANKS };
    const ip = clientAddress(req);
    await consume({ scope: 'contact-ip', subject: rateAddress(ip), limit: 6, windowMs: 3600000 });
    await consume({
      scope: 'contact-ip-email',
      subject: [rateAddress(ip), details.email.toLowerCase()],
      limit: 3,
      windowMs: 3600000,
    });
    await ContactMessage.create({ ...details, ip: String(ip || '') });
    return {
      success: true,
      message: THANKS,
      intentLabel: INTENT_LABEL[details.intent],
    };
  }

  async list(query) {
    if (query.page) {
      return adminLists.page(ContactMessage, query, STATUSES, {
        select: '-ip -approvalClaim -approvalClaimAt',
        searchFields: ['name', 'email', 'company'],
      });
    }
    const status = ContactValidator.listStatus(query.status);
    return ContactMessage.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(100)
      .select('-ip -approvalClaim -approvalClaimAt')
      .lean();
  }
}

function createContactRouter(deps) {
  return new ContactRouter(deps).create();
}

module.exports = { ContactRouter, createContactRouter };
