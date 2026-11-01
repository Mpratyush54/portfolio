const crypto = require('crypto');
const Booking = require('../booking/Booking');
const { BookingCalendar } = require('../booking/slots');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

class GoogleCalendar {
  constructor({ env = process.env, request = (...args) => fetch(...args) } = {}) {
    this.env = env;
    this.request = request;
    this.token = '';
    this.tokenExpiresAt = 0;
  }

  enabled() {
    return Boolean(this.calendarId() && (this.serviceAccount() || this.refreshReady()));
  }

  calendarId() {
    return String(this.env.GOOGLE_CALENDAR_ID || '').trim();
  }

  serviceAccount() {
    const raw = String(this.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }

  refreshReady() {
    return Boolean(
      this.env.GOOGLE_OAUTH_CLIENT_ID &&
      this.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      this.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    );
  }

  eventTimes(booking) {
    const start = `${booking.date}T${booking.slot}:00+05:30`;
    const [hour, minute] = booking.slot.split(':').map(Number);
    const endMinute = minute + 30;
    const endHour = hour + Math.floor(endMinute / 60);
    const end = `${booking.date}T${String(endHour).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}:00+05:30`;
    return { start, end };
  }

  eventBody(booking) {
    const { start, end } = this.eventTimes(booking);
    const meeting = booking.meetingUrl ? `\nMeeting: ${booking.meetingUrl}` : '';
    const notes = booking.adminNotes ? `\nNotes: ${booking.adminNotes}` : '';
    return {
      summary: `Consultation — ${booking.name || 'Client'}`,
      description: `Technical consultation with ${booking.name || 'the client'} (${booking.email || 'no email'}).${meeting}${notes}`,
      start: { dateTime: start, timeZone: 'Asia/Kolkata' },
      end: { dateTime: end, timeZone: 'Asia/Kolkata' },
      location: booking.meetingUrl || 'India / IST video call',
      status: booking.status === 'cancelled' ? 'cancelled' : 'confirmed',
    };
  }

  async upsert(booking) {
    if (!this.enabled() || !booking?.date || !booking.slot) return { skipped: true, reason: 'disabled' };
    if (!['paid', 'completed', 'payment_review'].includes(booking.status)) {
      return { skipped: true, reason: 'not-confirmed' };
    }
    const token = await this.accessToken();
    const body = this.eventBody(booking);
    const existingId = booking.calendarEventId;
    const path = existingId
      ? `/calendars/${encodeURIComponent(this.calendarId())}/events/${encodeURIComponent(existingId)}`
      : `/calendars/${encodeURIComponent(this.calendarId())}/events`;
    const event = await this.api(existingId ? 'PATCH' : 'POST', path, token, body);
    if (event?.id && event.id !== existingId && booking._id) {
      await Booking.updateOne({ _id: booking._id }, { $set: { calendarEventId: event.id } });
    }
    return {
      synced: true,
      eventId: event.id,
      htmlLink: event.htmlLink || '',
      start: body.start.dateTime,
    };
  }

  async upcoming(limit = 10) {
    if (!this.enabled()) return { enabled: false, events: [] };
    const token = await this.accessToken();
    const query = new URLSearchParams({
      timeMin: new Date().toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(Math.min(25, Math.max(1, Number(limit) || 10))),
    });
    const data = await this.api(
      'GET',
      `/calendars/${encodeURIComponent(this.calendarId())}/events?${query}`,
      token,
    );
    return {
      enabled: true,
      events: (data.items || []).map((event) => ({
        id: event.id,
        title: event.summary || '',
        start: event.start?.dateTime || event.start?.date || '',
        end: event.end?.dateTime || event.end?.date || '',
        htmlLink: event.htmlLink || '',
        location: event.location || '',
      })),
    };
  }

  async accessToken() {
    if (this.token && this.tokenExpiresAt > Date.now() + 30_000) return this.token;
    const granted = this.serviceAccount()
      ? await this.tokenFromServiceAccount()
      : await this.tokenFromRefresh();
    this.token = granted.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(30, Number(granted.expires_in || 3600) - 60) * 1000;
    return this.token;
  }

  signJwt(claims, privateKey) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    return `${header}.${payload}.${signer.sign(privateKey, 'base64url')}`;
  }

  async tokenFromServiceAccount() {
    const account = this.serviceAccount();
    if (!account?.client_email || !account.private_key) throw new Error('Google service account is incomplete.');
    const now = Math.floor(Date.now() / 1000);
    const assertion = this.signJwt(
      {
        iss: account.client_email,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
        ...(this.env.GOOGLE_IMPERSONATE_EMAIL ? { sub: this.env.GOOGLE_IMPERSONATE_EMAIL } : {}),
      },
      account.private_key,
    );
    return this.form(TOKEN_URL, {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });
  }

  async tokenFromRefresh() {
    return this.form(TOKEN_URL, {
      grant_type: 'refresh_token',
      client_id: this.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: this.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: this.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    });
  }

  async form(url, fields) {
    const response = await this.request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error('Google did not issue a calendar token.');
    return data;
  }

  async api(method, path, token, body) {
    const response = await this.request(`${CALENDAR_API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error('Google Calendar request failed.');
    return data;
  }
}

function slotLabel(slot) {
  return BookingCalendar.formatSlotLabel(slot);
}

module.exports = { GoogleCalendar, slotLabel };
