import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type ContactRow = {
  _id: string;
  intent: 'hire' | 'freelance' | 'hi';
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  emailSentAt?: string;
};

type BookingRow = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  note?: string;
  date: string;
  slot: string;
  amountPaise: number;
  status: 'pending_payment' | 'paid' | 'payment_review' | 'cancelled' | 'completed';
  razorpayPaymentId?: string;
  createdAt: string;
  paidAt?: string;
};

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    @if (!isAuthenticated) {
      <div class="login-container">
        <div class="login-card glass-panel">
          <h2>Admin Access</h2>
          <p class="login-desc">Sign in with your admin email and password.</p>
          <div class="login-stack">
            <input type="email" [(ngModel)]="email" placeholder="Email"
              autocomplete="username" (keyup.enter)="login()" />
            <input type="password" [(ngModel)]="password" placeholder="Password"
              autocomplete="current-password" (keyup.enter)="login()" />
            <button class="login-btn" (click)="login()" [disabled]="loggingIn">{{ loggingIn ? 'Signing in…' : 'Sign in' }}</button>
          </div>
          @if (loginError) {
            <p class="login-error">{{ loginError }}</p>
          }
        </div>
      </div>
    } @else {
      <div class="admin-container container">
        <header class="admin-header">
          <h1>Admin Panel</h1>
          <button type="button" class="ghost" (click)="logout()">Sign out</button>
          <p class="subtitle">Daily digest emails you when there are submissions. Tap Send yes to email the visitor.</p>
        </header>

        <div class="admin-grid">
          <div class="admin-card glass-panel span-2">
            <div class="card-head">
              <h2>Booking settings</h2>
              <button type="button" class="ghost save-btn" (click)="saveBookingSettings()" [disabled]="savingSettings || !settingsLoaded">
                {{ savingSettings ? 'Saving…' : 'Save' }}
              </button>
            </div>
            <p class="card-desc">
              Dynamic price stays between min and max. Blocked dates are closed on the calendar.
            </p>
            <button type="button" class="ghost" (click)="loadBookingSettings()" [disabled]="savingSettings">Reload settings</button>
            <div class="settings-row">
              <label>
                <span>Min fee (₹)</span>
                <input type="number" [(ngModel)]="settingsMinRupees" min="1" max="100000" step="0.01" />
              </label>
              <label>
                <span>Max fee (₹)</span>
                <input type="number" [(ngModel)]="settingsMaxRupees" min="1" max="100000" step="0.01" />
              </label>
            </div>
            <div class="blocked-block">
              <p class="blocked-label">Unavailable dates</p>
              <div class="blocked-add">
                <input type="date" [(ngModel)]="newBlockedDate" />
                <button type="button" class="add-date" (click)="addBlockedDate()">Add</button>
              </div>
              @if (!blockedDates.length) {
                <p class="empty-inline">No blocked dates.</p>
              } @else {
                <ul class="blocked-list">
                  @for (d of blockedDates; track d) {
                    <li>
                      <span>{{ d }}</span>
                      <button type="button" (click)="removeBlockedDate(d)">Remove</button>
                    </li>
                  }
                </ul>
              }
            </div>
            @if (settingsMsg) {
              <p class="settings-ok">{{ settingsMsg }}</p>
            }
            @if (settingsError) {
              <p class="login-error">{{ settingsError }}</p>
            }
          </div>

          <div class="admin-card glass-panel span-2">
            <div class="card-head">
              <h2>Discovery bookings</h2>
              <div class="filters">
                <button type="button" [class.on]="bookFilter === 'paid'" (click)="setBookFilter('paid')">Paid</button>
                <button type="button" [class.on]="bookFilter === 'all'" (click)="setBookFilter('all')">All</button>
                <button type="button" [class.on]="bookFilter === 'payment_review'" (click)="setBookFilter('payment_review')">Payment review</button>
                <button type="button" class="ghost" (click)="loadBookings()" [disabled]="loadingBookings">Refresh</button>
              </div>
            </div>
            @if (loadingBookings) {
              <div class="loading">Loading bookings…</div>
            } @else if (!bookings.length) {
              <div class="empty">No {{ bookFilter === 'paid' ? 'paid ' : '' }}bookings yet.</div>
            } @else {
              <div class="inbox">
                @for (b of bookings; track b._id) {
                  <article class="msg" [class.pending]="b.status === 'paid'">
                    <header>
                      <div>
                        <p class="msg-intent">{{ b.date }} · {{ b.slot }} IST</p>
                        <h3>{{ b.name }} · {{ b.email }}</h3>
                        <p class="msg-meta">
                          ₹{{ (b.amountPaise / 100) | number:'1.0-2' }}
                          · {{ b.createdAt | date: 'medium' }}
                          @if (b.phone) { · {{ b.phone }} }
                          @if (b.razorpayPaymentId) { · {{ b.razorpayPaymentId }} }
                        </p>
                      </div>
                      <span class="status" [attr.data-s]="b.status === 'paid' ? 'approved' : 'pending'">{{ b.status }}</span>
                    </header>
                    @if (b.note) {
                      <p class="msg-body">{{ b.note }}</p>
                    }
                    @if (b.status === 'payment_review') {
                      <p class="login-error">Payment received; this time could not be confirmed. Contact the customer to arrange a refund or another slot.</p>
                    }
                  </article>
                }
              </div>
            }
            @if (bookingsError) {
              <p class="login-error">{{ bookingsError }}</p>
            }
          </div>

          <div class="admin-card glass-panel span-2">
            <div class="card-head">
              <h2>Contact inbox</h2>
              <div class="filters">
                <button type="button" [class.on]="filter === 'pending'" (click)="setFilter('pending')">Pending</button>
                <button type="button" [class.on]="filter === 'all'" (click)="setFilter('all')">All</button>
                <button type="button" class="ghost" (click)="loadContacts()" [disabled]="loadingContacts">Refresh</button>
              </div>
            </div>

            @if (loadingContacts) {
              <div class="loading">Loading inbox…</div>
            } @else if (!contacts.length) {
              <div class="empty">No {{ filter === 'pending' ? 'pending ' : '' }}messages.</div>
            } @else {
              <div class="inbox">
                @for (c of contacts; track c._id) {
                  <article class="msg" [class.pending]="c.status === 'pending'">
                    <header>
                      <div>
                        <p class="msg-intent">{{ intentLabel(c.intent) }}</p>
                        <h3>{{ c.name }} · {{ c.email }}</h3>
                        <p class="msg-meta">
                          {{ c.createdAt | date: 'medium' }}
                          @if (c.company) { · {{ c.company }} }
                          @if (c.phone) { · {{ c.phone }} }
                        </p>
                      </div>
                      <span class="status" [attr.data-s]="c.status">{{ c.status }}</span>
                    </header>
                    <p class="msg-body">{{ c.message }}</p>
                    @if (c.status === 'pending') {
                      <div class="msg-actions">
                        <button type="button" class="approve" (click)="approve(c)" [disabled]="busyId !== null">
                          {{ busyId === c._id ? 'Sending…' : 'Send yes' }}
                        </button>
                        <button type="button" class="reject" (click)="reject(c)" [disabled]="busyId !== null">
                          Reject
                        </button>
                      </div>
                    }
                  </article>
                }
              </div>
            }
            @if (inboxError) {
              <p class="login-error">{{ inboxError }}</p>
            }
          </div>

          <div class="admin-card glass-panel">
            <h2>Project Statistics</h2>
            @if (syncStatus) {
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-value">{{ syncStatus.total }}</span>
                  <span class="stat-label">Total Projects</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value github">{{ syncStatus.sources.github }}</span>
                  <span class="stat-label">GitHub</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value gitlab">{{ syncStatus.sources.gitlab }}</span>
                  <span class="stat-label">GitLab</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ syncStatus.mongoConnected ? 'Yes' : 'No' }}</span>
                  <span class="stat-label">MongoDB</span>
                </div>
              </div>
            } @else {
              <div class="loading">Loading stats...</div>
            }
          </div>

          <div class="admin-card glass-panel">
            <h2>Sync Repositories</h2>
            <p class="card-desc">Fetches live metadata for curated projects.</p>
            <button class="sync-btn" (click)="triggerSync()" [disabled]="isSyncing">
              <span class="sync-icon" [class.spinning]="isSyncing">&#x21BB;</span>
              {{ isSyncing ? 'Syncing...' : 'Sync All Projects' }}
            </button>
            @if (syncResult) {
              <div class="sync-result" [class.error]="syncResultError">{{ syncResult }}</div>
            }
          </div>

          <div class="admin-card glass-panel">
            <h2>Quick Links</h2>
            <div class="links-list">
              <a routerLink="/contact" class="admin-link">Contact page →</a>
              <a href="https://github.com/Mpratyush54" target="_blank" class="admin-link">GitHub Profile →</a>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .login-container { min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 0 20px; }
    .login-card { padding: 40px; max-width: 380px; width: 100%; text-align: center; }
    .login-card h2 { margin: 0 0 8px; font-size: 1.5rem; }
    .login-desc { color: var(--text-secondary, #9aa); font-size: 0.9rem; margin-bottom: 24px; }
    .login-stack { display: flex; flex-direction: column; gap: 10px; }
    .login-stack input { width: 100%; box-sizing: border-box; padding: 12px 16px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.12); color: inherit; font-size: 1rem; outline: none; font-family: inherit; }
    .login-btn { padding: 12px 24px; border-radius: 12px; border: none; background: #e8e8f0; color: #0a0a10; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; }
    .login-error { color: #fca5a5; font-size: 0.85rem; margin-top: 12px; }

    .admin-container { padding: 60px 20px 100px; max-width: 1100px; margin: 0 auto; color: #e8e8f0; }
    .admin-header { text-align: center; margin-bottom: 40px; }
    .admin-header h1 { font-size: 2.2rem; margin-bottom: 8px; }
    .admin-header .subtitle { color: rgba(180,186,200,0.7); font-size: 1rem; }
    .admin-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px; }
    .span-2 { grid-column: 1 / -1; }
    .admin-card, .glass-panel { padding: 24px; border-radius: 16px; background: rgba(18,18,26,0.85); border: 1px solid rgba(255,255,255,0.08); }
    .admin-card h2 { margin: 0 0 16px; font-size: 1.15rem; }
    .card-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
    .card-head h2 { margin: 0; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; }
    .filters button { border: 1px solid rgba(255,255,255,0.12); background: transparent; color: inherit; border-radius: 999px; padding: 6px 12px; font-family: inherit; cursor: pointer; font-size: 0.78rem; }
    .filters button.on { background: #e8e8f0; color: #0a0a10; border-color: transparent; }
    .filters .ghost { opacity: 0.7; }
    .card-desc { color: rgba(180,186,200,0.7); font-size: 0.9rem; line-height: 1.5; margin-bottom: 20px; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .stat-item { text-align: center; padding: 14px; background: rgba(255,255,255,0.03); border-radius: 12px; }
    .stat-value { display: block; font-size: 1.7rem; font-weight: 700; }
    .stat-value.github { color: #7dd3fc; }
    .stat-value.gitlab { color: #fdba74; }
    .stat-label { display: block; font-size: 0.72rem; color: rgba(180,186,200,0.65); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    .sync-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; border-radius: 12px; background: #e8e8f0; color: #0a0a10; border: none; font-size: 0.95rem; font-weight: 600; cursor: pointer; font-family: inherit; width: 100%; justify-content: center; }
    .sync-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sync-icon.spinning { animation: spin 1s linear infinite; }
    .sync-result { margin-top: 16px; padding: 12px 16px; border-radius: 12px; background: rgba(52,211,153,0.1); color: #34d399; font-size: 0.9rem; }
    .sync-result.error { background: rgba(239,68,68,0.1); color: #fca5a5; }
    .links-list { display: flex; flex-direction: column; gap: 12px; }
    .admin-link { padding: 12px 16px; border-radius: 12px; background: rgba(255,255,255,0.03); color: inherit; text-decoration: none; font-weight: 500; }
    .loading, .empty { color: rgba(180,186,200,0.7); text-align: center; padding: 24px; }
    .inbox { display: flex; flex-direction: column; gap: 14px; }
    .msg { padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
    .msg.pending { border-color: rgba(250, 204, 21, 0.25); }
    .msg header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .msg h3 { margin: 2px 0 6px; font-size: 1rem; font-weight: 600; }
    .msg-intent { margin: 0; font-size: 0.65rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(200,205,220,0.6); }
    .msg-meta { margin: 0; font-size: 0.78rem; color: rgba(180,186,200,0.65); }
    .msg-body { margin: 12px 0 0; white-space: pre-wrap; line-height: 1.5; color: rgba(230,234,244,0.92); font-size: 0.92rem; }
    .status { font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12); }
    .status[data-s="pending"] { color: #fde68a; border-color: rgba(250,204,21,0.35); }
    .status[data-s="approved"] { color: #86efac; border-color: rgba(34,197,94,0.35); }
    .status[data-s="rejected"] { color: #fca5a5; border-color: rgba(239,68,68,0.35); }
    .msg-actions { display: flex; gap: 8px; margin-top: 14px; }
    .msg-actions button { border: none; border-radius: 10px; padding: 10px 14px; font-family: inherit; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
    .approve { background: #e8e8f0; color: #0a0a10; }
    .reject { background: transparent; color: #fca5a5; border: 1px solid rgba(239,68,68,0.35) !important; }
    .msg-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
    .save-btn { border: 1px solid rgba(255,255,255,0.12); background: #e8e8f0; color: #0a0a10; border-radius: 999px; padding: 6px 14px; font-family: inherit; cursor: pointer; font-size: 0.78rem; font-weight: 650; }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .settings-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
    .settings-row label, .blocked-block { display: flex; flex-direction: column; gap: 6px; font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(180,186,200,0.65); }
    .settings-row input, .blocked-add input { padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); color: inherit; font-family: inherit; font-size: 1rem; outline: none; }
    .blocked-label { margin: 0 0 8px; font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(180,186,200,0.65); }
    .blocked-add { display: flex; gap: 8px; margin-bottom: 12px; }
    .blocked-add input { flex: 1; }
    .add-date { border: none; border-radius: 12px; padding: 0 16px; background: rgba(255,255,255,0.1); color: inherit; font-family: inherit; font-weight: 650; cursor: pointer; }
    .blocked-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .blocked-list li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); font-size: 0.9rem; text-transform: none; letter-spacing: 0; color: #e8e8f0; }
    .blocked-list button { border: none; background: transparent; color: #fca5a5; cursor: pointer; font-family: inherit; font-size: 0.78rem; font-weight: 650; }
    .empty-inline { margin: 0; color: rgba(180,186,200,0.55); font-size: 0.85rem; text-transform: none; letter-spacing: 0; }
    .settings-ok { color: #86efac; font-size: 0.85rem; margin: 12px 0 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 800px) { .admin-grid { grid-template-columns: 1fr; } .span-2 { grid-column: auto; } .settings-row { grid-template-columns: 1fr; } }
  `]
})
export class AdminComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private apiUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';

  isAuthenticated = false;
  email = 'mpratyush54@gmail.com';
  password = '';
  loginError = '';
  loggingIn = false;

  syncStatus: any = null;
  isSyncing = false;
  syncResult = '';
  syncResultError = false;

  contacts: ContactRow[] = [];
  filter: 'pending' | 'all' = 'pending';
  loadingContacts = false;
  busyId: string | null = null;
  inboxError = '';

  bookings: BookingRow[] = [];
  bookFilter: 'paid' | 'all' | 'payment_review' = 'paid';
  loadingBookings = false;
  bookingsError = '';

  settingsMinRupees = 299;
  settingsMaxRupees = 1499;
  blockedDates: string[] = [];
  newBlockedDate = '';
  savingSettings = false;
  settingsMsg = '';
  settingsError = '';
  settingsLoaded = false;
  private settingsVersion = 0;
  private contactRequest = 0;
  private bookingRequest = 0;
  private session = 0;
  private settingsRequest = 0;

  ngOnInit() {}
  ngOnDestroy() { this.logout(); }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'x-admin-email': this.email.trim().toLowerCase(),
      'x-admin-password': this.password,
    });
  }

  intentLabel(intent: string): string {
    if (intent === 'hire') return 'Hire me';
    if (intent === 'freelance') return 'Freelance project';
    if (intent === 'hi') return 'Just say hi';
    return intent;
  }

  login() {
    if (this.loggingIn || !this.email.trim() || !this.password) return;
    this.loginError = '';
    this.loggingIn = true;
    const session = this.session;
    this.http.get(`${this.apiUrl}/admin/status`, { headers: this.headers() }).subscribe({
      next: (s) => {
        if (session !== this.session) return;
        this.loggingIn = false;
        this.isAuthenticated = true;
        this.syncStatus = s;
        this.loadContacts();
        this.loadBookings();
        this.loadBookingSettings();
      },
      error: (e) => {
        if (session !== this.session) return;
        this.loggingIn = false; this.loginError = e.error?.error || 'Could not sign in. Please try again.';
      }
    });
  }

  logout() {
    this.session++;
    this.contactRequest++;
    this.bookingRequest++;
    this.settingsRequest++;
    this.isAuthenticated = false;
    this.password = '';
    this.contacts = [];
    this.bookings = [];
    this.settingsLoaded = false;
    this.busyId = null;
    this.syncStatus = null;
    this.syncResult = '';
    this.loggingIn = false;
    this.savingSettings = false;
    this.isSyncing = false;
    this.loadingContacts = false;
    this.loadingBookings = false;
    this.blockedDates = [];
    this.settingsError = '';
    this.settingsMsg = '';
  }

  loadBookingSettings() {
    if (!this.isAuthenticated) return;
    const request = ++this.settingsRequest;
    const session = this.session;
    this.settingsLoaded = false;
    this.settingsError = '';
    this.http.get<{ minRupees: number; maxRupees: number; blockedDates: string[]; version: number }>(
      `${this.apiUrl}/admin/booking-settings`,
      { headers: this.headers() }
    ).subscribe({
      next: (s) => {
        if (session !== this.session || request !== this.settingsRequest || !this.isAuthenticated) return;
        this.settingsVersion = s.version;
        this.settingsLoaded = true;
        this.settingsMinRupees = s.minRupees;
        this.settingsMaxRupees = s.maxRupees;
        this.blockedDates = [...(s.blockedDates || [])];
      },
      error: (e) => {
        if (session !== this.session || request !== this.settingsRequest || !this.isAuthenticated) return;
        this.settingsError = e.error?.error || 'Failed to load booking settings';
      }
    });
  }

  addBlockedDate() {
    const d = (this.newBlockedDate || '').trim();
    const parsed = new Date(`${d}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d) {
      this.settingsError = 'Pick a valid date.';
      return;
    }
    if (!this.blockedDates.includes(d)) {
      this.blockedDates = [...this.blockedDates, d].sort();
    }
    this.newBlockedDate = '';
    this.settingsError = '';
  }

  removeBlockedDate(d: string) {
    this.blockedDates = this.blockedDates.filter((x) => x !== d);
  }

  saveBookingSettings() {
    if (this.savingSettings || !this.settingsLoaded) return;
    const session = this.session;
    const min = this.settingsMinRupees;
    const max = this.settingsMaxRupees;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max > 100000 || max < min
      || Math.abs(min * 100 - Math.round(min * 100)) > 0.000001
      || Math.abs(max * 100 - Math.round(max * 100)) > 0.000001) {
      this.settingsError = 'Enter valid fees from ₹1 to ₹100,000, with max at least min.';
      return;
    }
    this.savingSettings = true;
    this.settingsMsg = '';
    this.settingsError = '';
    this.http.put(
      `${this.apiUrl}/admin/booking-settings`,
      {
        version: this.settingsVersion,
        minRupees: Number(this.settingsMinRupees),
        maxRupees: Number(this.settingsMaxRupees),
        blockedDates: this.blockedDates,
      },
      { headers: this.headers() }
    ).subscribe({
      next: (s: any) => {
        if (session !== this.session || !this.isAuthenticated) return;
        this.settingsVersion = s.version;
        this.savingSettings = false;
        this.settingsMinRupees = s.minRupees;
        this.settingsMaxRupees = s.maxRupees;
        this.blockedDates = [...(s.blockedDates || [])];
        this.settingsMsg = 'Booking settings saved.';
      },
      error: (e) => {
        if (session !== this.session || !this.isAuthenticated) return;
        if (e.status === 409) this.settingsLoaded = false;
        this.savingSettings = false;
        this.settingsError = e.error?.error || 'Save failed';
      }
    });
  }

  setFilter(f: 'pending' | 'all') {
    this.filter = f;
    this.loadContacts();
  }

  setBookFilter(f: 'paid' | 'all' | 'payment_review') {
    this.bookFilter = f;
    this.loadBookings();
  }

  loadBookings() {
    if (!this.isAuthenticated) return;
    const request = ++this.bookingRequest;
    this.loadingBookings = true;
    this.bookingsError = '';
    const q = this.bookFilter === 'all' ? '' : `?status=${this.bookFilter}`;
    this.http.get<BookingRow[]>(`${this.apiUrl}/admin/bookings${q}`, { headers: this.headers() }).subscribe({
      next: (rows) => {
        if (request !== this.bookingRequest || !this.isAuthenticated) return;
        this.bookings = rows || [];
        this.loadingBookings = false;
      },
      error: (e) => {
        if (request !== this.bookingRequest || !this.isAuthenticated) return;
        this.loadingBookings = false;
        this.bookingsError = e.error?.error || 'Failed to load bookings';
      }
    });
  }

  loadContacts() {
    if (!this.isAuthenticated) return;
    const request = ++this.contactRequest;
    this.loadingContacts = true;
    this.inboxError = '';
    const q = this.filter === 'pending' ? '?status=pending' : '';
    this.http.get<ContactRow[]>(`${this.apiUrl}/admin/contacts${q}`, { headers: this.headers() }).subscribe({
      next: (rows) => {
        if (request !== this.contactRequest || !this.isAuthenticated) return;
        this.contacts = rows || [];
        this.loadingContacts = false;
      },
      error: (e) => {
        if (request !== this.contactRequest || !this.isAuthenticated) return;
        this.loadingContacts = false;
        this.inboxError = e.error?.error || 'Failed to load inbox';
      }
    });
  }

  approve(c: ContactRow) {
    if (this.busyId || !this.isAuthenticated) return;
    const session = this.session;
    this.busyId = c._id;
    this.inboxError = '';
    this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/admin/contacts/${c._id}/approve`,
      {},
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        if (session !== this.session || !this.isAuthenticated) return;
        this.busyId = null;
        this.loadContacts();
      },
      error: (e) => {
        if (session !== this.session || !this.isAuthenticated) return;
        this.busyId = null;
        this.inboxError = e.error?.error || 'Send yes failed (check SMTP config)';
      }
    });
  }

  reject(c: ContactRow) {
    if (this.busyId || !this.isAuthenticated) return;
    const session = this.session;
    this.busyId = c._id;
    this.http.post(`${this.apiUrl}/admin/contacts/${c._id}/reject`, {}, { headers: this.headers() }).subscribe({
      next: () => {
        if (session !== this.session || !this.isAuthenticated) return;
        this.busyId = null;
        this.loadContacts();
      },
      error: (e) => {
        if (session !== this.session || !this.isAuthenticated) return;
        this.busyId = null;
        this.inboxError = e.error?.error || 'Reject failed';
      }
    });
  }

  triggerSync() {
    if (this.isSyncing || !this.isAuthenticated) return;
    const session = this.session;
    this.isSyncing = true;
    this.syncResult = '';
    this.http.post<any>(`${this.apiUrl}/admin/sync`, {}, { headers: this.headers() }).subscribe({
      next: (r) => {
        if (session !== this.session || !this.isAuthenticated) return;
        this.isSyncing = false;
        this.syncResult = r.message;
        this.syncResultError = false;
        this.http.get(`${this.apiUrl}/admin/status`, { headers: this.headers() }).subscribe({
          next: s => { if (session === this.session && this.isAuthenticated) this.syncStatus = s; },
          error: () => {},
        });
      },
      error: () => {
        if (session !== this.session || !this.isAuthenticated) return;
        this.isSyncing = false;
        this.syncResult = 'Sync failed. Check backend logs.';
        this.syncResultError = true;
      }
    });
  }
}
