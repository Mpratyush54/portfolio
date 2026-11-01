import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgreementTextComponent } from '../../../quotation/components/agreement-text/agreement-text';
import { QuotationAdminService } from '../../data/quotation-admin.service';
import { QuotationAdminSrsComponent } from '../srs/quotation-admin-srs';

@Component({
  selector: 'app-quotation-admin-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, AgreementTextComponent, QuotationAdminSrsComponent],
  templateUrl: './quotation-admin-editor.html',
  styleUrl: '../../styles/quotation-admin.scss'
})
export class QuotationAdminEditorComponent {
  qa = inject(QuotationAdminService);
}
