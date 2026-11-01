# Control the portfolio from the Grok Bot app

The Grok Bot app talks to this site over a public MCP server. You stay in that
app; it lists contacts, assigns bookings, and edits quotations by calling
`https://pratyushes.dev/api/mcp`.

## Connect it

1. Deploy with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set (same as the admin UI).
2. Optional: set `PUBLIC_URL` to `https://pratyushes.dev` if it is not already.
3. In the Grok Bot app, send:

> Add a custom MCP server named portfolio at https://pratyushes.dev/api/mcp using streamable HTTP.

4. Confirm the URL. Sign in with your admin email and password when Grok Bot
   shows the allow page.
5. Ask it to list pending contacts or paid bookings. It should use MCP tools,
   not invent IDs.

Do not paste `GROKBOT_TOKEN` into the Grok Bot chat. That app authenticates with
OAuth. The bot token is only for scripts and Cursor.

## What it can do

The same admin work as `/admin`:

- Contacts: list, approve, reject
- Bookings: list, assign a meeting, fee and blocked dates
- Quotations: list, open, create, edit, invite, revoke, release, collection
- Digest, project sync, workspace counts
- Google Calendar upcoming events and booking sync, when calendar secrets exist

SRS uploads and PDF exports stay in the admin UI.

## Google Calendar

Paid or assigned bookings upsert a 30-minute IST event when these are set:

- `GOOGLE_CALENDAR_ID`
- either `GOOGLE_SERVICE_ACCOUNT_JSON`, or the OAuth refresh-token trio

If they are missing, Grok Bot still manages the site. Calendar tools report
disabled.

## Local scripts

`POST /api/operator/invoke` still accepts admin session headers or
`GROKBOT_TOKEN`. That path is not what the Grok Bot app uses.
