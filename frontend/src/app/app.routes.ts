import { NotFoundComponent } from './pages/not-found/not-found';
import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { ProjectsComponent } from './pages/projects/projects';
import { ProjectDetailComponent } from './pages/project-detail/project-detail';
import { ContactComponent } from './pages/contact/contact';
import { AboutComponent } from './pages/about/about';
import { AdminComponent } from './pages/admin/admin';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'projects', component: ProjectsComponent },
    { path: 'projects/systems', component: ProjectsComponent },
    { path: 'projects/:id', component: ProjectDetailComponent },
    { path: 'admin', component: AdminComponent },
    { path: 'contact', component: ContactComponent },
    { path: 'about', component: AboutComponent },
    { path: '404', component: NotFoundComponent },
    { path: '**', redirectTo: '404' }
];
