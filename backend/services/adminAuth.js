const crypto = require('crypto');
const { consume, release, respond } = require('./rateLimits');
const { clientAddress, rateAddress } = require('./clientAddress');

const digest = (value) => crypto.createHash('sha256').update(value).digest();

function createAdminAuth(env = process.env, { consumeLimit = consume, releaseLimit = release } = {}) {
  return async function requireAdmin(req, res, next) {
    const password = env.ADMIN_PASSWORD;
    if (!password) return res.status(503).json({ error: 'Admin credentials are not configured.' });
    // Reserve before comparing credentials: checking the password first would
    // still reveal a correct guess after the failed-attempt budget was exhausted.
    let reservation;
    try {
      reservation = await consumeLimit({ scope: 'admin-invalid-login', subject: rateAddress(clientAddress(req)), limit: 10, windowMs: 15 * 60000, reserve: true });
    } catch (error) { return respond(res, error); }
    const email = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
    const expectedEmail = (env.ADMIN_EMAIL || 'mpratyush54@gmail.com').trim().toLowerCase();
    const candidate = String(req.headers['x-admin-password'] || '');
    const emailMatches = crypto.timingSafeEqual(digest(email), digest(expectedEmail));
    const passwordMatches = crypto.timingSafeEqual(digest(candidate), digest(password));
    if (!emailMatches || !passwordMatches) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Successful authenticated UI traffic does not spend the failed-login quota.
    try { await releaseLimit(reservation); } catch (error) { return respond(res, error); }
    res.set('Cache-Control', 'no-store');
    next();
  };
}

module.exports = { createAdminAuth };
