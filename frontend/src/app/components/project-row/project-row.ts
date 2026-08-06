import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Project } from '../../models/project.model';
import { BudEventsService } from '../../services/bud-events.service';

@Component({
  selector: 'app-project-row',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './project-row.html',
  styleUrl: './project-row.scss'
})
export class ProjectRowComponent {
  @Input({ required: true }) project!: Project;
  @Input() index = 0;

  private bud = inject(BudEventsService);

  get statusLabel(): string {
    if (this.project.link) return 'live';
    if (this.project.repo || this.project.frontendRepo) return 'code';
    return 'concept';
  }

  get stackLine(): string {
    return (this.project.tags || []).slice(0, 5).join(' · ');
  }

  get indexLabel(): string {
    return String(this.index + 1).padStart(2, '0');
  }

  onActivate(): void {
    this.bud.celebrate();
  }
}
