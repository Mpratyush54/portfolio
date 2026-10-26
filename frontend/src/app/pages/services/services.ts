import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Title, Meta } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

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
  consultation: { durationMinutes: number; description: string };
};
@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './services.html',
  styleUrl: './services.scss',
})
export class ServicesComponent implements OnInit {
  private http = inject(HttpClient);
  private title = inject(Title);
  private meta = inject(Meta);
  catalog = signal<ServicesCatalog | null>(null);
  consultation = signal<{
    minLabel: string;
    maxLabel: string;
    minPaise: number;
    maxPaise: number;
    paymentsEnabled: boolean;
  } | null>(null);
  error = signal(false);
  showPackages() {
    document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async ngOnInit() {
    this.title.setTitle('Services and pricing | Pratyush Mishra');
    this.meta.updateTag({
      name: 'description',
      content:
        'Fixed-scope website development, backend APIs, DevOps deployment and AWS optimisation services. View INR prices, deliverables and the project quotation process.',
    });
    await Promise.allSettled([this.loadCatalog(), this.loadConsultation()]);
  }
  async loadCatalog() {
    this.error.set(false);
    try {
      this.catalog.set(await firstValueFrom(this.http.get<ServicesCatalog>('/services.json')));
    } catch {
      this.error.set(true);
    }
  }
  async loadConsultation() {
    const base = location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
    try {
      this.consultation.set(await firstValueFrom(this.http.get<any>(base + '/bookings/config')));
    } catch {
      /* Contact and service prices remain available. */
    }
  }
}
