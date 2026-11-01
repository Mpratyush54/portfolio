import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBase } from '../../../core/api/api-base';
import { AdminAuthService } from './admin-auth.service';

@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);

  getBookingSettings(): Observable<{
    minRupees: number;
    maxRupees: number;
    blockedDates: string[];
    version: number;
  }> {
    return this.http.get<{
      minRupees: number;
      maxRupees: number;
      blockedDates: string[];
      version: number;
    }>(`${apiBase()}/admin/booking-settings`, { headers: this.auth.headers() });
  }

  saveBookingSettings(body: {
    version: number;
    minRupees: number;
    maxRupees: number;
    blockedDates: string[];
  }): Observable<any> {
    return this.http.put(`${apiBase()}/admin/booking-settings`, body, {
      headers: this.auth.headers(),
    });
  }

  getNotifications(): Observable<any> {
    return this.http.get(`${apiBase()}/admin/notification-settings`, {
      headers: this.auth.headers(),
    });
  }

  saveNotifications(body: unknown): Observable<any> {
    return this.http.put(`${apiBase()}/admin/notification-settings`, body, {
      headers: this.auth.headers(),
    });
  }
}
