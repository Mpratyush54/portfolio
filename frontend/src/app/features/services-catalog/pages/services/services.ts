import { Component, OnInit, inject, signal } from '@angular/core';
import { PublicHeaderComponent } from '../../../../shared/ui/public-header/public-header';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import {
  ServicesCatalog,
  ServicesCatalogService,
} from '../../data/services-catalog.service';

export type { ServicePackage, ServicesCatalog } from '../../data/services-catalog.service';
// types only — see services-catalog.service.ts

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, PublicHeaderComponent],
  templateUrl: './services.html',
  styleUrl: './services.scss',
})
export class ServicesComponent implements OnInit {
  private catalogApi = inject(ServicesCatalogService);
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
  readonly termLabels = [
    'Fees and taxes',
    'Changes to scope',
    'Payment schedule',
    'Defect support',
    'Third-party costs',
  ];
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
      this.catalog.set(await firstValueFrom(this.catalogApi.getCatalog()));
    } catch {
      this.error.set(true);
    }
  }
  async loadConsultation() {
    try {
      this.consultation.set(await firstValueFrom(this.catalogApi.getConsultationConfig()));
    } catch {
      /* Contact and service prices remain available. */
    }
  }
}
