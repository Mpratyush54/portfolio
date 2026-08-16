import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-work-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './work-card.html',
  styleUrl: './work-card.scss'
})
export class WorkCardComponent {
  @Input({ required: true }) project!: Project;
  @Input() index = 0;
  @Output() open = new EventEmitter<string>();

  get num(): string {
    return String(this.index + 1).padStart(2, '0');
  }

  get category(): string {
    return this.project.category || 'Project';
  }

  get hint(): string {
    if (this.project.link) return 'Live';
    if (this.project.status?.phase === 'Production') return 'Shipped';
    return this.project.status?.phase || 'Build';
  }

  get thumb(): string | null {
    return this.project.imageUrl || null;
  }

  get techs(): string[] {
    return (this.project.tags || []).slice(0, 2);
  }

  activate(): void {
    this.open.emit(this.project._id || '');
  }
}
