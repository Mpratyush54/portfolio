import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBase } from '../../../core/api/api-base';
import { AdminAuthService } from './admin-auth.service';

export type BookingRow = {
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
  assignedTo?: string;
  meetingUrl?: string;
  adminNotes?: string;
  updatedAt: string;
};

@Injectable({ providedIn: 'root' })
export class AdminBookingsService {
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
    return this.http.get<any>(`${apiBase()}/admin/bookings${q}`, {
      headers: this.auth.headers(),
    });
  }

  saveAssignment(
    b: BookingRow,
    completed = false,
  ): Observable<any> {
    return this.http.put(
      `${apiBase()}/admin/bookings/${b._id}`,
      {
        assignedTo: b.assignedTo || '',
        meetingUrl: b.meetingUrl || '',
        adminNotes: b.adminNotes || '',
        updatedAt: b.updatedAt,
        completed,
      },
      { headers: this.auth.headers() },
    );
  }
}
