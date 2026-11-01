import { Routes } from '@angular/router';
import { HomeComponent } from './features/shell-home/pages/home/home';

const canLeaveAdmin = (component: { canLeave: () => Promise<boolean> }) => component.canLeave();

export const routes: Routes = [
  {
    path: 'sample-quotation',
    data: { example: true },
    loadComponent: () =>
      import('./features/quotation/pages/portal/quotation').then((m) => m.QuotationComponent),
  },
  {
    path: 'terms',
    data: { policy: 'terms' },
    loadComponent: () =>
      import('./features/services-catalog/pages/business-policy/business-policy').then(
        (m) => m.BusinessPolicyComponent,
      ),
  },
  {
    path: 'privacy',
    data: { policy: 'privacy' },
    loadComponent: () =>
      import('./features/services-catalog/pages/business-policy/business-policy').then(
        (m) => m.BusinessPolicyComponent,
      ),
  },
  {
    path: 'refunds',
    data: { policy: 'refunds' },
    loadComponent: () =>
      import('./features/services-catalog/pages/business-policy/business-policy').then(
        (m) => m.BusinessPolicyComponent,
      ),
  },
  {
    path: 'delivery',
    data: { policy: 'delivery' },
    loadComponent: () =>
      import('./features/services-catalog/pages/business-policy/business-policy').then(
        (m) => m.BusinessPolicyComponent,
      ),
  },
  {
    path: 'proposal',
    loadComponent: () =>
      import('./features/quotation/pages/portal/quotation').then((m) => m.QuotationComponent),
  },
  { path: '', component: HomeComponent },
  {
    path: 'work',
    loadComponent: () =>
      import('./features/services-catalog/pages/services/services').then((m) => m.ServicesComponent),
  },
  { path: 'pricing', redirectTo: 'work', pathMatch: 'full' },
  { path: 'services', redirectTo: 'work', pathMatch: 'full' },
  { path: 'projects', redirectTo: 'work', pathMatch: 'full' },
  { path: 'projects/systems', redirectTo: 'work', pathMatch: 'full' },
  { path: 'projects/:id', redirectTo: 'work', pathMatch: 'full' },
  { path: 'about', component: HomeComponent },
  {
    path: 'contact',
    loadComponent: () =>
      import('./features/contact/contact/contact').then((m) => m.ContactComponent),
  },
  {
    path: 'book',
    loadComponent: () => import('./features/booking/book/book').then((m) => m.BookComponent),
  },
  {
    path: 'admin',
    canDeactivate: [canLeaveAdmin],
    loadComponent: () =>
      import('./features/admin/pages/shell/admin-shell').then((m) => m.AdminShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./features/admin/pages/overview/admin-overview').then((m) => m.AdminOverviewComponent),
      },
      {
        path: 'bookings',
        loadComponent: () =>
          import('./features/admin/pages/bookings/admin-bookings').then((m) => m.AdminBookingsComponent),
      },
      {
        path: 'contacts',
        loadComponent: () =>
          import('./features/admin/pages/contacts/admin-contacts').then((m) => m.AdminContactsComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/admin/pages/settings/admin-settings').then((m) => m.AdminSettingsComponent),
      },
      {
        path: 'quotations',
        canDeactivate: [canLeaveAdmin],
        loadComponent: () =>
          import('./features/quotation-admin/pages/quotation-admin-page/quotation-admin-page').then(
            (m) => m.QuotationAdminPageComponent,
          ),
      },
      {
        path: 'quotations/new',
        canDeactivate: [canLeaveAdmin],
        loadComponent: () =>
          import('./features/quotation-admin/pages/quotation-admin-page/quotation-admin-page').then(
            (m) => m.QuotationAdminPageComponent,
          ),
      },
      {
        path: 'quotations/:quotationId/edit',
        canDeactivate: [canLeaveAdmin],
        loadComponent: () =>
          import('./features/quotation-admin/pages/quotation-admin-page/quotation-admin-page').then(
            (m) => m.QuotationAdminPageComponent,
          ),
      },
      {
        path: 'quotations/:quotationId',
        canDeactivate: [canLeaveAdmin],
        loadComponent: () =>
          import('./features/quotation-admin/pages/quotation-admin-page/quotation-admin-page').then(
            (m) => m.QuotationAdminPageComponent,
          ),
      },
    ],
  },
  {
    path: '404',
    loadComponent: () =>
      import('./features/not-found/not-found/not-found').then((m) => m.NotFoundComponent),
  },
  { path: '**', redirectTo: '404' },
];
