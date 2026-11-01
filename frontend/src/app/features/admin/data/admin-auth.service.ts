import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBase } from '../../../core/api/api-base';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private http = inject(HttpClient);
  private static readonly SESSION_KEY = 'pm_admin_session';

  token = '';
  sessionEmail = '';
  email = '';
  password = '';
  isAuthenticated = false;
  session = 0;

  headers(): HttpHeaders {
    if (this.token) return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
    return new HttpHeaders({
      'x-admin-email': this.email.trim().toLowerCase(),
      'x-admin-password': this.password,
    });
  }

  storedSession(): { token: string; email: string } | null {
    try {
      const raw =
        sessionStorage.getItem(AdminAuthService.SESSION_KEY) ||
        localStorage.getItem(AdminAuthService.SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed.token === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  saveSession(token: string, email: string, remember: boolean) {
    try {
      const raw = JSON.stringify({ token, email });
      sessionStorage.removeItem(AdminAuthService.SESSION_KEY);
      localStorage.removeItem(AdminAuthService.SESSION_KEY);
      (remember ? localStorage : sessionStorage).setItem(AdminAuthService.SESSION_KEY, raw);
    } catch {
      /* Storage can be unavailable in hardened browsers. */
    }
  }

  clearSessionStorage() {
    try {
      sessionStorage.removeItem(AdminAuthService.SESSION_KEY);
      localStorage.removeItem(AdminAuthService.SESSION_KEY);
    } catch {
      /* No-op. */
    }
  }

  clearLoginState() {
    this.token = '';
    this.sessionEmail = '';
    this.password = '';
    this.clearSessionStorage();
  }

  login(email: string, password: string, remember: boolean) {
    return this.http.post<{ token: string; email: string; expiresAt: string }>(
      `${apiBase()}/admin/session`,
      { email: email.trim().toLowerCase(), password, remember },
    );
  }

  getStatus(): Observable<any> {
    return this.http.get(`${apiBase()}/admin/status`, { headers: this.headers() });
  }

  sync(): Observable<any> {
    return this.http.post<any>(`${apiBase()}/admin/sync`, {}, { headers: this.headers() });
  }
}
