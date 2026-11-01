import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminAuthService } from '../../../admin/data/admin-auth.service';
import { QuotationAdminHostComponent } from '../../components/host/quotation-admin-host';

/**
 * Route adapter under /admin/quotations* — derives mode/id from the URL and
 * forwards auth headers into the quotation-admin host.
 */
@Component({
  selector: 'app-quotation-admin-page',
  standalone: true,
  imports: [QuotationAdminHostComponent],
  templateUrl: './quotation-admin-page.html'
})
export class QuotationAdminPageComponent implements OnInit, OnDestroy {
  @ViewChild(QuotationAdminHostComponent) host?: QuotationAdminHostComponent;
  auth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private sub?: { unsubscribe(): void };
  quoteId = '';
  quoteMode: 'list' | 'new' | 'detail' | 'edit' = 'list';

  async canLeave() {
    return this.host ? this.host.canLeave() : true;
  }

  ngOnInit() {
    this.sync();
    this.sub = this.route.paramMap.subscribe(() => this.sync());
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  private sync() {
    const path = this.route.snapshot.routeConfig?.path || '';
    const id = this.route.snapshot.paramMap.get('quotationId') || '';
    if (path.endsWith('/edit') && id) {
      this.quoteId = id;
      this.quoteMode = 'edit';
      return;
    }
    if (path.includes(':quotationId') && id) {
      this.quoteId = id;
      this.quoteMode = 'detail';
      return;
    }
    if (path.endsWith('/new') || path === 'quotations/new') {
      this.quoteId = '';
      this.quoteMode = 'new';
      return;
    }
    this.quoteId = '';
    this.quoteMode = 'list';
  }
}
