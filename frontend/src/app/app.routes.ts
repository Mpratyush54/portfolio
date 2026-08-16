import { NotFoundComponent } from './pages/not-found/not-found';
import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { AdminComponent } from './pages/admin/admin';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'work', component: HomeComponent },
  { path: 'projects', component: HomeComponent },
  { path: 'projects/systems', component: HomeComponent },
  { path: 'projects/:id', component: HomeComponent },
  { path: 'about', component: HomeComponent },
  { path: 'contact', component: HomeComponent },
  { path: 'admin', component: AdminComponent },
  { path: '404', component: NotFoundComponent },
  { path: '**', redirectTo: '404' }
];
