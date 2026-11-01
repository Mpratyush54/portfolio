# Grokbot and Google Calendar

Grokbot is the authenticated admin operator. It can do the same work as the
`/admin` UI: contacts, bookings, quotation drafts, invitations, payment
arrangements, digest settings, project metadata sync, and calendar updates.

## Authentication

Use either:

- the existing admin session or `x-admin-email` / `x-admin-password` headers, or
- `GROKBOT_TOKEN` via `Authorization: Bearer …` or `x-grokbot-token`

Store `GROKBOT_TOKEN` in `portfolio-secrets`. If it is unset, only admin
credentials work.

## HTTP API

- `GET /api/operator/tools` — tool catalog for Grok function calling
- `POST /api/operator/invoke` — `{ "name": "list_contacts", "arguments": { "status": "pending" } }`
- `POST /api/operator/chat` — `{ "message": "Approve the latest hire enquiry" }`

Chat needs `XAI_API_KEY`. Optional `GROK_MODEL` defaults to `grok-4-fast`.
SRS file upload and PDF export stay in the admin UI because they are binary.

## Google Calendar

When a booking is paid or assigned, the backend upserts a 30-minute IST event.

Required:

- `GOOGLE_CALENDAR_ID` — calendar to write, often `primary` after impersonation

Then one of:

1. Service account JSON in `GOOGLE_SERVICE_ACCOUNT_JSON` (raw or base64). Share
   the calendar with that service account, or set `GOOGLE_IMPERSONATE_EMAIL` if
   domain-wide delegation is enabled.
2. OAuth refresh token: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
   `GOOGLE_OAUTH_REFRESH_TOKEN`.

If these are missing, bookings still save and Grokbot still works. Calendar
tools report `enabled: false`.

## Example

```http
POST /api/operator/invoke
x-grokbot-token: …redacted…

{"name":"assign_booking","arguments":{
  "id":"672f…",
  "assignedTo":"Pratyush",
  "meetingUrl":"https://meet.google.com/xxx",
  "adminNotes":"API review",
  "updatedAt":"2026-11-01T06:00:00.000Z",
  "completed":false
}}
```
