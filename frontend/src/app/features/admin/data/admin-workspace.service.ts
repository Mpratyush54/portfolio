import { Injectable, inject } from '@angular/core';
import { AdminAuthService } from './admin-auth.service';

/** Shared admin shell state (status counts, session counters). */
@Injectable({ providedIn: 'root' })
export class AdminWorkspaceService {
  private auth = inject(AdminAuthService);
  syncStatus: any = null;
  refreshingStatus = false;
  contactRequest = 0;
  bookingRequest = 0;
  settingsRequest = 0;
  notificationRequest = 0;

  bumpSession() {
    this.auth.session++;
    this.contactRequest++;
    this.bookingRequest++;
    this.settingsRequest++;
    this.notificationRequest++;
  }

  count(key: string): number {
    return Number(this.syncStatus?.counts?.[key] || 0);
  }

  refreshStatus() {
    if (!this.auth.isAuthenticated || this.refreshingStatus) return;
    this.refreshingStatus = true;
    const session = this.auth.session;
    this.auth.getStatus().subscribe({
      next: (s) => {
        if (session !== this.auth.session || !this.auth.isAuthenticated) return;
        this.syncStatus = s;
        this.refreshingStatus = false;
      },
      error: () => {
        if (session === this.auth.session) this.refreshingStatus = false;
      },
    });
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

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
