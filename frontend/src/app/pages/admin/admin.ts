import { Component, OnInit, inject } from '@angular/core';
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

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    @if (!isAuthenticated) {
      <div class="login-container">
        <div class="login-card glass-panel">
          <h2>Admin Access</h2>
          <p class="login-desc">Enter the admin password to manage inbox &amp; sync.</p>
          <div class="input-group">
            <input type="password" [(ngModel)]="password" placeholder="Password"
              (keyup.enter)="login()" />
            <button class="login-btn" (click)="login()">Unlock</button>
          </div>
          @if (loginError) {
            <p class="login-error">Incorrect password</p>
          }
        </div>
      </div>
    } @else {
      <div class="admin-container container">
        <header class="admin-header">
          <h1>Admin Panel</h1>
          <p class="subtitle">Approve contact notes before any email goes out</p>
        </header>

        <div class="admin-grid">
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
                        <button type="button" class="approve" (click)="approve(c)" [disabled]="busyId === c._id">
                          {{ busyId === c._id ? 'Sending…' : 'Approve & email' }}
                        </button>
                        <button type="button" class="reject" (click)="reject(c)" [disabled]="busyId === c._id">
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
    .input-group { display: flex; gap: 8px; }
    .input-group input { flex: 1; padding: 12px 16px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.12); color: inherit; font-size: 1rem; outline: none; font-family: inherit; }
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
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 800px) { .admin-grid { grid-template-columns: 1fr; } .span-2 { grid-column: auto; } }
  `]
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  private apiUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';

  isAuthenticated = false;
  password = '';
  loginError = false;

  syncStatus: any = null;
  isSyncing = false;
  syncResult = '';
  syncResultError = false;

  contacts: ContactRow[] = [];
  filter: 'pending' | 'all' = 'pending';
  loadingContacts = false;
  busyId: string | null = null;
  inboxError = '';

  ngOnInit() {}

  private headers(): HttpHeaders {
    return new HttpHeaders({ 'x-admin-password': this.password });
  }

  intentLabel(intent: string): string {
    if (intent === 'hire') return 'Hire me';
    if (intent === 'freelance') return 'Freelance project';
    if (intent === 'hi') return 'Just say hi';
    return intent;
  }

  login() {
    this.loginError = false;
    this.http.get(`${this.apiUrl}/admin/status`, { headers: this.headers() }).subscribe({
      next: (s) => {
        this.isAuthenticated = true;
        this.syncStatus = s;
        this.loadContacts();
      },
      error: () => { this.loginError = true; }
    });
  }

  setFilter(f: 'pending' | 'all') {
    this.filter = f;
    this.loadContacts();
  }

  loadContacts() {
    this.loadingContacts = true;
    this.inboxError = '';
    const q = this.filter === 'pending' ? '?status=pending' : '';
    this.http.get<ContactRow[]>(`${this.apiUrl}/admin/contacts${q}`, { headers: this.headers() }).subscribe({
      next: (rows) => {
        this.contacts = rows || [];
        this.loadingContacts = false;
      },
      error: (e) => {
        this.loadingContacts = false;
        this.inboxError = e.error?.error || 'Failed to load inbox';
      }
    });
  }

  approve(c: ContactRow) {
    this.busyId = c._id;
    this.inboxError = '';
    this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/admin/contacts/${c._id}/approve`,
      {},
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        this.busyId = null;
        this.loadContacts();
      },
      error: (e) => {
        this.busyId = null;
        this.inboxError = e.error?.error || 'Approve failed (check SMTP config)';
      }
    });
  }

  reject(c: ContactRow) {
    this.busyId = c._id;
    this.http.post(`${this.apiUrl}/admin/contacts/${c._id}/reject`, {}, { headers: this.headers() }).subscribe({
      next: () => {
        this.busyId = null;
        this.loadContacts();
      },
      error: (e) => {
        this.busyId = null;
        this.inboxError = e.error?.error || 'Reject failed';
      }
    });
  }

  triggerSync() {
    this.isSyncing = true;
    this.syncResult = '';
    this.http.post<any>(`${this.apiUrl}/admin/sync`, {}, { headers: this.headers() }).subscribe({
      next: (r) => {
        this.isSyncing = false;
        this.syncResult = r.message;
        this.syncResultError = false;
        this.http.get(`${this.apiUrl}/admin/status`, { headers: this.headers() }).subscribe(s => this.syncStatus = s);
      },
      error: () => {
        this.isSyncing = false;
        this.syncResult = 'Sync failed. Check backend logs.';
        this.syncResultError = true;
      }
    });
  }
}
