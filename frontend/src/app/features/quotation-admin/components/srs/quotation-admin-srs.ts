import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuotationAdminService } from '../../data/quotation-admin.service';

@Component({
  selector: 'app-quotation-admin-srs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quotation-admin-srs.html',
  styleUrl: '../../styles/quotation-admin.scss'
})
export class QuotationAdminSrsComponent {
  qa = inject(QuotationAdminService);
}
