import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminAuthService } from '../../data/admin-auth.service';
import { AdminContactsService, ContactRow } from '../../data/admin-contacts.service';
import { AdminWorkspaceService } from '../../data/admin-workspace.service';

@Component({
  selector: 'app-admin-contacts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-contacts.html',
  styleUrl: '../../styles/admin.scss',
})
export class AdminContactsComponent implements OnInit, OnDestroy {
  private auth = inject(AdminAuthService);
  private contactsApi = inject(AdminContactsService);
  workspace = inject(AdminWorkspaceService);
  private route = inject(ActivatedRoute);
  private alive = true;

  contactPage = 1;
  contactPages = 1;
  contactTotal = 0;
  contactSearch = '';
  contactFrom = '';
  contactTo = '';
  contacts: ContactRow[] = [];
  filter: 'pending' | 'all' | 'approved' | 'rejected' = 'pending';
  loadingContacts = false;
  busyId: string | null = null;
  inboxError = '';

  ngOnInit() {
    const filter = this.route.snapshot.queryParamMap.get('filter');
    if (filter === 'pending' || filter === 'all' || filter === 'approved' || filter === 'rejected')
      this.filter = filter;
    this.loadContacts();
  }

  ngOnDestroy() {
    this.alive = false;
  }

  intentLabel(intent: string): string {
    if (intent === 'hire') return 'Hire me';
    if (intent === 'freelance') return 'Freelance project';
    if (intent === 'hi') return 'Just say hi';
    return intent;
  }

  setFilter(f: 'pending' | 'all') {
    this.filter = f;
    this.contactPage = 1;
    this.loadContacts();
  }

  clearContactFilters() {
    this.contactSearch = '';
    this.contactFrom = '';
    this.contactTo = '';
    this.filter = 'pending';
    this.contactPage = 1;
    this.loadContacts();
  }

  goContactPage(page: number | string) {
    const target = Number(page);
    if (!Number.isInteger(target) || target < 1 || target > this.contactPages) return;
    this.contactPage = target;
    this.loadContacts();
  }

  loadContacts() {
    if (!this.auth.isAuthenticated) return;
    const request = ++this.workspace.contactRequest;
    this.loadingContacts = true;
    this.inboxError = '';
    this.contactsApi
      .list({
        page: this.contactPage,
        status: this.filter,
        q: this.contactSearch,
        from: this.contactFrom,
        to: this.contactTo
})
      .subscribe({
        next: (rows) => {
          if (request !== this.workspace.contactRequest || !this.auth.isAuthenticated || !this.alive)
            return;
          this.contacts = rows.rows || rows || [];
          this.contactTotal = rows.total ?? this.contacts.length;
          this.contactPages = rows.pages || 1;
          this.contactPage = rows.page || 1;
          this.loadingContacts = false;
        },
        error: (e) => {
          if (request !== this.workspace.contactRequest || !this.auth.isAuthenticated || !this.alive)
            return;
          this.loadingContacts = false;
          this.inboxError = e.error?.error || 'Failed to load inbox';
        }
});
  }

  approve(c: ContactRow) {
    if (this.busyId || !this.auth.isAuthenticated) return;
    const session = this.auth.session;
    this.busyId = c._id;
    this.inboxError = '';
    this.contactsApi.approve(c._id).subscribe({
      next: () => {
        if (session !== this.auth.session || !this.auth.isAuthenticated) return;
        this.busyId = null;
        this.loadContacts();
        this.workspace.refreshStatus();
      },
      error: (e) => {
        if (session !== this.auth.session || !this.auth.isAuthenticated) return;
        this.busyId = null;
        this.inboxError = e.error?.error || 'Approve failed (check SMTP config)';
      }
});
  }

  reject(c: ContactRow) {
    if (this.busyId || !this.auth.isAuthenticated) return;
    const session = this.auth.session;
    this.busyId = c._id;
    this.contactsApi.reject(c._id).subscribe({
      next: () => {
        if (session !== this.auth.session || !this.auth.isAuthenticated) return;
        this.busyId = null;
        this.loadContacts();
        this.workspace.refreshStatus();
      },
      error: (e) => {
        if (session !== this.auth.session || !this.auth.isAuthenticated) return;
        this.busyId = null;
        this.inboxError = e.error?.error || 'Reject failed';
      }
});
  }
}
