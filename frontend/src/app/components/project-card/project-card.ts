import { Component, Input } from '@angular/core';
import { Project } from '../../models/project.model';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-project-card',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './project-card.html',
    styleUrl: './project-card.scss'
})
export class ProjectCardComponent {
    @Input({ required: true }) project!: Project;

    get statusBadge(): { label: string, type: 'live' | 'code' | 'concept' } {
        if (this.project.link) return { label: 'Live', type: 'live' };
        if (this.project.repo || this.project.frontendRepo) return { label: 'Open Source', type: 'code' };
        return { label: 'Concept', type: 'concept' };
    }

    get availabilityText(): string {
        const parts = [];
        if (this.project.link) parts.push('Deployed App');
        if (this.project.repo || this.project.frontendRepo) parts.push('Source Code');
        return parts.length ? parts.join(' & ') : 'Design Concept';
    }
}
