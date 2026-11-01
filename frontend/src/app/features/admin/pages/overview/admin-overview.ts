import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AdminWorkspaceService } from '../../data/admin-workspace.service';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-overview.html',
  styleUrl: '../../styles/admin.scss',
})
export class AdminOverviewComponent {
  workspace = inject(AdminWorkspaceService);
  private router = inject(Router);

  go(section: string, query?: Record<string, string>) {
    void this.router.navigate(['/admin', section], query ? { queryParams: query } : {});
  }
}
