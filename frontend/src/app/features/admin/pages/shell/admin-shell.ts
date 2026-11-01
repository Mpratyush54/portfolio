import { Component, OnInit, OnDestroy, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { AdminAuthService } from '../../data/admin-auth.service';
import { AdminWorkspaceService } from '../../data/admin-workspace.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterOutlet],
  templateUrl: './admin-shell.html',
  styleUrl: '../../styles/admin.scss'
})
export class AdminShellComponent implements OnInit, OnDestroy {
  @ViewChild(RouterOutlet) outlet?: RouterOutlet;
  private cdr = inject(ChangeDetectorRef, { optional: true });
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  auth = inject(AdminAuthService);
  workspace = inject(AdminWorkspaceService);
  private routeSub?: { unsubscribe(): void };

  email = '';
  password = '';
  loginError = '';
  loggingIn = false;
  restoring = false;
  remember = false;
  tab = 'overview';

  adminTabs = [
    { id: 'overview', label: 'Overview', hint: 'The whole studio at a glance' },
    { id: 'quotations', label: 'Quotations', hint: 'Draft, invite and collect' },
    { id: 'bookings', label: 'Bookings', hint: 'Consultations and schedules' },
    { id: 'contacts', label: 'Inbox', hint: 'Client enquiries' },
    { id: 'settings', label: 'Settings', hint: 'Availability, email and sync' },
  ];

  async canLeave() {
    const child = this.outlet?.isActivated
      ? (this.outlet.component as { canLeave?: () => Promise<boolean> })
      : null;
    return child?.canLeave ? child.canLeave() : true;
  }

  async signOut() {
    if (await this.canLeave()) {
      this.logout();
      this.cdr?.markForCheck();
    }
  }

  ngOnInit() {
    this.syncTab();
    this.restoreSession();
    this.routeSub = this.router.events.subscribe(() => this.syncTab());
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.workspace.bumpSession();
  }

  private syncTab() {
    const url = this.router.url.split(/[?#]/)[0];
    const part = url.split('/').filter(Boolean)[1] || 'overview';
    this.tab = this.adminTabs.some((t) => t.id === part) ? part : 'overview';
  }

  sectionTitle() {
    return this.adminTabs.find((item) => item.id === this.tab)?.label || 'Overview';
  }

  sectionHint() {
    return this.adminTabs.find((item) => item.id === this.tab)?.hint || '';
  }

  private loadSession(session: number) {
    this.auth.getStatus().subscribe({
      next: (s) => {
        if (session !== this.auth.session) return;
        this.loggingIn = false;
        this.restoring = false;
        this.auth.isAuthenticated = true;
        this.workspace.syncStatus = s;
        this.cdr?.markForCheck();
      },
      error: (e) => {
        if (session !== this.auth.session) return;
        this.loggingIn = false;
        this.restoring = false;
        this.auth.clearLoginState();
        this.auth.isAuthenticated = false;
        this.loginError =
          e.status === 401
            ? 'Your session expired. Sign in again.'
            : e.error?.error || 'Could not restore the session. Sign in again.';
        this.cdr?.markForCheck();
      }
});
  }

  private restoreSession() {
    const stored = this.auth.storedSession();
    if (!stored) return;
    this.auth.token = stored.token;
    this.auth.sessionEmail = stored.email || '';
    this.restoring = true;
    const session = ++this.auth.session;
    this.loadSession(session);
  }

  login() {
    if (this.loggingIn || this.restoring || !this.email.trim() || !this.password) return;
    this.loginError = '';
    this.loggingIn = true;
    const session = ++this.auth.session;
    this.auth.login(this.email, this.password, this.remember).subscribe({
      next: (result) => {
        if (session !== this.auth.session) return;
        this.auth.token = result.token;
        this.auth.sessionEmail = result.email || this.email;
        this.email = result.email || this.email;
        this.password = '';
        this.auth.email = this.email;
        this.auth.saveSession(result.token, this.auth.sessionEmail, this.remember);
        this.loadSession(session);
      },
      error: (e) => {
        if (session !== this.auth.session) return;
        this.loggingIn = false;
        this.loginError = e.error?.error || 'Could not sign in. Please try again.';
      }
});
  }

  logout() {
    this.workspace.bumpSession();
    this.auth.isAuthenticated = false;
    this.auth.clearLoginState();
    this.email = '';
    this.password = '';
    this.workspace.syncStatus = null;
    this.loggingIn = false;
    this.restoring = false;
    this.workspace.refreshingStatus = false;
    this.loginError = '';
  }
}

/** @deprecated Alias for tests / canDeactivate typing */
export { AdminShellComponent as AdminComponent };
