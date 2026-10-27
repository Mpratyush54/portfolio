import { Component, OnInit, OnDestroy, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { QuotationAdminComponent } from '../quotation/quotation-admin';

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
  assignedTo?: string; meetingUrl?: string; adminNotes?: string; updatedAt: string;
};

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, QuotationAdminComponent],
  template: `
    @if (!isAuthenticated) {
      @if (restoring) {
        <div class="admin-boot" role="status" aria-live="polite">
          <span class="brand-mark">PM</span>
          <p>Restoring your session…</p>
        </div>
      } @else {
      <div class="login-page">
        <section class="login-brand" aria-label="Admin workspace">
          <a class="login-logo" routerLink="/">
            <span class="login-mark">PM</span>
            <span><strong>Pratyush Mishra</strong><small>Studio operations</small></span>
          </a>
          <div class="login-story">
            <p class="login-kicker">Admin workspace</p>
            <h1>Run the studio<br /><em>without the noise.</em></h1>
            <p class="login-lede">
              Quotations, payments, discovery calls and client messages. Each part has its own
              page, so the work stays calm instead of turning into tab hunting.
            </p>
          </div>
          <ul class="login-points">
            <li><strong>Quotations</strong><span>Draft, invite and collect</span></li>
            <li><strong>Bookings</strong><span>Schedule consultations</span></li>
            <li><strong>Inbox</strong><span>Approve client enquiries</span></li>
          </ul>
        </section>
        <form class="login-card" (ngSubmit)="login()">
          <p class="login-kicker">Private area</p>
          <h2>Sign in to your workspace</h2>
          <p class="login-desc">Your session survives a page refresh. Sign out from the sidebar when you are done.</p>
          @if (restoring) {
            <p class="login-restore" aria-live="polite">Restoring your session…</p>
          } @else {
            <div class="login-stack">
              <label class="login-field">
                <span>Email address</span>
                <input type="email" name="email" [(ngModel)]="email" placeholder="you@example.com"
                  autocomplete="off" required />
              </label>
              <label class="login-field">
                <span>Password</span>
                <input type="password" name="password" [(ngModel)]="password" placeholder="Enter your password"
                  autocomplete="current-password" required />
              </label>
              <label class="remember-row">
                <input type="checkbox" name="remember" [(ngModel)]="remember" />
                <span>Keep me signed in for 30 days on this device</span>
              </label>
              <button class="login-btn" type="submit" [disabled]="loggingIn || !email.trim() || !password">
                {{ loggingIn ? 'Signing in…' : 'Sign in' }}
              </button>
            </div>
          }
          @if (loginError) {
            <p class="login-error" role="alert">{{ loginError }}</p>
          }
          <p class="login-help">Use the admin email and password configured on the server.</p>
        </form>
      </div>
      }
    } @else {
      <div class="admin-shell">
        <aside class="admin-sidebar">
          <a class="admin-brand" routerLink="/admin/overview">
            <span class="brand-mark">PM</span>
            <span><strong>Studio admin</strong><small>pratyushes.dev</small></span>
          </a>
          <nav class="admin-nav" aria-label="Admin sections">
            @for (item of adminTabs; track item.id) {
              <a [routerLink]="['/admin', item.id]" (click)="selectTab(item.id, false)" [class.on]="tab === item.id">
                <span class="nav-copy"><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span>
                @if (item.id === 'contacts' && count('pendingContacts')) {
                  <span class="nav-badge">{{ count('pendingContacts') }}</span>
                }
                @if (item.id === 'bookings' && count('reviewBookings')) {
                  <span class="nav-badge warn">{{ count('reviewBookings') }}</span>
                }
              </a>
            }
          </nav>
          <div class="sidebar-footer">
            <p>Signed in as</p>
            <span class="session-pill" [title]="sessionEmail || email">{{ sessionEmail || email }}</span>
            <button type="button" class="btn ghost small" (click)="signOut()">Sign out</button>
          </div>
        </aside>

        <div class="admin-main">
          <header class="admin-header">
            <div class="header-copy">
              <p class="admin-kicker">Portfolio admin</p>
              <h1>{{ sectionTitle() }}</h1>
              <p class="subtitle">{{ sectionHint() }}</p>
            </div>
            <div class="header-actions">
              <a class="btn ghost" routerLink="/">View site</a>
              <button type="button" class="btn ghost" (click)="refreshStatus()" [disabled]="refreshingStatus">
                {{ refreshingStatus ? 'Refreshing…' : 'Refresh' }}
              </button>
            </div>
          </header>

          @if (tab === 'overview') {
            <section class="overview-grid" aria-label="Admin overview">
              <button type="button" class="overview-card" (click)="showTab('contacts', 'pending')">
                <span class="overview-label">Pending messages</span>
                <strong>{{ count('pendingContacts') }}</strong>
                <small>Contact enquiries waiting for a reply</small>
              </button>
              <button type="button" class="overview-card" (click)="showTab('bookings', 'paid')">
                <span class="overview-label">Paid bookings</span>
                <strong>{{ count('paidBookings') }}</strong>
                <small>Consultations that need scheduling or follow-up</small>
              </button>
              <button type="button" class="overview-card" [class.warn]="count('reviewBookings') > 0" (click)="showTab('bookings', 'payment_review')">
                <span class="overview-label">Payment review</span>
                <strong>{{ count('reviewBookings') }}</strong>
                <small>Captured payments needing manual confirmation</small>
              </button>
              <button type="button" class="overview-card" (click)="showTab('quotations')">
                <span class="overview-label">Open quotations</span>
                <strong>{{ count('draftQuotes') }} / {{ count('invitedQuotes') }}</strong>
                <small>Drafts / invitations currently with clients</small>
              </button>
              <button type="button" class="overview-card" (click)="showTab('quotations')">
                <span class="overview-label">Active projects</span>
                <strong>{{ count('acceptedQuotes') }}</strong>
                <small>Accepted quotations being delivered</small>
              </button>
            </section>

            <section class="overview-shortcuts" aria-label="Workspace shortcuts">
              <div class="section-heading">
                <div><p class="admin-kicker">Workspace</p><h2>Jump back in</h2></div>
                <p>Focused pages keep the day readable. The sidebar always shows where you are.</p>
              </div>
              <div class="shortcut-grid">
                <a routerLink="/admin/quotations"><span>01</span><strong>Quotations</strong><small>Build proposals, invite clients and collect payments.</small></a>
                <a routerLink="/admin/bookings"><span>02</span><strong>Bookings</strong><small>Schedule consultations and keep follow-up notes.</small></a>
                <a routerLink="/admin/contacts"><span>03</span><strong>Inbox</strong><small>Read enquiries and send approvals.</small></a>
                <a routerLink="/admin/settings"><span>04</span><strong>Settings</strong><small>Availability, email digests and repository sync.</small></a>
              </div>
            </section>
          }

          <div class="admin-grid" [hidden]="tab === 'overview'">
          <div class="admin-card span-2" [hidden]="tab !== 'quotations'"><app-quotation-admin [headers]="headers()" [quotationId]="quoteId" [mode]="quoteMode" /></div>
          <div class="admin-card glass-panel span-2" [hidden]="tab !== 'settings'">
            <h2>Email notifications</h2>
            <p>Daily summaries include new contacts and paid bookings since the last summary. No email is sent for an empty period.</p>
            @if (notificationSettings) {
              <p>Sender: {{ notificationSettings.sender }} · Summary recipient: {{ notificationSettings.recipient }}</p>
              <p>{{ notificationSettings.smtpConfigured ? 'Email configured' : 'Email configuration required' }}</p>
              <div class="settings-row"><label>Hour (India time)<input type="number" min="0" max="23" [(ngModel)]="notificationSettings.digestHour" /></label><label>Minute<input type="number" min="0" max="59" [(ngModel)]="notificationSettings.digestMinute" /></label></div>
              <button class="btn" (click)="saveNotifications()" [disabled]="savingNotifications">{{ savingNotifications ? 'Saving…' : 'Save summary time' }}</button>
            }
            <button class="btn ghost small" (click)="loadNotifications()">Reload email settings</button>
            <p aria-live="polite">{{ notificationMessage }}</p>
          </div>
          <div class="admin-card glass-panel span-2" [hidden]="tab !== 'settings'">
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

          <div class="admin-card glass-panel span-2" [hidden]="tab !== 'bookings'">
            <div class="card-head">
              <h2>Discovery bookings</h2>
              <div class="filters">
                <button type="button" [class.on]="bookFilter === 'paid'" (click)="setBookFilter('paid')">Paid</button>
                <button type="button" [class.on]="bookFilter === 'all'" (click)="setBookFilter('all')">All</button>
                <button type="button" [class.on]="bookFilter === 'payment_review'" (click)="setBookFilter('payment_review')">Payment review</button>
                <button type="button" class="ghost" (click)="loadBookings()" [disabled]="loadingBookings">Refresh</button>
              </div>
            </div>
            <form class="list-tools" (ngSubmit)="bookPage = 1; loadBookings()">
              <label class="grow">Search<input name="bookSearch" [(ngModel)]="bookSearch" placeholder="Name, email or reference" maxlength="120" /></label>
              <label>Status<select name="bookStatus" [(ngModel)]="bookFilter"><option value="all">All</option><option value="paid">Paid</option><option value="payment_review">Payment review</option><option value="pending_payment">Awaiting payment</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
              <label>From<input type="date" name="bookFrom" [(ngModel)]="bookFrom" /></label>
              <label>To<input type="date" name="bookTo" [(ngModel)]="bookTo" /></label>
              <div class="toolbar-actions">
                <button class="btn" type="submit" [disabled]="loadingBookings">Apply</button>
                <button class="btn ghost" type="button" (click)="clearBookFilters()">Clear</button>
              </div>
            </form>
            <div class="list-summary">
              <span>{{ bookTotal }} record{{ bookTotal === 1 ? '' : 's' }}</span>
              <span aria-live="polite">Page {{ bookPage }} of {{ bookPages }}</span>
            </div>
            @if (bookPages > 1) {
              <nav class="pager" aria-label="Bookings pagination">
                <button type="button" (click)="goBookPage(1)" [disabled]="bookPage <= 1">First</button>
                <button type="button" (click)="goBookPage(bookPage - 1)" [disabled]="bookPage <= 1">Prev</button>
                @for (p of pageItems(bookPage, bookPages); track $index) {
                  @if (p === '…') { <span class="pager-gap">…</span> }
                  @else { <button type="button" [class.on]="p === bookPage" (click)="goBookPage(p)">{{ p }}</button> }
                }
                <button type="button" (click)="goBookPage(bookPage + 1)" [disabled]="bookPage >= bookPages">Next</button>
                <button type="button" (click)="goBookPage(bookPages)" [disabled]="bookPage >= bookPages">Last</button>
              </nav>
            }
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
                      <span class="status" [attr.data-s]="b.status">{{ statusLabel(b.status) }}</span>
                    </header>
                    <details><summary>Assignment and follow-up</summary>
                      <label>Assigned to<input [(ngModel)]="b.assignedTo" maxlength="120" /></label>
                      <label>Meeting link<input [(ngModel)]="b.meetingUrl" type="url" placeholder="https://…" maxlength="500" /></label>
                      <label>Internal notes<textarea [(ngModel)]="b.adminNotes" maxlength="2000"></textarea></label>
                      <div class="row-actions">
                        <button class="btn small" (click)="saveAssignment(b)" [disabled]="!!busyBooking">Save assignment</button>
                        @if (b.status === 'paid') { <button class="btn ghost small" (click)="saveAssignment(b, true)" [disabled]="!!busyBooking">Mark completed</button> }
                      </div>
                    </details>
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

          <div class="admin-card glass-panel span-2" [hidden]="tab !== 'contacts'">
            <div class="card-head">
              <h2>Contact inbox</h2>
              <div class="filters">
                <button type="button" [class.on]="filter === 'pending'" (click)="setFilter('pending')">Pending</button>
                <button type="button" [class.on]="filter === 'all'" (click)="setFilter('all')">All</button>
                <button type="button" class="ghost" (click)="loadContacts()" [disabled]="loadingContacts">Refresh</button>
              </div>
            </div>

            <form class="list-tools" (ngSubmit)="contactPage = 1; loadContacts()">
              <label class="grow">Search<input name="contactSearch" [(ngModel)]="contactSearch" placeholder="Name, email or reference" maxlength="120" /></label>
              <label>Status<select name="contactStatus" [(ngModel)]="filter"><option value="all">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
              <label>From<input type="date" name="contactFrom" [(ngModel)]="contactFrom" /></label>
              <label>To<input type="date" name="contactTo" [(ngModel)]="contactTo" /></label>
              <div class="toolbar-actions">
                <button class="btn" type="submit" [disabled]="loadingContacts">Apply</button>
                <button class="btn ghost" type="button" (click)="clearContactFilters()">Clear</button>
              </div>
            </form>
            <div class="list-summary">
              <span>{{ contactTotal }} record{{ contactTotal === 1 ? '' : 's' }}</span>
              <span aria-live="polite">Page {{ contactPage }} of {{ contactPages }}</span>
            </div>
            @if (contactPages > 1) {
              <nav class="pager" aria-label="Contact inbox pagination">
                <button type="button" (click)="goContactPage(1)" [disabled]="contactPage <= 1">First</button>
                <button type="button" (click)="goContactPage(contactPage - 1)" [disabled]="contactPage <= 1">Prev</button>
                @for (p of pageItems(contactPage, contactPages); track $index) {
                  @if (p === '…') { <span class="pager-gap">…</span> }
                  @else { <button type="button" [class.on]="p === contactPage" (click)="goContactPage(p)">{{ p }}</button> }
                }
                <button type="button" (click)="goContactPage(contactPage + 1)" [disabled]="contactPage >= contactPages">Next</button>
                <button type="button" (click)="goContactPage(contactPages)" [disabled]="contactPage >= contactPages">Last</button>
              </nav>
            }
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
                      <span class="status" [attr.data-s]="c.status">{{ statusLabel(c.status) }}</span>
                    </header>
                    <p class="msg-body">{{ c.message }}</p>
                    @if (c.status === 'pending') {
                      <div class="msg-actions">
                        <button type="button" class="approve" (click)="approve(c)" [disabled]="busyId !== null">
                          {{ busyId === c._id ? 'Sending…' : 'Approve & email' }}
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

          <div class="admin-card glass-panel" [hidden]="tab !== 'settings'">
            <h2>Project Statistics</h2>
            @if (syncStatus) {
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-value">{{ syncStatus.total }}</span>
                  <span class="stat-label">Total Projects</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value github">{{ syncStatus.sources?.github ?? 0 }}</span>
                  <span class="stat-label">GitHub</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value gitlab">{{ syncStatus.sources?.gitlab ?? 0 }}</span>
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

          <div class="admin-card glass-panel" [hidden]="tab !== 'settings'">
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

          <div class="admin-card glass-panel" [hidden]="tab !== 'settings'">
            <h2>Quick Links</h2>
            <div class="links-list">
              <a routerLink="/contact" class="admin-link">Contact page →</a>
              <a href="https://github.com/Mpratyush54" target="_blank" class="admin-link">GitHub Profile →</a>
            </div>
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

    .admin-container { padding: 28px 20px 80px; max-width: 1200px; margin: 0 auto; color: #e8e8f0; }
    .admin-header { display:grid; grid-template-columns:1fr auto; align-items:center; gap:8px; margin-bottom:24px; }
    .admin-header p { grid-column:1 / -1; margin:4px 0; }
    .admin-header h1 { font-size: 1.8rem; margin:0; }
    .admin-header .subtitle { color: rgba(180,186,200,0.7); font-size: 1rem; }
    .admin-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
    .admin-grid > *, .msg, .msg header > div, .settings-row label { min-width: 0; }
    .admin-card, .msg { overflow-wrap: anywhere; }
    .msg header { flex-wrap: wrap; }
    .msg header > div { flex: 1 1 220px; }
    .status { flex: 0 0 auto; max-width: 100%; box-sizing: border-box; }
    .login-card { box-sizing: border-box; }
    .settings-row input, .blocked-add input { min-width: 0; width: 100%; box-sizing: border-box; color-scheme: dark; }
    .blocked-add input { flex: 1 1 0; }
    .admin-container > .admin-header .ghost, .admin-card > .ghost { border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); color: #e8e8f0; border-radius: 10px; padding: 10px 14px; min-height: 44px; font: inherit; cursor: pointer; }
    .admin-card > .ghost { margin-bottom: 16px; }
    .filters button, .save-btn, .blocked-list button { min-height: 40px; }
    @media (max-width: 480px) { .admin-card, .glass-panel { padding: 18px; } .login-card { padding: 28px 20px; } }
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
    [hidden] { display: none !important; }
    .admin-tabs, .list-tools, .pagination { display:flex; flex-wrap:wrap; gap:12px; align-items:end; margin:16px 0; }
    .admin-tabs button, .pagination button, .list-tools button { padding:10px 16px; border:1px solid #40414d; background:#171821; color:#eee; border-radius:8px; cursor:pointer; }
    .admin-tabs .on { background:#e8e8f0; color:#13141a; }
    .list-tools label, details label { display:grid; gap:6px; flex:1; min-width:140px; margin:10px 0; }
    .list-tools input, .list-tools select, details input, details textarea { width:100%; box-sizing:border-box; padding:10px; background:#161720; color:#eee; border:1px solid #40414d; border-radius:6px; }
    .login-kicker, .admin-kicker { margin: 0 0 6px; font-size: 0.65rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(180,186,200,0.6); }
    .login-help { margin: 16px 0 0; font-size: 0.78rem; color: rgba(180,186,200,0.55); line-height: 1.5; }
    .login-restore { padding: 18px; color: rgba(200,205,220,0.7); font-size: 0.9rem; }
    .remember-row { display: flex; align-items: center; gap: 8px; text-align: left; font-size: 0.78rem; color: rgba(180,186,200,0.75); line-height: 1.4; }
    .remember-row input { width: auto; min-width: 16px; accent-color: #e8e8f0; }
    .header-copy { min-width: 0; }
    .header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .session-pill { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem; color: rgba(200,205,220,0.7); }
    .btn { padding: 10px 16px; border-radius: 10px; border: none; background: #e8e8f0; color: #0a0a10; font: inherit; font-weight: 650; cursor: pointer; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn.ghost { background: transparent; color: #e8e8f0; border: 1px solid rgba(255,255,255,0.15); }
    .btn.small { padding: 8px 12px; font-size: 0.8rem; }
    .btn.small { box-shadow: none; }
    .list-tools.grow { align-items: end; }
    .list-tools .grow { flex: 2 1 260px; }
    .toolbar-actions { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
    .list-summary { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 8px 0 12px; font-size: 0.78rem; color: rgba(180,186,200,0.6); }
    .pager { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 14px; }
    .pager button { min-width: 36px; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: inherit; font: inherit; font-size: 0.8rem; cursor: pointer; }
    .pager button:hover:not(:disabled):not(.on) { background: rgba(255,255,255,0.06); }
    .pager button.on { background: #e8e8f0; color: #0a0a10; border-color: transparent; }
    .pager button:disabled { opacity: 0.35; cursor: not-allowed; }
    .pager-gap { padding: 0 4px; color: rgba(180,186,200,0.5); }
    .row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .overview-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .overview-card { text-align: left; padding: 16px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: inherit; font: inherit; cursor: pointer; display: grid; gap: 4px; }
    .overview-card:hover { background: rgba(255,255,255,0.06); }
    .overview-card.warn { border-color: rgba(250,204,21,0.35); }
    .overview-label { font-size: 0.68rem; letter-spacing: 0.09em; text-transform: uppercase; color: rgba(180,186,200,0.65); }
    .overview-card strong { font-size: 1.5rem; line-height: 1.1; }
    .overview-card small { font-size: 0.72rem; line-height: 1.4; color: rgba(180,186,200,0.55); }
    .admin-tabs button { border-radius: 999px; display: inline-flex; align-items: center; gap: 8px; }
    .tab-badge { min-width: 20px; padding: 1px 6px; border-radius: 999px; background: rgba(255,255,255,0.14); color: inherit; font-size: 0.7rem; text-align: center; }
    .tab-badge.warn { background: rgba(250,204,21,0.2); color: #fde68a; }
    .status[data-s="payment_review"] { color: #fde68a; border-color: rgba(250,204,21,0.35); }
    .status[data-s="pending_payment"] { color: #c4b5fd; border-color: rgba(167,139,250,0.35); }
    .status[data-s="completed"] { color: #86efac; border-color: rgba(34,197,94,0.35); }
    .status[data-s="cancelled"] { color: rgba(180,186,200,0.7); border-color: rgba(255,255,255,0.12); }

    .login-page { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, 420px); gap: clamp(32px, 6vw, 80px); align-items: center; max-width: 1180px; margin: 0 auto; padding: 48px 24px; text-align: left; }
    .admin-boot { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px; color: rgba(200,205,220,0.7); }
    .admin-boot .brand-mark { animation: admin-boot-pulse 1.1s ease-in-out infinite alternate; }
    .admin-boot p { margin: 0; font-size: 0.82rem; letter-spacing: 0.02em; }
    @keyframes admin-boot-pulse { from { opacity: 0.55; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { .admin-boot .brand-mark { animation: none; } }
    .login-brand { display: flex; flex-direction: column; gap: clamp(32px, 6vh, 64px); }
    .login-logo, .admin-brand { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
    .login-mark, .brand-mark { width: 42px; height: 42px; flex: 0 0 42px; display: grid; place-items: center; border-radius: 12px; background: #e8e8f0; color: #0a0a10; font-weight: 800; letter-spacing: -0.02em; font-size: 0.9rem; }
    .login-logo strong, .admin-brand strong { display: block; font-size: 0.9rem; }
    .login-logo small, .admin-brand small { display: block; margin-top: 2px; font-size: 0.72rem; color: rgba(180,186,200,0.55); }
    .login-story h1 { font-size: clamp(2.6rem, 5vw, 4.6rem); line-height: 0.98; letter-spacing: -0.055em; margin: 12px 0 22px; font-weight: 650; }
    .login-story h1 em { font-style: normal; color: rgba(232,232,240,0.42); }
    .login-lede { max-width: 520px; line-height: 1.7; color: rgba(180,186,200,0.72); margin: 0; }
    .login-points { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .login-points li { padding: 14px 0 0; border-top: 1px solid rgba(255,255,255,0.1); display: grid; gap: 4px; }
    .login-points strong { font-size: 0.8rem; }
    .login-points span { font-size: 0.72rem; line-height: 1.4; color: rgba(180,186,200,0.55); }
    .login-card { max-width: none; width: 100%; box-sizing: border-box; padding: clamp(28px, 4vw, 40px); text-align: left; border-radius: 20px; background: rgba(18,18,26,0.92); border: 1px solid rgba(255,255,255,0.09); box-shadow: 0 24px 80px rgba(0,0,0,0.38); }
    .login-card h2 { margin: 6px 0 10px; font-size: clamp(1.45rem, 3vw, 1.8rem); letter-spacing: -0.03em; text-align: left; }
    .login-card .login-desc { text-align: left; margin: 0 0 24px; font-size: 0.86rem; line-height: 1.6; }
    .login-card .login-kicker { text-align: left; }
    .login-card .login-help, .login-card .login-error { text-align: left; }
    .login-stack { display: flex; flex-direction: column; gap: 16px; }
    .login-field { display: flex; flex-direction: column; gap: 8px; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(180,186,200,0.65); }
    .login-field input { width: 100%; box-sizing: border-box; padding: 13px 14px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.12); color: #e8e8f0; font-family: inherit; font-size: 0.95rem; outline: none; text-transform: none; letter-spacing: 0; }
    .login-field input:focus { border-color: rgba(232,232,240,0.55); box-shadow: 0 0 0 3px rgba(232,232,240,0.08); }
    .login-card .remember-row { align-items: flex-start; font-size: 0.78rem; line-height: 1.45; color: rgba(180,186,200,0.7); }
    .login-card .login-btn { width: 100%; margin-top: 4px; min-height: 48px; }
    .login-card .login-help { margin-top: 20px; font-size: 0.75rem; line-height: 1.55; color: rgba(180,186,200,0.45); }

    .admin-shell { display: grid; grid-template-columns: 236px minmax(0, 1fr); gap: 28px; width: 100%; box-sizing: border-box; max-width: 1440px; margin: 0 auto; padding: 22px 22px 80px; align-items: start; }
    .admin-sidebar { position: sticky; top: 22px; min-width: 0; min-height: calc(100vh - 44px); display: flex; flex-direction: column; gap: 22px; padding: 20px 16px; border-radius: 18px; background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.09); }
    .admin-nav { display: flex; flex-direction: column; gap: 4px; }
    .admin-nav a { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 10px; color: rgba(232,232,240,0.72); text-decoration: none; border: 1px solid transparent; }
    .admin-nav a:hover { background: rgba(255,255,255,0.05); color: #e8e8f0; }
    .admin-nav a.on { background: #e8e8f0; color: #0a0a10; }
    .nav-copy { flex: 1; min-width: 0; display: grid; gap: 2px; }
    .nav-copy strong { font-size: 0.84rem; }
    .nav-copy small { font-size: 0.66rem; line-height: 1.35; color: rgba(180,186,200,0.5); }
    .admin-nav a.on .nav-copy small { color: rgba(10,10,16,0.58); }
    .nav-badge { flex: 0 0 auto; min-width: 20px; padding: 2px 6px; border-radius: 999px; background: rgba(255,255,255,0.14); color: inherit; font-size: 0.68rem; text-align: center; }
    .admin-nav a.on .nav-badge { background: rgba(10,10,16,0.1); }
    .nav-badge.warn { background: rgba(250,204,21,0.18); color: #fde68a; }
    .admin-nav a.on .nav-badge.warn { background: rgba(10,10,16,0.08); color: #7c5b00; }
    .sidebar-footer { margin-top: auto; border-top: 1px solid rgba(255,255,255,0.09); padding-top: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
    .sidebar-footer p { margin: 0; font-size: 0.63rem; letter-spacing: 0.11em; text-transform: uppercase; color: rgba(180,186,200,0.5); }
    .sidebar-footer .session-pill { max-width: 100%; }
    .sidebar-footer .btn { width: 100%; }
    .admin-main { min-width: 0; }
    .admin-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-bottom: 24px; padding: 4px 2px 0; }
    .admin-header h1 { font-size: clamp(2rem, 3.5vw, 2.8rem); line-height: 1; letter-spacing: -0.045em; margin: 4px 0 0; }
    .admin-header .subtitle { margin: 8px 0 0; color: rgba(180,186,200,0.68); }
    .admin-header .header-actions { flex: 0 0 auto; }
    .overview-grid { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 22px; }
    .overview-card strong { font-size: 1.8rem; letter-spacing: -0.03em; }
    .overview-shortcuts { margin-top: 6px; padding: 22px; border-radius: 18px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); }
    .section-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-bottom: 16px; }
    .section-heading h2 { margin: 2px 0 0; font-size: 1.2rem; letter-spacing: -0.02em; }
    .section-heading > p { max-width: 420px; margin: 0; font-size: 0.8rem; line-height: 1.5; color: rgba(180,186,200,0.55); }
    .shortcut-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .shortcut-grid a { display: grid; gap: 5px; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); color: inherit; text-decoration: none; }
    .shortcut-grid a:hover { background: rgba(255,255,255,0.055); border-color: rgba(255,255,255,0.14); }
    .shortcut-grid span { font-size: 0.62rem; letter-spacing: 0.1em; color: rgba(180,186,200,0.45); }
    .shortcut-grid strong { font-size: 0.9rem; }
    .shortcut-grid small { font-size: 0.72rem; line-height: 1.45; color: rgba(180,186,200,0.55); }
    .admin-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }

    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 800px) { .admin-grid { grid-template-columns: 1fr; } .span-2 { grid-column: auto; } .settings-row { grid-template-columns: 1fr; } .overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .admin-header { grid-template-columns: 1fr; } .header-actions { justify-content: flex-start; } }
    @media (max-width: 520px) { .overview-grid { grid-template-columns: 1fr; } }
    @media (max-width: 1024px) {
      .login-page { grid-template-columns: 1fr; gap: 32px; }
      .login-story h1 { font-size: clamp(2.4rem, 7vw, 3.6rem); }
      .login-points { display: none; }
      .admin-shell { grid-template-columns: minmax(0, 1fr); gap: 18px; }
      .admin-sidebar { position: static; min-height: 0; }
      .admin-nav { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; overflow: visible; padding-bottom: 2px; }
      .admin-nav a { min-width: 0; }
      .nav-copy small { display: none; }
      .sidebar-footer { flex-direction: row; align-items: center; justify-content: space-between; gap: 12px; }
      .sidebar-footer p { display: none; }
      .sidebar-footer .btn { width: auto; }
      .shortcut-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .login-page { padding: 24px 16px; }
      .login-story h1 { font-size: 2.5rem; }
      .login-card { padding: 24px; }
      .admin-shell { padding: 14px 12px 60px; }
      .admin-sidebar { padding: 14px 12px; }
      .admin-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .admin-nav a { min-width: 0; padding: 9px 10px; }
      .nav-copy small { display: none; }
      .admin-header { flex-direction: column; align-items: flex-start; gap: 14px; }
      .admin-header .header-actions { width: 100%; }
      .section-heading { flex-direction: column; align-items: flex-start; gap: 8px; }
      .shortcut-grid { grid-template-columns: 1fr; }
      .sidebar-footer { flex-wrap: wrap; }
    }
  `]
})
export class AdminComponent implements OnInit, OnDestroy {
  @ViewChild(QuotationAdminComponent) quotationEditor?: QuotationAdminComponent;
  async canLeave() { return this.quotationEditor ? this.quotationEditor.canLeave() : true; }
  private cdr = inject(ChangeDetectorRef, { optional: true });
  private router = inject(Router, { optional: true });
  private route = inject(ActivatedRoute, { optional: true });
  private routeSub?: { unsubscribe(): void };
  async signOut() { if (await this.canLeave()) { this.logout(); this.cdr?.markForCheck(); } }
  private http = inject(HttpClient);
  private apiUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';

  isAuthenticated = false;
  email = '';
  password = '';
  loginError = '';
  loggingIn = false;
  restoring = false;
  remember = false;
  token = '';
  sessionEmail = '';
  refreshingStatus = false;
  private static readonly SESSION_KEY = 'pm_admin_session';

  syncStatus: any = null;
  isSyncing = false;
  syncResult = '';
  syncResultError = false;

  notificationSettings: any = null; savingNotifications = false; notificationMessage = '';
    tab = 'overview';
    quoteId = '';
    quoteMode: 'list' | 'new' | 'detail' | 'edit' = 'list';

  adminTabs = [
    { id: 'overview', label: 'Overview', hint: 'The whole studio at a glance' },
    { id: 'quotations', label: 'Quotations', hint: 'Draft, invite and collect' },
    { id: 'bookings', label: 'Bookings', hint: 'Consultations and schedules' },
    { id: 'contacts', label: 'Inbox', hint: 'Client enquiries' },
    { id: 'settings', label: 'Settings', hint: 'Availability, email and sync' },
  ];
  bookPage = 1; bookPages = 1; bookTotal = 0; bookSearch = ''; bookFrom = ''; bookTo = '';
  contactPage = 1; contactPages = 1; contactTotal = 0; contactSearch = ''; contactFrom = ''; contactTo = '';
  busyBooking = '';
  contacts: ContactRow[] = [];
  filter: 'pending' | 'all' | 'approved' | 'rejected' = 'pending';
  loadingContacts = false;
  busyId: string | null = null;
  inboxError = '';

  bookings: BookingRow[] = [];
  bookFilter: 'paid' | 'all' | 'payment_review' | 'pending_payment' | 'completed' | 'cancelled' = 'paid';
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
  private notificationRequest = 0;

  ngOnInit() {
    this.syncSectionFromUrl();
    this.syncQuotationRoute();
    this.restoreSession();
    this.routeSub = this.route?.paramMap.subscribe(() => {
      this.syncSectionFromUrl();
      this.syncQuotationRoute();
    });
  }
  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.session++;
    this.contactRequest++;
    this.bookingRequest++;
    this.settingsRequest++;
    this.notificationRequest++;
  }

  headers(): HttpHeaders {
    if (this.token) return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
    return new HttpHeaders({
      'x-admin-email': this.email.trim().toLowerCase(),
      'x-admin-password': this.password,
    });
  }

  private storedSession(): { token: string; email: string } | null {
    try {
      const raw = sessionStorage.getItem(AdminComponent.SESSION_KEY) || localStorage.getItem(AdminComponent.SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed.token === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  private saveSession(token: string, email: string, remember: boolean) {
    try {
      const raw = JSON.stringify({ token, email });
      sessionStorage.removeItem(AdminComponent.SESSION_KEY);
      localStorage.removeItem(AdminComponent.SESSION_KEY);
      (remember ? localStorage : sessionStorage).setItem(AdminComponent.SESSION_KEY, raw);
    } catch { /* Storage can be unavailable in hardened browsers. */ }
  }

  private clearSessionStorage() {
    try {
      sessionStorage.removeItem(AdminComponent.SESSION_KEY);
      localStorage.removeItem(AdminComponent.SESSION_KEY);
    } catch { /* No-op. */ }
  }

  private syncSectionFromUrl() {
    const section = this.route?.snapshot.paramMap.get('section')
      || (typeof location !== 'undefined' ? location.pathname.split('/').filter(Boolean)[1] : '')
      || 'overview';
    if (this.adminTabs.some((item) => item.id === section)) {
      this.tab = section;
      return;
    }
    this.tab = 'overview';
    if (this.router && typeof location !== 'undefined' && location.pathname.startsWith('/admin'))
      void this.router.navigate(['/admin', 'overview'], { replaceUrl: true });
  }

  private syncQuotationRoute() {
    const snapshot = this.route?.snapshot;
    const routePath = snapshot?.routeConfig?.path || '';
    const id = snapshot?.paramMap.get('quotationId') || '';
    if (id) {
      this.quoteId = id;
      this.quoteMode = routePath.endsWith('/edit') ? 'edit' : 'detail';
      return;
    }
    if (routePath === 'admin/quotations/new') {
      this.quoteId = '';
      this.quoteMode = 'new';
      return;
    }
    if (snapshot && routePath.startsWith('admin')) {
      this.quoteId = '';
      this.quoteMode = 'list';
      return;
    }
    const url = this.router?.url
      || (typeof location !== 'undefined' ? location.pathname : '');
    const parts = url.split(/[?#]/)[0].split('/').filter(Boolean);
    if (parts[0] !== 'admin' || parts[1] !== 'quotations' || !parts[2]) {
      this.quoteId = '';
      this.quoteMode = 'list';
      return;
    }
    if (parts[2] === 'new') {
      this.quoteId = '';
      this.quoteMode = 'new';
      return;
    }
    this.quoteId = parts[2];
    this.quoteMode = parts[3] === 'edit' ? 'edit' : 'detail';
  }

  sectionTitle() {
    return this.adminTabs.find((item) => item.id === this.tab)?.label || 'Overview';
  }

  sectionHint() {
    return this.adminTabs.find((item) => item.id === this.tab)?.hint || '';
  }

  private clearLoginState() {
    this.token = '';
    this.sessionEmail = '';
    this.password = '';
    this.clearSessionStorage();
  }

  private loadSession(session: number) {
    this.http.get(`${this.apiUrl}/admin/status`, { headers: this.headers() }).subscribe({
      next: (s) => {
        if (session !== this.session) return;
        this.loggingIn = false;
        this.restoring = false;
        this.isAuthenticated = true;
        this.syncStatus = s;
        this.syncSectionFromUrl();
        this.syncQuotationRoute();
        this.loadContacts();
        this.loadBookings();
        this.loadBookingSettings();
        this.loadNotifications();
      },
      error: (e) => {
        if (session !== this.session) return;
        this.loggingIn = false;
        this.restoring = false;
        this.clearLoginState();
        this.loginError = e.status === 401 ? 'Your session expired. Sign in again.' : (e.error?.error || 'Could not restore the session. Sign in again.');
      },
    });
  }

  private restoreSession() {
    const stored = this.storedSession();
    if (!stored) return;
    this.token = stored.token;
    this.sessionEmail = stored.email || '';
    this.restoring = true;
    const session = ++this.session;
    this.loadSession(session);
  }

  selectTab(id: string, navigate = true) {
    if (!this.adminTabs.some((item) => item.id === id)) return;
    this.tab = id;
    if (navigate && this.router && this.route?.snapshot.paramMap.get('section') !== id)
      void this.router.navigate(['/admin', id]);
  }

  showTab(id: string, filter?: string) {
    this.selectTab(id);
    if (id === 'contacts') {
      if (filter === 'pending' || filter === 'all' || filter === 'approved' || filter === 'rejected') this.filter = filter;
      this.contactPage = 1;
      this.loadContacts();
    }
    if (id === 'bookings') {
      if (filter === 'paid' || filter === 'all' || filter === 'payment_review' || filter === 'pending_payment' || filter === 'completed' || filter === 'cancelled') this.bookFilter = filter;
      this.bookPage = 1;
      this.loadBookings();
    }
  }

  count(key: string): number {
    return Number(this.syncStatus?.counts?.[key] || 0);
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  pageItems(current: number, total: number): (number | string)[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const items: (number | string)[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) items.push('…');
    for (let page = start; page <= end; page++) items.push(page);
    if (end < total - 1) items.push('…');
    items.push(total);
    return items;
  }

  goBookPage(page: number | string) {
    const target = Number(page);
    if (!Number.isInteger(target) || target < 1 || target > this.bookPages) return;
    this.bookPage = target;
    this.loadBookings();
  }

  goContactPage(page: number | string) {
    const target = Number(page);
    if (!Number.isInteger(target) || target < 1 || target > this.contactPages) return;
    this.contactPage = target;
    this.loadContacts();
  }

  clearBookFilters() {
    this.bookSearch = '';
    this.bookFrom = '';
    this.bookTo = '';
    this.bookFilter = 'all';
    this.bookPage = 1;
    this.loadBookings();
  }

  clearContactFilters() {
    this.contactSearch = '';
    this.contactFrom = '';
    this.contactTo = '';
    this.filter = 'pending';
    this.contactPage = 1;
    this.loadContacts();
  }

  refreshStatus() {
    if (!this.isAuthenticated || this.refreshingStatus) return;
    this.refreshingStatus = true;
    const session = this.session;
    this.http.get(`${this.apiUrl}/admin/status`, { headers: this.headers() }).subscribe({
      next: (s) => {
        if (session !== this.session || !this.isAuthenticated) return;
        this.syncStatus = s;
        this.refreshingStatus = false;
      },
      error: () => {
        if (session === this.session) this.refreshingStatus = false;
      },
    });
  }

  intentLabel(intent: string): string {
    if (intent === 'hire') return 'Hire me';
    if (intent === 'freelance') return 'Freelance project';
    if (intent === 'hi') return 'Just say hi';
    return intent;
  }

  login() {
    if (this.loggingIn || this.restoring || !this.email.trim() || !this.password) return;
    this.loginError = '';
    this.loggingIn = true;
    const session = ++this.session;
    this.http.post<{ token: string; email: string; expiresAt: string }>(
      `${this.apiUrl}/admin/session`,
      { email: this.email.trim().toLowerCase(), password: this.password, remember: this.remember },
    ).subscribe({
      next: (result) => {
        if (session !== this.session) return;
        this.token = result.token;
        this.sessionEmail = result.email || this.email;
        this.email = result.email || this.email;
        this.password = '';
        this.saveSession(result.token, this.sessionEmail, this.remember);
        this.loadSession(session);
      },
      error: (e) => {
        if (session !== this.session) return;
        this.loggingIn = false;
        this.loginError = e.error?.error || 'Could not sign in. Please try again.';
      },
    });
  }

  logout() {
    this.session++;
    this.contactRequest++;
    this.bookingRequest++;
    this.settingsRequest++;
    this.notificationRequest++;
    this.isAuthenticated = false;
    this.clearLoginState();
    this.email = '';
    this.contacts = [];
    this.bookings = [];
    this.busyBooking = '';
    this.notificationSettings = null;
    this.savingNotifications = false;
    this.notificationMessage = '';
    this.settingsLoaded = false;
    this.busyId = null;
    this.syncStatus = null;
    this.syncResult = '';
    this.loggingIn = false;
    this.restoring = false;
    this.refreshingStatus = false;
    this.savingSettings = false;
    this.isSyncing = false;
    this.loadingContacts = false;
    this.loadingBookings = false;
    this.blockedDates = [];
    this.settingsError = '';
    this.settingsMsg = '';
    this.loginError = '';
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
    this.filter = f; this.contactPage = 1;
    this.loadContacts();
  }

  setBookFilter(f: 'paid' | 'all' | 'payment_review') {
    this.bookFilter = f; this.bookPage = 1;
    this.loadBookings();
  }

  loadBookings() {
    if (!this.isAuthenticated) return;
    const request = ++this.bookingRequest;
    this.loadingBookings = true;
    this.bookingsError = '';
    const q = '?' + new URLSearchParams({ page: String(this.bookPage), pageSize:'25', status:this.bookFilter, q:this.bookSearch, from:this.bookFrom, to:this.bookTo });
    this.http.get<any>(`${this.apiUrl}/admin/bookings${q}`, { headers: this.headers() }).subscribe({
      next: (rows) => {
        if (request !== this.bookingRequest || !this.isAuthenticated) return;
        this.bookings = rows.rows || rows || []; this.bookTotal = rows.total ?? this.bookings.length; this.bookPages = rows.pages || 1; this.bookPage = rows.page || 1;
        this.loadingBookings = false;
      },
      error: (e) => {
        if (request !== this.bookingRequest || !this.isAuthenticated) return;
        this.loadingBookings = false;
        this.bookingsError = e.error?.error || 'Failed to load bookings';
      }
    });
  }

  saveAssignment(b: BookingRow, completed = false) {
    if (this.busyBooking) return;
    this.busyBooking = b._id;
    const session = this.session;
    this.http.put(`${this.apiUrl}/admin/bookings/${b._id}`, {assignedTo:b.assignedTo || '', meetingUrl:b.meetingUrl || '', adminNotes:b.adminNotes || '', updatedAt:b.updatedAt, completed}, {headers:this.headers()}).subscribe({
      next: () => { if (session !== this.session) return; this.busyBooking = ''; this.loadBookings(); this.refreshStatus(); },
      error: e => { if (session !== this.session) return; this.busyBooking = ''; this.bookingsError = e.error?.error || 'Could not save assignment.'; }
    });
  }
  loadNotifications() {
    const session = this.session;
    const request = ++this.notificationRequest;
    this.http.get(`${this.apiUrl}/admin/notification-settings`, {headers:this.headers()}).subscribe({next: row => { if (request === this.notificationRequest && session === this.session && this.isAuthenticated) this.notificationSettings = row; }, error: () => { if (request === this.notificationRequest && session === this.session && this.isAuthenticated) this.notificationMessage = 'Could not load email settings.'; }});
  }
  saveNotifications() {
    if (this.savingNotifications || !this.notificationSettings) return;
    this.savingNotifications = true;
    ++this.notificationRequest;
    const session = this.session;
    this.http.put(`${this.apiUrl}/admin/notification-settings`, this.notificationSettings, {headers:this.headers()}).subscribe({next: row => { if (session !== this.session) return; this.notificationSettings = row; this.savingNotifications = false; this.notificationMessage = 'Daily summary time saved.'; }, error: e => { if (session !== this.session) return; this.savingNotifications = false; this.notificationMessage = e.error?.error || 'Could not save email settings.'; }});
  }
  loadContacts() {
    if (!this.isAuthenticated) return;
    const request = ++this.contactRequest;
    this.loadingContacts = true;
    this.inboxError = '';
    const q = '?' + new URLSearchParams({ page: String(this.contactPage), pageSize:'25', status:this.filter, q:this.contactSearch, from:this.contactFrom, to:this.contactTo });
    this.http.get<any>(`${this.apiUrl}/admin/contacts${q}`, { headers: this.headers() }).subscribe({
      next: (rows) => {
        if (request !== this.contactRequest || !this.isAuthenticated) return;
        this.contacts = rows.rows || rows || []; this.contactTotal = rows.total ?? this.contacts.length; this.contactPages = rows.pages || 1; this.contactPage = rows.page || 1;
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
        this.refreshStatus();
      },
      error: (e) => {
        if (session !== this.session || !this.isAuthenticated) return;
        this.busyId = null;
        this.inboxError = e.error?.error || 'Approve failed (check SMTP config)';
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
        this.refreshStatus();
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
