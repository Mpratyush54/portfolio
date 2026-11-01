const { handleHttpError } = require('../shared/errors');
const { limitRequests } = require('../shared/rateLimits');

const PROTOCOL = '2025-03-26';
const SUPPORTED = new Set(['2024-11-05', '2025-03-26', '2025-06-18']);

class McpServer {
  constructor({ grokbot, oauth, guard }) {
    this.grokbot = grokbot;
    this.oauth = oauth;
    this.guard = guard;
    this.unauthenticated = this.unauthenticated.bind(this);
    this.handle = this.handle.bind(this);
  }

  attach(app) {
    const limited = limitRequests('grokbot-mcp', 120, 60000, () => 'grokbot');
    app.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/mcp',
      '/api/.well-known/oauth-protected-resource'], (req, res) => {
      res.set({ ...this.cors(), 'Cache-Control': 'no-store' });
      res.json(this.oauth.resourceMetadata());
    });
    app.get(['/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server/api',
      '/api/.well-known/oauth-authorization-server'], (req, res) => {
      res.set({ ...this.cors(), 'Cache-Control': 'no-store' });
      res.json(this.oauth.serverMetadata());
    });
    app.get('/api/oauth/authorize', (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.type('html').send(this.oauth.authorizePage(req.query));
    });
    app.post('/api/oauth/authorize', async (req, res) => {
      try {
        res.set('Cache-Control', 'no-store');
        res.redirect(303, await this.oauth.completeAuthorize(req));
      } catch (error) {
        if (error.status === 401) {
          return res.status(401).type('html').send(this.oauth.authorizePage(req.body || {}, error.message));
        }
        handleHttpError(res, error);
      }
    });
    app.post('/api/oauth/register', (req, res) => {
      try {
        res.status(201).json(this.oauth.register(req.body || {}));
      } catch (error) {
        handleHttpError(res, error);
      }
    });
    app.post('/api/oauth/token', (req, res) => {
      try {
        res.set('Cache-Control', 'no-store');
        res.json(this.oauth.exchange(req.body || {}));
      } catch (error) {
        handleHttpError(res, error);
      }
    });
    app.options('/api/mcp', (req, res) => {
      res.set(this.cors()).sendStatus(204);
    });
    app.get('/api/mcp', this.unauthenticated, (req, res) => {
      res.set({ ...this.cors(), 'Cache-Control': 'no-store' });
      res.status(405).json({ error: 'Use POST streamable HTTP for the portfolio MCP server.' });
    });
    app.post('/api/mcp', this.unauthenticated, limited, this.guard, (req, res) => {
      this.handle(req, res);
    });
  }

  cors() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    };
  }

  unauthenticated(req, res, next) {
    const origin = String(req.get('origin') || '');
    if (origin && !/^https:\/\/([a-z0-9-]+\.)*(x\.ai|grok\.com|grokbot\.com|cursor\.com|pratyushes\.dev)(:\d+)?$/i.test(origin)
      && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return res.status(403).json({ error: 'Unknown origin.' });
    }
    next();
  }

  async handle(req, res) {
    res.set({ ...this.cors(), 'Cache-Control': 'no-store' });
    const messages = Array.isArray(req.body) ? req.body : [req.body];
    try {
      const replies = [];
      for (const message of messages) {
        const reply = await this.dispatch(message);
        if (reply) replies.push(reply);
      }
      if (!replies.length) return res.status(202).end();
      res.json(replies.length === 1 && !Array.isArray(req.body) ? replies[0] : replies);
    } catch (error) {
      if (error.status) return handleHttpError(res, error);
      res.status(500).json(this.rpcError(req.body?.id, -32603, 'MCP request failed.'));
    }
  }

  async dispatch(message) {
    if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      return this.rpcError(message?.id, -32600, 'Invalid MCP request.');
    }
    if (message.id === undefined) return null;
    try {
      if (message.method === 'initialize') return this.result(message.id, this.initialize(message.params || {}));
      if (message.method === 'ping') return this.result(message.id, {});
      if (message.method === 'tools/list') return this.result(message.id, this.tools());
      if (message.method === 'tools/call') return this.result(message.id, await this.call(message.params || {}));
      return this.rpcError(message.id, -32601, `Unknown MCP method ${message.method}.`);
    } catch (error) {
      return this.result(message.id, {
        content: [{ type: 'text', text: error.status ? error.message : 'Tool failed.' }],
        isError: true,
      });
    }
  }

  initialize(params) {
    const requested = String(params.protocolVersion || PROTOCOL);
    return {
      protocolVersion: SUPPORTED.has(requested) ? requested : PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: {
        name: 'pratyushes-portfolio',
        title: 'pratyushes.dev admin',
        version: '1.0.0',
      },
      instructions:
        'You are connected to the pratyushes.dev admin. List contacts, bookings, or quotations first. Do not invent IDs. Use assign_booking only with updatedAt from list_bookings.',
    };
  }

  tools() {
    return {
      tools: this.grokbot.catalog().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters || { type: 'object', properties: {} },
      })),
    };
  }

  async call(params) {
    const result = await this.grokbot.invoke(params.name, params.arguments || {});
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }

  result(id, result) {
    return { jsonrpc: '2.0', id, result };
  }

  rpcError(id, code, message) {
    return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
  }
}

module.exports = { McpServer };
