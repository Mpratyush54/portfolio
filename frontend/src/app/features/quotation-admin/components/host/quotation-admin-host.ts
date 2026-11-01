import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpHeaders } from '@angular/common/http';
import { QuotationAdminService } from '../../data/quotation-admin.service';
import { QuotationAdminListComponent } from '../list/quotation-admin-list';
import { QuotationAdminEditorComponent } from '../editor/quotation-admin-editor';
import { QuotationAdminPaymentsComponent } from '../payments/quotation-admin-payments';

@Component({
  selector: 'app-quotation-admin-host',
  standalone: true,
  providers: [QuotationAdminService],
  imports: [
    CommonModule,
    QuotationAdminListComponent,
    QuotationAdminEditorComponent,
    QuotationAdminPaymentsComponent,
  ],
  templateUrl: './quotation-admin-host.html',
  styleUrl: '../../styles/quotation-admin.scss'
})
export class QuotationAdminHostComponent implements OnChanges, OnInit {
  @Input({ required: true }) headers!: HttpHeaders;
  @Input() quotationId = '';
  @Input() mode: 'list' | 'new' | 'detail' | 'edit' = 'list';
  qa = inject(QuotationAdminService);
  private routeReady = false;

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent) {
    if (this.qa.dirty() || this.qa.savingDraft()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  ngOnInit() {
    this.syncInputs();
    this.routeReady = true;
    this.qa.markRouteReady();
    void this.qa.applyRoute();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.syncInputs();
    if (this.routeReady && (changes['mode'] || changes['quotationId'] || changes['headers'])) {
      void this.qa.applyRoute();
    }
  }

  canLeave() {
    return this.qa.canLeave();
  }

  private syncInputs() {
    this.qa.headers = this.headers;
    this.qa.bindRoute(this.mode, this.quotationId);
  }
}

export { QuotationAdminHostComponent as QuotationAdminComponent };
