const crypto = require('crypto');

const digest = (value) => crypto.createHash('sha256').update(value).digest();

function createAdminAuth(env = process.env) {
  const attempts = new Map();
  const windowMs = 15 * 60_000;
  return function requireAdmin(req, res, next) {
    const password = env.ADMIN_PASSWORD;
    if (!password) return res.status(503).json({ error: 'Admin credentials are not configured.' });
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
    const ip = req.ip || 'unknown';
    const entry = attempts.get(ip) || { count: 0, until: now + windowMs };
    if (entry.count >= 10) {
      res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
      return res.status(429).json({ error: 'Too many sign-in attempts. Try again later.' });
    }
    const email = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
    const expectedEmail = (env.ADMIN_EMAIL || 'mpratyush54@gmail.com').trim().toLowerCase();
    const candidate = String(req.headers['x-admin-password'] || '');
    if (!crypto.timingSafeEqual(digest(email), digest(expectedEmail)) || !crypto.timingSafeEqual(digest(candidate), digest(password))) {
      attempts.set(ip, { ...entry, count: entry.count + 1 });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    attempts.delete(ip);
    res.set('Cache-Control', 'no-store');
    next();
  };
}

module.exports = { createAdminAuth };
