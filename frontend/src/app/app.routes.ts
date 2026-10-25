import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'work', component: HomeComponent },
  { path: 'projects', component: HomeComponent },
  { path: 'projects/systems', component: HomeComponent },
  { path: 'projects/:id', component: HomeComponent },
  { path: 'about', component: HomeComponent },
  { path: 'contact', component: HomeComponent },
  {
    path: 'book',
    loadComponent: () => import('./pages/book/book').then(m => m.BookComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent),
  },
  {
    path: '404',
    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFoundComponent),
  },
  { path: '**', redirectTo: '404' },
];
