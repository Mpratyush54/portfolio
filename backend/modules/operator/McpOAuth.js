const crypto = require('crypto');
const { AdminAuth } = require('../admin/auth');
const { consume } = require('../shared/rateLimits');
const { clientAddress, rateAddress } = require('../shared/clientAddress');

const CODE_MS = 10 * 60 * 1000;
const TOKEN_MS = 30 * 24 * 60 * 60 * 1000;

class McpOAuth {
  constructor({ env = process.env, auth = new AdminAuth(env) } = {}) {
    this.env = env;
    this.auth = auth;
  }

  publicUrl() {
    return String(this.env.PUBLIC_URL || 'https://pratyushes.dev').replace(/\/$/, '');
  }

  issuer() {
    return `${this.publicUrl()}/api`;
  }

  resource() {
    return `${this.publicUrl()}/api/mcp`;
  }

  key() {
    return this.auth.sessionKey();
  }

  sign(data) {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    const signature = crypto.createHmac('sha256', this.key()).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  read(token) {
    if (typeof token !== 'string' || !token.includes('.')) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature || !this.key()) return null;
    const expected = crypto.createHmac('sha256', this.key()).update(payload).digest('base64url');
    if (!crypto.timingSafeEqual(
      crypto.createHash('sha256').update(signature).digest(),
      crypto.createHash('sha256').update(expected).digest(),
    )) return null;
    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  }

  resourceMetadata() {
    return {
      resource: this.resource(),
      authorization_servers: [this.issuer()],
      bearer_methods_supported: ['header'],
      scopes_supported: ['admin'],
    };
  }

  serverMetadata() {
    return {
      issuer: this.issuer(),
      authorization_endpoint: `${this.issuer()}/oauth/authorize`,
      token_endpoint: `${this.issuer()}/oauth/token`,
      registration_endpoint: `${this.issuer()}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      scopes_supported: ['admin'],
    };
  }

  challenge(req) {
    const metadata = `${this.publicUrl()}/.well-known/oauth-protected-resource`;
    return `Bearer realm="portfolio-admin", resource_metadata="${metadata}"`;
  }

  validAccessToken(token) {
    const data = this.read(token);
    return Boolean(data && data.s === 'mcp' && data.e === this.auth.expectedEmail() && data.x > Date.now());
  }

  register(body = {}) {
    const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((uri) => this.safeRedirect(uri)) : [];
    if (!uris.length) {
      const error = new Error('Provide at least one HTTPS redirect URI.');
      error.status = 400;
      throw error;
    }
    const clientId = this.sign({ t: 'client', uris, name: String(body.client_name || 'Grok Bot').slice(0, 80), iat: Date.now() });
    return {
      client_id: clientId,
      client_name: body.client_name || 'Grok Bot',
      redirect_uris: uris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    };
  }

  safeRedirect(uri) {
    try {
      const link = new URL(String(uri || ''));
      if (link.protocol === 'https:') return true;
      return link.protocol === 'http:' && (link.hostname === 'localhost' || link.hostname === '127.0.0.1');
    } catch {
      return false;
    }
  }

  client(id) {
    const data = this.read(id);
    return data && data.t === 'client' && Array.isArray(data.uris) ? data : null;
  }

  authorizePage(query, error = '') {
    const clientId = String(query.client_id || '');
    const redirect = String(query.redirect_uri || '');
    const state = String(query.state || '');
    const challenge = String(query.code_challenge || '');
    const method = String(query.code_challenge_method || 'S256');
    const notice = error ? `<p style="color:#b42318">${escapeHtml(error)}</p>` : '';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Allow Grok Bot</title>
<style>body{font-family:Georgia,serif;background:#111;color:#f4efe6;margin:0;padding:48px 20px}main{max-width:420px;margin:0 auto}label,input{display:block;width:100%}input{margin:6px 0 16px;padding:10px;border:0;border-radius:6px}button{background:#f4efe6;color:#111;border:0;padding:10px 16px;border-radius:6px;font:inherit;cursor:pointer}</style></head>
<body><main><h1>Allow Grok Bot</h1><p>Sign in with your portfolio admin account so the Grok Bot app can manage contacts, bookings, and quotations.</p>${notice}
<form method="post" action="/api/oauth/authorize">
<input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
<input type="hidden" name="redirect_uri" value="${escapeHtml(redirect)}">
<input type="hidden" name="state" value="${escapeHtml(state)}">
<input type="hidden" name="code_challenge" value="${escapeHtml(challenge)}">
<input type="hidden" name="code_challenge_method" value="${escapeHtml(method)}">
<label>Admin email</label><input name="email" type="email" autocomplete="username" required>
<label>Password</label><input name="password" type="password" autocomplete="current-password" required>
<button type="submit">Allow access</button>
</form></main></body></html>`;
  }

  async completeAuthorize(req) {
    const body = req.body || {};
    await consume({
      scope: 'mcp-oauth-login',
      subject: rateAddress(clientAddress(req)),
      limit: 10,
      windowMs: 15 * 60000,
    });
    const client = this.client(body.client_id);
    if (!client || !client.uris.includes(body.redirect_uri) || !this.safeRedirect(body.redirect_uri)) {
      throw Object.assign(new Error('Unknown Grok Bot client.'), { status: 400 });
    }
    if (body.code_challenge_method !== 'S256' || !body.code_challenge) {
      throw Object.assign(new Error('Grok Bot must use PKCE S256.'), { status: 400 });
    }
    if (!this.auth.credentialsMatch(body.email, body.password)) {
      throw Object.assign(new Error('Invalid email or password.'), { status: 401 });
    }
    const code = this.sign({
      t: 'code',
      cid: body.client_id,
      uri: body.redirect_uri,
      chal: body.code_challenge,
      exp: Date.now() + CODE_MS,
    });
    const target = new URL(body.redirect_uri);
    target.searchParams.set('code', code);
    if (body.state) target.searchParams.set('state', String(body.state));
    return target.toString();
  }

  exchange(body = {}) {
    const client = this.client(body.client_id);
    const code = this.read(body.code);
    if (!client || !code || code.t !== 'code' || code.cid !== body.client_id || code.uri !== body.redirect_uri) {
      throw Object.assign(new Error('Invalid authorization code.'), { status: 400 });
    }
    if (code.exp <= Date.now()) throw Object.assign(new Error('Authorization code expired.'), { status: 400 });
    const challenge = crypto.createHash('sha256').update(String(body.code_verifier || '')).digest('base64url');
    if (challenge !== code.chal) throw Object.assign(new Error('PKCE verification failed.'), { status: 400 });
    return {
      access_token: this.sign({ e: this.auth.expectedEmail(), x: Date.now() + TOKEN_MS, s: 'mcp' }),
      token_type: 'Bearer',
      expires_in: Math.floor(TOKEN_MS / 1000),
      scope: 'admin',
    };
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { McpOAuth };
