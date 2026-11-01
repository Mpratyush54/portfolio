import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuotationAdminService } from '../../data/quotation-admin.service';

@Component({
  selector: 'app-quotation-admin-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quotation-admin-list.html',
  styleUrl: '../../styles/quotation-admin.scss'
})
export class QuotationAdminListComponent {
  qa = inject(QuotationAdminService);
}
