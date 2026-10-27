const { it } = require('node:test');
const assert = require('node:assert/strict');
const { createAdminAuth, createAdminLogin } = require('../services/adminAuth');

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
  const auth = createAdminAuth({ ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: ' secret ' }, { consumeLimit: async () => ({}), releaseLimit: async () => {} });
  assert.equal((await attempt(auth, ' secret ', ' ADMIN@example.com ')).next, true);
  assert.equal((await attempt(auth, 'secret')).code, 401);
});
it('admin does not reveal even a correct credential when the shared budget is exhausted', async () => {
  const auth = createAdminAuth({ ADMIN_PASSWORD: 'secret' }, { consumeLimit: async () => { throw Object.assign(new Error('Too many attempts'), { status: 429, retryAfter: 123 }); } });
  assert.equal((await attempt(auth)).code, 429);
  assert.equal((await attempt(auth, 'secret', 'mpratyush54@gmail.com')).code, 429);
});
it('issues signed sessions that survive a reload and reject tampering', async () => {
  const env = { ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: 'secret', ADMIN_SESSION_SECRET: 'session-key' };
  const login = createAdminLogin(env, { consumeLimit: async () => ({}), releaseLimit: async () => {} });
  const session = await login({ body: { email: 'admin@example.com', password: 'secret', remember: true } });
  assert.match(session.token, /^[^.]+\.[^.]+$/);
  assert.equal(session.email, 'admin@example.com');
  assert.equal(session.remember, true);
  assert.ok(new Date(session.expiresAt) > new Date(Date.now() + 29 * 86400000));

  const auth = createAdminAuth(env, { consumeLimit: async () => { throw new Error('Bearer sessions must not spend the login budget'); } });
  let code = 200, next = false;
  const res = { status(value) { code = value; return this; }, json() {}, set() {} };
  await auth({ headers: { authorization: `Bearer ${session.token}` } }, res, () => { next = true; });
  assert.equal(next, true);
  assert.equal(code, 200);

  const tampered = `${session.token[0] === 'a' ? 'b' : 'a'}${session.token.slice(1)}`;
  code = 200; next = false;
  await auth({ headers: { authorization: `Bearer ${tampered}` } }, res, () => { next = true; });
  assert.equal(code, 401);
  assert.equal(next, false);
});
it('refuses to issue sessions for wrong credentials', async () => {
  const login = createAdminLogin(
    { ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: 'secret' },
    { consumeLimit: async () => ({}), releaseLimit: async () => {} },
  );
  await assert.rejects(login({ body: { email: 'admin@example.com', password: 'wrong' } }), (error) => error.status === 401);
});
