const { it } = require('node:test');
const assert = require('node:assert/strict');
const { createAdminAuth } = require('../services/adminAuth');

function attempt(auth, password = 'wrong', email = 'admin@example.com') {
  let code = 200, next = false;
  const res = { status(value) { code = value; return this; }, json() {}, set() {} };
  auth({ ip: '127.0.0.1', headers: { 'x-admin-email': email, 'x-admin-password': password } }, res, () => { next = true; });
  return { code, next };
}
it('admin fails closed without configured credentials', () => {
  assert.equal(attempt(createAdminAuth({}), 'admin123').code, 503);
});
it('admin normalizes email but never trims or coerces passwords', () => {
  const auth = createAdminAuth({ ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: ' secret ' });
  assert.equal(attempt(auth, ' secret ', ' ADMIN@example.com ').next, true);
  assert.equal(attempt(auth, 'secret').code, 401);
});
it('admin throttles repeated invalid credentials', () => {
  const auth = createAdminAuth({ ADMIN_PASSWORD: 'secret' });
  for (let i = 0; i < 10; i++) assert.equal(attempt(auth).code, 401);
  assert.equal(attempt(auth).code, 429);
});
