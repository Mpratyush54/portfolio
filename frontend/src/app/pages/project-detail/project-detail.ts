import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/project.model';

@Component({
    selector: 'app-project-detail',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './project-detail.html',
    styleUrl: './project-detail.scss'
})
export class ProjectDetailComponent implements OnInit { 
    project: Project | undefined;
    isLoading = true;

    // Donut chart
    hoveredIndex: number | null = null;

    // Access modal
    isAccessModalOpen = false;

    get statusBadge(): { label: string, type: 'live' | 'code' | 'concept' } {
        if (!this.project) return { label: '', type: 'concept' };
        if (this.project.link) return { label: 'Live', type: 'live' };
        if (this.project.repo || this.project.frontendRepo) return { label: 'Open Source', type: 'code' };
        return { label: 'Concept', type: 'concept' };
    }

    get chartData() {
        if (!this.project?.languageStats) return [];
        let cumulativePercent = 0;
        return this.project.languageStats.map((lang, index) => {
            const startOffset = cumulativePercent;
            cumulativePercent += lang.percent;
            return { ...lang, index, dashArray: `${lang.percent} 100`, dashOffset: -startOffset };
        });
    }

    constructor(
        private route: ActivatedRoute,
        private apiService: ApiService,
        private router: Router
    ) {}

    ngOnInit() {
        this.isLoading = true;
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) { this.router.navigate(['/404']); return; }

        this.apiService.getProjectById(id).subscribe({
            next: (project) => {
                this.project = project;
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                this.router.navigate(['/404']);
            }
        });
    }

    setHover(index: number | null) { this.hoveredIndex = index; }

    openAccessModal() { this.isAccessModalOpen = true; document.body.style.overflow = 'hidden'; }
    closeAccessModal() { this.isAccessModalOpen = false; document.body.style.overflow = ''; }
    submitAccessRequst(event: Event) { event.preventDefault(); alert('Request Sent! We will get back to you shortly.'); this.closeAccessModal(); }

    getCategoryColor(cat: string): string {
        const colors: Record<string, string> = { 'Performance': '#10b981', 'Security': '#3b82f6', 'Scalability': '#8b5cf6', 'UX': '#f59e0b', 'Architecture': '#ec4899', 'Maintainability': '#14b8a6' };
        return colors[cat] || '#6b7280';
    }
}
