import { Component, inject, Renderer2, OnInit } from '@angular/core';
import { RouterOutlet, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { CustomCursorComponent } from './components/custom-cursor/custom-cursor';
import { SfxService } from './services/sfx.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CustomCursorComponent],
  template: `
    <app-custom-cursor></app-custom-cursor>
    <main class="shell-main">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .shell-main {
      min-height: 100vh;
    }
  `]
})
export class App implements OnInit {
  private router = inject(Router);
  private renderer = inject(Renderer2);
  private sfx = inject(SfxService);

  ngOnInit(): void {
    this.renderer.addClass(document.documentElement, 'dark-mode');
  }

  constructor() {
    this.lockBody(this.isShell(this.router.url));
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.lockBody(this.isShell(e.urlAfterRedirects));
    });
  }

  private isShell(url: string): boolean {
    const path = url.split('?')[0];
    if (path.startsWith('/admin') || path.startsWith('/404')) return false;
    return true;
  }

  private lockBody(shell: boolean): void {
    if (shell) this.renderer.setStyle(document.body, 'overflow', 'hidden');
    else this.renderer.removeStyle(document.body, 'overflow');
  }
}
