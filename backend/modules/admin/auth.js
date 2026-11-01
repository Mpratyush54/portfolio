const crypto = require('crypto');
const { consume, release, respond } = require('../shared/rateLimits');
const { clientAddress, rateAddress } = require('../shared/clientAddress');
const { httpError } = require('../shared/errors');

const digest = (value) => crypto.createHash('sha256').update(value).digest();
const SESSION_SHORT_MS = 12 * 60 * 60 * 1000;
const SESSION_LONG_MS = 30 * 24 * 60 * 60 * 1000;

class AdminAuth {
  constructor(env = process.env, { consumeLimit = consume, releaseLimit = release } = {}) {
    this.env = env;
    this.consumeLimit = consumeLimit;
    this.releaseLimit = releaseLimit;
  }

  expectedEmail() {
    return (this.env.ADMIN_EMAIL || 'mpratyush54@gmail.com').trim().toLowerCase();
  }

  sessionKey() {
    return this.env.ADMIN_SESSION_SECRET || this.env.ADMIN_PASSWORD || '';
  }

  credentialsMatch(email, password) {
    if (!this.env.ADMIN_PASSWORD) return false;
    const candidate = String(password ?? '');
    return (
      crypto.timingSafeEqual(digest(String(email || '').trim().toLowerCase()), digest(this.expectedEmail())) &&
      crypto.timingSafeEqual(digest(candidate), digest(this.env.ADMIN_PASSWORD))
    );
  }

  createSession(ttl) {
    const key = this.sessionKey();
    if (!key) throw httpError(503, 'Admin credentials are not configured.');
    const payload = Buffer.from(
      JSON.stringify({ e: this.expectedEmail(), x: Date.now() + ttl }),
    ).toString('base64url');
    const signature = crypto.createHmac('sha256', key).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  validSession(token) {
    if (typeof token !== 'string' || token.length > 4096) return false;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    const key = this.sessionKey();
    if (!key) return false;
    const expected = crypto
      .createHmac('sha256', key)
      .update(payload)
      .digest('base64url');
    if (!crypto.timingSafeEqual(digest(signature), digest(expected))) return false;
    let data;
    try {
      data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return false;
    }
    return (
      data &&
      data.e === this.expectedEmail() &&
      Number.isFinite(data.x) &&
      data.x > Date.now()
    );
  }

  bearerToken(req) {
    const header = String(req.headers?.authorization || '').trim();
    const prefix = 'bearer';
    if (header.slice(0, prefix.length).toLowerCase() !== prefix) return '';
    const rest = header.slice(prefix.length);
    if (!rest || (rest[0] !== ' ' && rest[0] !== '\t')) return '';
    return rest.trim();
  }

  middleware() {
    const self = this;
    return async function requireAdmin(req, res, next) {
      if (!self.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin credentials are not configured.' });
      const token = self.bearerToken(req);
      if (token) {
        if (!self.validSession(token)) {
          res.set('Cache-Control', 'no-store');
          return res.status(401).json({ error: 'Session expired. Sign in again.' });
        }
        res.set('Cache-Control', 'no-store');
        return next();
      }
      let reservation;
      try {
        reservation = await self.consumeLimit({
          scope: 'admin-invalid-login',
          subject: rateAddress(clientAddress(req)),
          limit: 10,
          windowMs: 15 * 60000,
          reserve: true,
        });
      } catch (error) { return respond(res, error); }
      const email = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
      const candidate = String(req.headers['x-admin-password'] || '');
      if (!self.credentialsMatch(email, candidate)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      try { await self.releaseLimit(reservation); } catch (error) { return respond(res, error); }
      res.set('Cache-Control', 'no-store');
      next();
    };
  }

  loginHandler() {
    const self = this;
    return async function login(req) {
      if (!self.env.ADMIN_PASSWORD) throw httpError(503, 'Admin credentials are not configured.');
      const body = req.body || {};
      if (
        typeof body.email !== 'string' ||
        !body.email.trim() ||
        typeof body.password !== 'string' ||
        !body.password
      )
        throw httpError(400, 'Enter your admin email and password.');
      let reservation;
      try {
        reservation = await self.consumeLimit({
          scope: 'admin-invalid-login',
          subject: rateAddress(clientAddress(req)),
          limit: 10,
          windowMs: 15 * 60000,
          reserve: true,
        });
      } catch (error) { throw error; }
      if (!self.credentialsMatch(body.email, body.password)) throw httpError(401, 'Unauthorized');
      try { await self.releaseLimit(reservation); } catch (error) { throw error; }
      const remember = body.remember === true;
      const ttl = remember ? SESSION_LONG_MS : SESSION_SHORT_MS;
      return {
        token: self.createSession(ttl),
        expiresAt: new Date(Date.now() + ttl).toISOString(),
        email: self.expectedEmail(),
        remember,
      };
    };
  }
}

function createAdminAuth(env = process.env, deps = {}) {
  return new AdminAuth(env, deps).middleware();
}

function createAdminLogin(env = process.env, deps = {}) {
  return new AdminAuth(env, deps).loginHandler();
}

module.exports = { AdminAuth, createAdminAuth, createAdminLogin };
