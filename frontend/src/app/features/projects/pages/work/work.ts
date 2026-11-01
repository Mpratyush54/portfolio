import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { PublicHeaderComponent } from '../../../../shared/ui/public-header/public-header';
import { ApiService } from '../../data/projects.service';
import { FALLBACK_PROJECTS, WorkKind, filterWork, workKindLabel } from '../../data/project-catalog';
import { workMedia } from '../../data/work-media';
import { Project } from '../../models/project.model';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, PublicHeaderComponent],
  templateUrl: './work.html',
  styleUrl: './work.scss',
})
export class WorkComponent implements OnInit {
  private api = inject(ApiService);
  private title = inject(Title);
  private meta = inject(Meta);
  kind = signal<WorkKind>('all');
  projects = signal<Project[]>([]);
  error = signal(false);
  loading = signal(true);
  readonly filters: { id: WorkKind; label: string }[] = [
    { id: 'all', label: 'All work' },
    { id: 'development', label: 'Development' },
    { id: 'cloud', label: 'Cloud' },
  ];

  get visible(): Project[] {
    return filterWork(this.projects(), this.kind());
  }

  kindLabel = workKindLabel;

  thumb(project: Project): string | undefined {
    return workMedia(project).image;
  }

  statusLine(project: Project): string {
    const phase = project.status?.phase;
    return phase ? `${this.kindLabel(project)} · ${phase}` : this.kindLabel(project);
  }

  showProjects() {
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setKind(kind: WorkKind) {
    this.kind.set(kind);
  }

  async ngOnInit() {
    this.title.setTitle('Work | Pratyush Mishra');
    this.meta.updateTag({
      name: 'description',
      content:
        'Past development and cloud projects by Pratyush Mishra. Review shipped work, then request a pricing analysis for a similar brief.',
    });
    await this.load();
  }

  async load() {
    this.error.set(false);
    this.loading.set(true);
    try {
      const rows = await firstValueFrom(this.api.getProjects());
      this.projects.set(rows.length ? rows : FALLBACK_PROJECTS);
    } catch {
      this.projects.set(FALLBACK_PROJECTS);
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
