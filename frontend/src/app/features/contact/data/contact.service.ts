import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBase } from '../../../core/api/api-base';

export type ContactPayload = {
  intent: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  website: string;
};

@Injectable({ providedIn: 'root' })
export class ContactService {
  private http = inject(HttpClient);

  submit(payload: ContactPayload): Observable<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; message?: string }>(`${apiBase()}/contact`, payload);
  }
}
