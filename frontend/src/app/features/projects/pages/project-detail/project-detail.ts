import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { PublicHeaderComponent } from '../../../../shared/ui/public-header/public-header';
import { ApiService } from '../../data/projects.service';
import { FALLBACK_PROJECTS, workKindLabel } from '../../data/project-catalog';
import { WorkMedia, workMedia } from '../../data/work-media';
import { Project } from '../../models/project.model';
import { MermaidDiagramComponent } from '../../components/mermaid-diagram';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, PublicHeaderComponent, MermaidDiagramComponent],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
})
export class ProjectDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private title = inject(Title);
  private meta = inject(Meta);
  project = signal<Project | null>(null);
  loading = signal(true);
  kindLabel = workKindLabel;
  media: WorkMedia = { gallery: [], mermaid: '', steps: [] };

  paragraphs(project: Project): string[] {
    return String(project.fullDescription || '')
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      await this.router.navigateByUrl('/404');
      return;
    }
    const fallback = FALLBACK_PROJECTS.find((row) => row._id === id) || null;
    if (fallback) this.setProject(fallback);
    try {
      this.setProject(await firstValueFrom(this.api.getProjectById(id)));
    } catch {
      if (!this.project()) {
        await this.router.navigateByUrl('/404');
        return;
      }
    }
    this.loading.set(false);
  }

  private setProject(row: Project) {
    this.project.set(row);
    this.media = workMedia(row);
    this.title.setTitle(`${row.title} | Work`);
    this.meta.updateTag({ name: 'description', content: row.shortDescription });
  }
}
