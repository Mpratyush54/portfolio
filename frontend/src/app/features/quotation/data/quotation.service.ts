import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiBase } from '../../../core/api/api-base';
import { Quotation } from '../models/quotation.model';
import { downloadQuotationFile } from '../utils/quotation-files';

@Injectable({ providedIn: 'root' })
export class QuotationService {
  private http = inject(HttpClient);

  api() {
    return apiBase();
  }

  private headers(token: string) {
    return new HttpHeaders({ 'x-quotation-token': token });
  }

  getSample() {
    return this.http.get<Quotation>('/review/sample-quotation.json');
  }

  getCurrent(token: string) {
    return this.http.get<Quotation>(`${apiBase()}/quotations/current`, {
      headers: this.headers(token),
    });
  }

  verifyPayment(token: string, body: unknown) {
    return this.http.post<Quotation>(`${apiBase()}/quotations/verify`, body, {
      headers: this.headers(token),
    });
  }

  action(token: string, path: string, body: unknown) {
    return this.http.post<Quotation>(`${apiBase()}/quotations/${path}`, body, {
      headers: this.headers(token),
    });
  }

  createOrder(token: string, index: number, correlationId: string) {
    return this.http.post<any>(
      `${apiBase()}/quotations/order/${index}`,
      { correlationId },
      { headers: this.headers(token) },
    );
  }

  async download(token: string | null, path: string, name: string, isExample = false) {
    await downloadQuotationFile(
      this.http,
      isExample ? path : `${apiBase()}/quotations${path}`,
      isExample || !token ? new HttpHeaders() : this.headers(token),
      name,
    );
  }

  async first<T>(obs: import('rxjs').Observable<T>): Promise<T> {
    return firstValueFrom(obs);
  }
}
