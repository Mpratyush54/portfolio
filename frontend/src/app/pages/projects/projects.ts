import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/project.model';
import { ProjectCardComponent } from '../../components/project-card/project-card';

@Component({
    selector: 'app-projects',
    standalone: true,
    imports: [CommonModule, ProjectCardComponent],
    templateUrl: './projects.html',
    styleUrl: './projects.scss'
})
export class ProjectsComponent implements OnInit {
    apiService = inject(ApiService);
    router = inject(Router);
    isLoading = true;
    pageTitle = 'Application Development';
    subtitleText = '';
    contextCategories: string[] = ['Web', 'Mobile'];
    categories: string[] = ['All'];
    selectedCategory = 'All';
    sourceFilters = [
        { value: 'all', label: 'All Sources' },
        { value: 'github', label: 'GitHub' },
        { value: 'gitlab', label: 'GitLab' }
    ];
    selectedSource = 'all';
    filteredProjects: Project[] = [];
    allProjects: Project[] = [];

    ngOnInit() {
        const url = this.router.url;
        if (url.includes('systems')) {
            this.pageTitle = 'Systems & Infrastructure';
            this.contextCategories = ['DevOps', 'Backend'];
        }
        this.categories = ['All', ...this.contextCategories];
        this.subtitleText = `Showcasing my work in ${this.contextCategories.join(' & ')}`;

        this.apiService.getProjects().subscribe({
            next: (data) => {
                this.allProjects = data.filter(p => this.contextCategories.includes(p.category));
                this.applyFilters();
                this.isLoading = false;
            },
            error: () => this.isLoading = false
        });
    }

    setCategory(c: string) { this.selectedCategory = c; this.applyFilters(); }
    setSource(s: string) { this.selectedSource = s; this.applyFilters(); }

    applyFilters() {
        let f = this.allProjects;
        if (this.selectedCategory !== 'All') f = f.filter(p => p.category === this.selectedCategory);
        if (this.selectedSource !== 'all') f = f.filter(p => p.source === this.selectedSource);
        this.filteredProjects = f;
    }

    switchContext(context: 'apps' | 'systems') {
        this.router.navigate([context === 'apps' ? '/projects' : '/projects/systems']);
    }
}
