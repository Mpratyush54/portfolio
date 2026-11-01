const REQUIRED = ['POSTHOG_HOST', 'POSTHOG_PROJECT_ID', 'POSTHOG_CLI_API_KEY'];

export function environment({ dryRun = false } = {}) {
  if (dryRun) {
    return {
      host: process.env.POSTHOG_HOST || 'https://us.posthog.com',
      projectId: process.env.POSTHOG_PROJECT_ID || 'DRY_RUN_PROJECT',
      apiKey: process.env.POSTHOG_CLI_API_KEY || 'DRY_RUN_KEY',
    };
  }
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  const host = new URL(process.env.POSTHOG_HOST);
  if (host.protocol !== 'https:' && host.hostname !== 'localhost')
    throw new Error('POSTHOG_HOST must use HTTPS');
  return {
    host: host.href.replace(/\/$/, ''),
    projectId: process.env.POSTHOG_PROJECT_ID.trim(),
    apiKey: process.env.POSTHOG_CLI_API_KEY.trim(),
  };
}

export function apiClient(config, { dryRun = false } = {}) {
  const base = `${config.host}/api/projects/${encodeURIComponent(config.projectId)}`;
  async function request(method, path, body) {
    if (dryRun) return { dryRun: true, method, path, body };
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { detail: text };
    }
    if (!response.ok) {
      const detail = payload.detail || payload.error || text || response.statusText;
      throw new Error(`PostHog ${method} ${path} failed (${response.status}): ${detail}`);
    }
    return payload;
  }
  async function list(path) {
    if (dryRun) return [];
    const values = [];
    let url = `${base}${path}`;
    while (url) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      if (!response.ok)
        throw new Error(`PostHog GET ${path} failed (${response.status}): ${await response.text()}`);
      const payload = await response.json();
      values.push(...(Array.isArray(payload) ? payload : payload.results || []));
      url = Array.isArray(payload) ? null : payload.next;
    }
    return values;
  }
  return { request, list };
}

export function parseArgs(argv) {
  const known = new Set(['--dry-run', '--json', '--smoke']);
  const unknown = argv.filter((arg) => !known.has(arg));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(', ')}`);
  return {
    dryRun: argv.includes('--dry-run'),
    json: argv.includes('--json'),
    smoke: argv.includes('--smoke'),
  };
}
