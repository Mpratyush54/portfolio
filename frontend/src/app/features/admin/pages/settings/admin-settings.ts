import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminAuthService } from '../../data/admin-auth.service';
import { AdminSettingsService } from '../../data/admin-settings.service';
import { AdminWorkspaceService } from '../../data/admin-workspace.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-settings.html'
})
export class AdminSettingsComponent implements OnInit, OnDestroy {
  private auth = inject(AdminAuthService);
  private settingsApi = inject(AdminSettingsService);
  workspace = inject(AdminWorkspaceService);
  private alive = true;

  notificationSettings: any = null;
  savingNotifications = false;
  notificationMessage = '';
  settingsMinRupees = 299;
  settingsMaxRupees = 1499;
  blockedDates: string[] = [];
  newBlockedDate = '';
  savingSettings = false;
  settingsMsg = '';
  settingsError = '';
  settingsLoaded = false;
  private settingsVersion = 0;
  isSyncing = false;
  syncResult = '';
  syncResultError = false;

  ngOnInit() {
    this.loadBookingSettings();
    this.loadNotifications();
  }

  ngOnDestroy() {
    this.alive = false;
  }

  loadBookingSettings() {
    if (!this.auth.isAuthenticated) return;
    const request = ++this.workspace.settingsRequest;
    const session = this.auth.session;
    this.settingsLoaded = false;
    this.settingsError = '';
    this.settingsApi.getBookingSettings().subscribe({
      next: (s) => {
        if (session !== this.auth.session || request !== this.workspace.settingsRequest || !this.auth.isAuthenticated || !this.alive)
          return;
        this.settingsVersion = s.version;
        this.settingsLoaded = true;
        this.settingsMinRupees = s.minRupees;
        this.settingsMaxRupees = s.maxRupees;
        this.blockedDates = [...(s.blockedDates || [])];
      },
      error: (e) => {
        if (session !== this.auth.session || request !== this.workspace.settingsRequest || !this.auth.isAuthenticated || !this.alive)
          return;
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
    if (!this.blockedDates.includes(d)) this.blockedDates = [...this.blockedDates, d].sort();
    this.newBlockedDate = '';
    this.settingsError = '';
  }

  removeBlockedDate(d: string) {
    this.blockedDates = this.blockedDates.filter((x) => x !== d);
  }

  saveBookingSettings() {
    if (this.savingSettings || !this.settingsLoaded) return;
    const session = this.auth.session;
    const min = this.settingsMinRupees;
    const max = this.settingsMaxRupees;
    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min < 1 ||
      max > 100000 ||
      max < min ||
      Math.abs(min * 100 - Math.round(min * 100)) > 0.000001 ||
      Math.abs(max * 100 - Math.round(max * 100)) > 0.000001
    ) {
      this.settingsError = 'Enter valid fees from ₹1 to ₹100,000, with max at least min.';
      return;
    }
    this.savingSettings = true;
    this.settingsMsg = '';
    this.settingsError = '';
    this.settingsApi
      .saveBookingSettings({
        version: this.settingsVersion,
        minRupees: Number(this.settingsMinRupees),
        maxRupees: Number(this.settingsMaxRupees),
        blockedDates: this.blockedDates
})
      .subscribe({
        next: (s: any) => {
          if (session !== this.auth.session || !this.auth.isAuthenticated || !this.alive) return;
          this.settingsVersion = s.version;
          this.savingSettings = false;
          this.settingsMinRupees = s.minRupees;
          this.settingsMaxRupees = s.maxRupees;
          this.blockedDates = [...(s.blockedDates || [])];
          this.settingsMsg = 'Booking settings saved.';
        },
        error: (e) => {
          if (session !== this.auth.session || !this.auth.isAuthenticated || !this.alive) return;
          if (e.status === 409) this.settingsLoaded = false;
          this.savingSettings = false;
          this.settingsError = e.error?.error || 'Save failed';
        }
});
  }

  loadNotifications() {
    const session = this.auth.session;
    const request = ++this.workspace.notificationRequest;
    this.settingsApi.getNotifications().subscribe({
      next: (row) => {
        if (request === this.workspace.notificationRequest && session === this.auth.session && this.auth.isAuthenticated && this.alive)
          this.notificationSettings = row;
      },
      error: () => {
        if (request === this.workspace.notificationRequest && session === this.auth.session && this.auth.isAuthenticated && this.alive)
          this.notificationMessage = 'Could not load email settings.';
      }
});
  }

  saveNotifications() {
    if (this.savingNotifications || !this.notificationSettings) return;
    this.savingNotifications = true;
    ++this.workspace.notificationRequest;
    const session = this.auth.session;
    this.settingsApi.saveNotifications(this.notificationSettings).subscribe({
      next: (row) => {
        if (session !== this.auth.session || !this.alive) return;
        this.notificationSettings = row;
        this.savingNotifications = false;
        this.notificationMessage = 'Daily summary time saved.';
      },
      error: (e) => {
        if (session !== this.auth.session || !this.alive) return;
        this.savingNotifications = false;
        this.notificationMessage = e.error?.error || 'Could not save email settings.';
      }
});
  }

  triggerSync() {
    if (this.isSyncing || !this.auth.isAuthenticated) return;
    const session = this.auth.session;
    this.isSyncing = true;
    this.syncResult = '';
    this.auth.sync().subscribe({
      next: (r) => {
        if (session !== this.auth.session || !this.auth.isAuthenticated || !this.alive) return;
        this.isSyncing = false;
        this.syncResult = r.message;
        this.syncResultError = false;
        this.auth.getStatus().subscribe({
          next: (s) => {
            if (session === this.auth.session && this.auth.isAuthenticated) this.workspace.syncStatus = s;
          },
          error: () => {}
});
      },
      error: () => {
        if (session !== this.auth.session || !this.auth.isAuthenticated || !this.alive) return;
        this.isSyncing = false;
        this.syncResult = 'Sync failed. Check backend logs.';
        this.syncResultError = true;
      }
});
  }
}
