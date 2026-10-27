const crypto = require('crypto');
const { consume, respond } = require('./rateLimits');
const { clientAddress, rateAddress } = require('./clientAddress');

const digest = (value) => crypto.createHash('sha256').update(value).digest();

function createAdminAuth(env = process.env, { consumeLimit = consume } = {}) {
  return async function requireAdmin(req, res, next) {
    const password = env.ADMIN_PASSWORD;
    if (!password) return res.status(503).json({ error: 'Admin credentials are not configured.' });
    const email = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
    const expectedEmail = (env.ADMIN_EMAIL || 'mpratyush54@gmail.com').trim().toLowerCase();
    const candidate = String(req.headers['x-admin-password'] || '');
    const emailMatches = crypto.timingSafeEqual(digest(email), digest(expectedEmail));
    const passwordMatches = crypto.timingSafeEqual(digest(candidate), digest(password));
    if (!emailMatches || !passwordMatches) {
      try {
        await consumeLimit({ scope: 'admin-invalid-login', subject: rateAddress(clientAddress(req)), limit: 10, windowMs: 15 * 60000 });
      } catch (error) { return respond(res, error); }
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.set('Cache-Control', 'no-store');
    next();
  };
}

module.exports = { createAdminAuth };
