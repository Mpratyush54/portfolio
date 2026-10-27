const crypto = require('crypto');
const { consume, release, respond } = require('./rateLimits');
const { clientAddress, rateAddress } = require('./clientAddress');
const { httpError } = require('./bookingValidation');

const digest = (value) => crypto.createHash('sha256').update(value).digest();
const SESSION_SHORT_MS = 12 * 60 * 60 * 1000;
const SESSION_LONG_MS = 30 * 24 * 60 * 60 * 1000;
const expectedEmail = (env) =>
  (env.ADMIN_EMAIL || 'mpratyush54@gmail.com').trim().toLowerCase();
const sessionKey = (env) => env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD || '';

function credentialsMatch(env, email, password) {
  if (!env.ADMIN_PASSWORD) return false;
  const candidate = String(password ?? '');
  return (
    crypto.timingSafeEqual(digest(String(email || '').trim().toLowerCase()), digest(expectedEmail(env))) &&
    crypto.timingSafeEqual(digest(candidate), digest(env.ADMIN_PASSWORD))
  );
}

function createSession(env, ttl) {
  const key = sessionKey(env);
  if (!key) throw httpError(503, 'Admin credentials are not configured.');
  const payload = Buffer.from(
    JSON.stringify({ e: expectedEmail(env), x: Date.now() + ttl }),
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function validSession(env, token) {
  if (typeof token !== 'string' || token.length > 4096) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const key = sessionKey(env);
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
    data.e === expectedEmail(env) &&
    Number.isFinite(data.x) &&
    data.x > Date.now()
  );
}

function bearerToken(req) {
  const header = String(req.headers?.authorization || '').trim();
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

function createAdminAuth(env = process.env, { consumeLimit = consume, releaseLimit = release } = {}) {
  return async function requireAdmin(req, res, next) {
    if (!env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin credentials are not configured.' });
    const token = bearerToken(req);
    if (token) {
      if (!validSession(env, token)) {
        res.set('Cache-Control', 'no-store');
        return res.status(401).json({ error: 'Session expired. Sign in again.' });
      }
      res.set('Cache-Control', 'no-store');
      return next();
    }
    // Reserve before comparing credentials: checking the password first would
    // still reveal a correct guess after the failed-attempt budget was exhausted.
    let reservation;
    try {
      reservation = await consumeLimit({ scope: 'admin-invalid-login', subject: rateAddress(clientAddress(req)), limit: 10, windowMs: 15 * 60000, reserve: true });
    } catch (error) { return respond(res, error); }
    const email = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
    const candidate = String(req.headers['x-admin-password'] || '');
    if (!credentialsMatch(env, email, candidate)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Successful authenticated UI traffic does not spend the failed-login quota.
    try { await releaseLimit(reservation); } catch (error) { return respond(res, error); }
    res.set('Cache-Control', 'no-store');
    next();
  };
}

function createAdminLogin(env = process.env, { consumeLimit = consume, releaseLimit = release } = {}) {
  return async function login(req) {
    if (!env.ADMIN_PASSWORD) throw httpError(503, 'Admin credentials are not configured.');
    const body = req.body || {};
    if (
      typeof body.email !== 'string' ||
      !body.email.trim() ||
      typeof body.password !== 'string' ||
      !body.password
    )
      throw httpError(400, 'Enter your admin email and password.');
    // Failed logins share the same budget as legacy header authentication.
    let reservation;
    try {
      reservation = await consumeLimit({ scope: 'admin-invalid-login', subject: rateAddress(clientAddress(req)), limit: 10, windowMs: 15 * 60000, reserve: true });
    } catch (error) { throw error; }
    if (!credentialsMatch(env, body.email, body.password)) throw httpError(401, 'Unauthorized');
    try { await releaseLimit(reservation); } catch (error) { throw error; }
    const remember = body.remember === true;
    const ttl = remember ? SESSION_LONG_MS : SESSION_SHORT_MS;
    return {
      token: createSession(env, ttl),
      expiresAt: new Date(Date.now() + ttl).toISOString(),
      email: expectedEmail(env),
      remember,
    };
  };
}

module.exports = { createAdminAuth, createAdminLogin };
