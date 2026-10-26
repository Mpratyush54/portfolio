import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';

export const routes: Routes = [
  { path: 'terms', data: {policy:'terms'}, loadComponent: () => import('./pages/services/business-policy').then(m => m.BusinessPolicyComponent) },
  { path: 'privacy', data: {policy:'privacy'}, loadComponent: () => import('./pages/services/business-policy').then(m => m.BusinessPolicyComponent) },
  { path: 'refunds', data: {policy:'refunds'}, loadComponent: () => import('./pages/services/business-policy').then(m => m.BusinessPolicyComponent) },
  { path: 'delivery', data: {policy:'delivery'}, loadComponent: () => import('./pages/services/business-policy').then(m => m.BusinessPolicyComponent) },
  { path: 'proposal', loadComponent: () => import('./pages/quotation/quotation').then(m => m.QuotationComponent) },
  { path: '', component: HomeComponent },
  { path: 'work', loadComponent: () => import('./pages/services/services').then(m => m.ServicesComponent) },
  { path: 'pricing', redirectTo: 'work', pathMatch: 'full' },
  { path: 'services', redirectTo: 'work', pathMatch: 'full' },
  { path: 'projects', redirectTo: 'work', pathMatch: 'full' },
  { path: 'projects/systems', redirectTo: 'work', pathMatch: 'full' },
  { path: 'projects/:id', redirectTo: 'work', pathMatch: 'full' },
  { path: 'about', component: HomeComponent },
  { path: 'contact', component: HomeComponent },
  {
    path: 'book',
    loadComponent: () => import('./pages/book/book').then(m => m.BookComponent),
  },
  {
    path: 'admin',
    canDeactivate: [(component: { canLeave: () => Promise<boolean> }) => component.canLeave()],
    loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent),
  },
  {
    path: '404',
    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFoundComponent),
  },
  { path: '**', redirectTo: '404' },
];
