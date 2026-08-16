import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-overlay.html',
  styleUrl: './project-overlay.scss'
})
export class ProjectOverlayComponent {
  @Input() project: Project | null = null;
  @Input() index = 0;
  @Input() total = 0;
  @Output() close = new EventEmitter<void>();
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  get features(): string[] {
    return this.project?.features?.slice(0, 6) || [];
  }

  get tags(): string[] {
    return this.project?.tags || [];
  }

  onBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay-root')) {
      this.close.emit();
    }
  }
}
