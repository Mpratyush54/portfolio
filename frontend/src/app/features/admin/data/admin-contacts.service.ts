import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBase } from '../../../core/api/api-base';
import { AdminAuthService } from './admin-auth.service';

export type ContactRow = {
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

@Injectable({ providedIn: 'root' })
export class AdminContactsService {
  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);

  list(params: {
    page: number;
    status: string;
    q: string;
    from: string;
    to: string;
  }): Observable<any> {
    const q =
      '?' +
      new URLSearchParams({
        page: String(params.page),
        pageSize: '25',
        status: params.status,
        q: params.q,
        from: params.from,
        to: params.to,
      });
    return this.http.get<any>(`${apiBase()}/admin/contacts${q}`, {
      headers: this.auth.headers(),
    });
  }

  approve(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${apiBase()}/admin/contacts/${id}/approve`,
      {},
      { headers: this.auth.headers() },
    );
  }

  reject(id: string): Observable<unknown> {
    return this.http.post(
      `${apiBase()}/admin/contacts/${id}/reject`,
      {},
      { headers: this.auth.headers() },
    );
  }
}
