import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBase } from '../../../core/api/api-base';

export type ServicePackage = {
  id: string;
  name: string;
  fee: number;
  summary: string;
  scope: string[];
  exclusions: string;
  timeline: string;
};

export type ServicesCatalog = {
  provider: string;
  email: string;
  packages: ServicePackage[];
  commercialNotes: string[];
  consultation: { durationMinutes: number; description: string; baseFee?: number };
};

@Injectable({ providedIn: 'root' })
export class ServicesCatalogService {
  private http = inject(HttpClient);

  getCatalog(): Observable<ServicesCatalog> {
    return this.http.get<ServicesCatalog>('/data/services.json');
  }

  getConsultationConfig(): Observable<any> {
    return this.http.get<any>(`${apiBase()}/bookings/config`);
  }
}
