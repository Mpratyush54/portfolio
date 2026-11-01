import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Quotation } from '../../../quotation/models/quotation.model';
import { QuotationAdminService } from '../../data/quotation-admin.service';

@Component({
  selector: 'app-quotation-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quotation-admin-payments.html',
  styleUrl: '../../styles/quotation-admin.scss'
})
export class QuotationAdminPaymentsComponent {
  qa = inject(QuotationAdminService);
  @Input({ required: true }) q!: Quotation;
}
