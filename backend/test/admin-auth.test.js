const { it } = require('node:test');
const assert = require('node:assert/strict');
const { createAdminAuth } = require('../services/adminAuth');

async function attempt(auth, password = 'wrong', email = 'admin@example.com') {
  let code = 200, next = false;
  const res = { status(value) { code = value; return this; }, json() {}, set() {} };
  await auth({ ip: '127.0.0.1', headers: { 'x-admin-email': email, 'x-admin-password': password } }, res, () => { next = true; });
  return { code, next };
}
it('admin fails closed without configured credentials', async () => {
  assert.equal((await attempt(createAdminAuth({}), 'admin123')).code, 503);
});
it('admin normalizes email but never trims or coerces passwords', async () => {
  const auth = createAdminAuth({ ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: ' secret ' }, { consumeLimit: async () => {} });
  assert.equal((await attempt(auth, ' secret ', ' ADMIN@example.com ')).next, true);
  assert.equal((await attempt(auth, 'secret')).code, 401);
});
it('admin reports the shared limiter rejection and keeps valid credentials usable', async () => {
  const auth = createAdminAuth({ ADMIN_PASSWORD: 'secret' }, { consumeLimit: async () => { throw Object.assign(new Error('Too many attempts'), { status: 429, retryAfter: 123 }); } });
  assert.equal((await attempt(auth)).code, 429);
  assert.equal((await attempt(auth, 'secret', 'mpratyush54@gmail.com')).next, true);
});
