const crypto = require('crypto');
const express = require('express');
const { handleHttpError } = require('../shared/errors');
const { limitRequests } = require('../shared/rateLimits');

class OperatorRouter {
  constructor({ grokbot, requireAdmin, env = process.env }) {
    this.grokbot = grokbot;
    this.requireAdmin = requireAdmin;
    this.env = env;
  }

  botToken() {
    return String(this.env.GROKBOT_TOKEN || '').trim();
  }

  digest(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest();
  }

  tokensMatch(candidate, expected) {
    if (!expected) return false;
    return crypto.timingSafeEqual(this.digest(candidate), this.digest(expected));
  }

  presentedToken(req) {
    const header = String(req.headers?.authorization || '').trim();
    if (header.slice(0, 6).toLowerCase() === 'bearer') return header.slice(6).trim();
    return String(req.headers['x-grokbot-token'] || '').trim();
  }

  guard() {
    return (req, res, next) => {
      if (this.tokensMatch(this.presentedToken(req), this.botToken())) {
        res.set('Cache-Control', 'no-store');
        return next();
      }
      return this.requireAdmin(req, res, next);
    };
  }

  send(res, work) {
    return work.then((payload) => res.json(payload)).catch((error) => handleHttpError(res, error));
  }

  create() {
    const router = express.Router();
    const auth = this.guard();
    router.use('/operator', (req, res, next) => {
      res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      next();
    });
    router.get('/operator/tools', auth, (req, res) => res.json({ tools: this.grokbot.catalog() }));
    router.post(
      '/operator/invoke',
      auth,
      limitRequests('grokbot-invoke', 60, 60000, () => 'grokbot'),
      (req, res) => this.send(res, this.invoke(req.body || {})),
    );
    router.post(
      '/operator/chat',
      auth,
      limitRequests('grokbot-chat', 20, 60000, () => 'grokbot'),
      (req, res) => this.send(res, this.grokbot.chat(req.body?.message, req.body?.history)),
    );
    return router;
  }

  invoke(body) {
    return this.grokbot.invoke(body.name, body.arguments || body.args || {});
  }
}

function createOperatorRouter(deps) {
  return new OperatorRouter(deps).create();
}

module.exports = { OperatorRouter, createOperatorRouter };
