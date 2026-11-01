const { z } = require('zod');
const { httpError } = require('../shared/errors');

const TOOLS = [
  {
    name: 'workspace_status',
    description: 'Show pending contacts, paid or review bookings, and quotation counts.',
    parameters: { type: 'object', properties: {} },
    method: 'workspace',
  },
  {
    name: 'list_contacts',
    description: 'List contact form submissions with optional status, search, and date filters.',
    parameters: {
      type: 'object',
      properties: {
        page: { type: 'string', description: 'Page number starting at 1' },
        status: { type: 'string', enum: ['', 'pending', 'approved', 'rejected'] },
        q: { type: 'string', description: 'Name, email, or company search' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
    method: 'listContacts',
  },
  {
    name: 'approve_contact',
    description: 'Approve a pending contact and send the visitor thank-you email.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    method: 'approveContact',
  },
  {
    name: 'reject_contact',
    description: 'Reject a pending contact. This does not send mail.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    method: 'rejectContact',
  },
  {
    name: 'list_bookings',
    description: 'List discovery-call bookings. Use this before assigning a meeting.',
    parameters: {
      type: 'object',
      properties: {
        page: { type: 'string' },
        status: { type: 'string', enum: ['', 'pending_payment', 'paid', 'payment_review', 'cancelled', 'completed'] },
        q: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
    },
    method: 'listBookings',
  },
  {
    name: 'assign_booking',
    description: 'Save assignee, HTTPS meeting link, and notes. Pass updatedAt from list_bookings. Only paid bookings can be completed.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        assignedTo: { type: 'string' },
        meetingUrl: { type: 'string' },
        adminNotes: { type: 'string' },
        updatedAt: { type: 'string' },
        completed: { type: 'boolean' },
      },
      required: ['id', 'updatedAt'],
    },
    method: 'assignBooking',
  },
  {
    name: 'get_booking_settings',
    description: 'Read min/max consultation fees and blocked IST dates.',
    parameters: { type: 'object', properties: {} },
    method: 'bookingSettings',
  },
  {
    name: 'save_booking_settings',
    description: 'Update fees or blocked dates. Pass the current version from get_booking_settings.',
    parameters: {
      type: 'object',
      properties: {
        version: { type: 'number' },
        minRupees: { type: 'number' },
        maxRupees: { type: 'number' },
        blockedDates: { type: 'array', items: { type: 'string' } },
      },
      required: ['version'],
    },
    method: 'saveBookingSettings',
  },
  {
    name: 'get_notification_settings',
    description: 'Read the daily digest time and SMTP status.',
    parameters: { type: 'object', properties: {} },
    method: 'notificationSettings',
  },
  {
    name: 'save_notification_settings',
    description: 'Set the IST hour and minute for the daily digest.',
    parameters: {
      type: 'object',
      properties: {
        digestHour: { type: 'number' },
        digestMinute: { type: 'number' },
        version: { type: 'number' },
      },
      required: ['digestHour', 'digestMinute', 'version'],
    },
    method: 'saveNotificationSettings',
  },
  {
    name: 'run_digest',
    description: 'Send the daily owner digest now. Use force to resend after a successful send.',
    parameters: {
      type: 'object',
      properties: { force: { type: 'boolean' } },
    },
    method: 'runDigest',
  },
  {
    name: 'sync_projects',
    description: 'Refresh GitHub/GitLab language and timeline metadata for curated projects.',
    parameters: { type: 'object', properties: {} },
    method: 'syncProjects',
  },
  {
    name: 'list_quotations',
    description: 'List quotation summaries without agreement text or invitation secrets.',
    parameters: {
      type: 'object',
      properties: {
        page: { type: 'string' },
        status: { type: 'string', enum: ['', 'draft', 'invited', 'accepted', 'cancelled'] },
        q: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
    },
    method: 'listQuotations',
  },
  {
    name: 'get_quotation',
    description: 'Open one quotation with milestones, terms, and payment state.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    method: 'getQuotation',
  },
  {
    name: 'create_quotation',
    description: 'Create a ready quotation from title, client, scope, terms, totalPaise, validUntil, and optional builder.',
    parameters: { type: 'object', additionalProperties: true, properties: {} },
    method: 'createQuotation',
  },
  {
    name: 'edit_quotation',
    description: 'Edit a draft quotation. Include version and the same fields as create_quotation.',
    parameters: {
      type: 'object',
      additionalProperties: true,
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    method: 'editQuotation',
  },
  {
    name: 'update_quotation_schedule',
    description: 'Change the four-phase payment plan before money moves.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        version: { type: 'number' },
        paymentSchedule: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              percent: { type: 'number' },
              timing: { type: 'string', enum: ['before', 'after'] },
            },
          },
        },
      },
      required: ['id', 'version', 'paymentSchedule'],
    },
    method: 'updateQuotationSchedule',
  },
  {
    name: 'delete_draft',
    description: 'Delete a draft quotation. Invited or accepted quotations cannot be deleted.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    method: 'deleteDraft',
  },
  {
    name: 'revise_quotation',
    description: 'Create a draft revision of an invited quotation that has not taken payment.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    method: 'reviseQuotation',
  },
  {
    name: 'invite_client',
    description: 'Create a client invitation link. Optionally email it.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        version: { type: 'number' },
        label: { type: 'string' },
        sendEmail: { type: 'boolean' },
      },
      required: ['id', 'version'],
    },
    method: 'inviteClient',
  },
  {
    name: 'revoke_invitations',
    description: 'Revoke every active invitation for a quotation.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    method: 'revokeInvitations',
  },
  {
    name: 'release_milestone',
    description: 'Release a paid phase for client review. Index 1-3. Evidence must describe the delivery.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        index: { type: 'number' },
        evidence: { type: 'string' },
      },
      required: ['id', 'index', 'evidence'],
    },
    method: 'releaseMilestone',
  },
  {
    name: 'arrange_collection',
    description: 'Set a one-off collection amount for a payable milestone. Needs version, amountPaise, and reason.',
    parameters: {
      type: 'object',
      additionalProperties: true,
      properties: {
        id: { type: 'string' },
        index: { type: 'number' },
      },
      required: ['id', 'index'],
    },
    method: 'arrangeCollection',
  },
  {
    name: 'calendar_upcoming',
    description: 'List upcoming Google Calendar events when calendar credentials are configured.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    method: 'calendarUpcoming',
  },
  {
    name: 'sync_booking_calendar',
    description: 'Create or update the Google Calendar event for one booking.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    method: 'syncBookingCalendar',
  },
];

class Grokbot {
  constructor({
    operator,
    env = process.env,
    request = (...args) => fetch(...args),
  }) {
    this.operator = operator;
    this.env = env;
    this.request = request;
  }

  tools() {
    return TOOLS.map(({ name, description, parameters }) => ({
      type: 'function',
      function: { name, description, parameters },
    }));
  }

  catalog() {
    return TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));
  }

  async invoke(name, args = {}) {
    const tool = TOOLS.find((item) => item.name === name);
    if (!tool) throw httpError(400, 'Unknown admin tool.');
    if (args && (typeof args !== 'object' || Array.isArray(args))) {
      throw httpError(400, 'Tool arguments must be an object.');
    }
    return this.operator[tool.method](args || {});
  }

  chatReady() {
    return Boolean(this.env.XAI_API_KEY);
  }

  async chat(message, history = []) {
    if (!this.chatReady()) throw httpError(503, 'Grokbot chat is not configured. Set XAI_API_KEY or call /api/operator/invoke directly.');
    const parsed = z.string().trim().min(1).max(4000).safeParse(message);
    if (!parsed.success) throw httpError(400, 'Send a short admin instruction.');
    const messages = [
      {
        role: 'system',
        content:
          'You are Grokbot, the private admin operator for pratyushes.dev. Use tools to inspect and change contacts, bookings, quotations, digest settings, and Google Calendar. Never invent IDs; list first. Do not expose secrets, IPs, or invitation tokens in prose unless the admin asked to copy a link.',
      },
      ...sanitizeHistory(history),
      { role: 'user', content: parsed.data },
    ];
    const steps = [];
    for (let turn = 0; turn < 8; turn++) {
      const reply = await this.complete(messages);
      const toolCalls = reply.tool_calls || [];
      if (!toolCalls.length) {
        return { reply: String(reply.content || '').trim(), steps };
      }
      messages.push({ role: 'assistant', content: reply.content || '', tool_calls: toolCalls });
      for (const call of toolCalls) {
        const name = call.function?.name;
        let args = {};
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }
        let result;
        try {
          result = await this.invoke(name, args);
        } catch (error) {
          result = { error: error.status ? error.message : 'Tool failed.' };
        }
        steps.push({ name, arguments: args, result });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
    return { reply: 'I reached the tool-call limit. Ask me to continue from the last result.', steps };
  }

  async complete(messages) {
    const response = await this.request('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.env.XAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.env.GROK_MODEL || 'grok-4-fast',
        messages,
        tools: this.tools(),
        tool_choice: 'auto',
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw httpError(502, 'Grok did not complete the admin request.');
    return data.choices?.[0]?.message || { content: '' };
  }
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-8).flatMap((item) => {
    if (!item || (item.role !== 'user' && item.role !== 'assistant')) return [];
    if (typeof item.content !== 'string' || !item.content.trim() || item.content.length > 4000) return [];
    return [{ role: item.role, content: item.content.trim() }];
  });
}

module.exports = { Grokbot, TOOLS };
