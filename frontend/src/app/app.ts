import { Component, inject, Renderer2, OnInit, effect } from '@angular/core';
import { RouterOutlet, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { CustomCursorComponent } from './components/custom-cursor/custom-cursor';
import { SfxService } from './services/sfx.service';
import { ViewportService } from './services/viewport.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CustomCursorComponent],
  template: `
    @if (showCursor) {
      <app-custom-cursor></app-custom-cursor>
    }
    <main class="shell-main">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [
    `
      .shell-main {
        min-height: 100vh;
      }
    `,
  ],
})
export class App implements OnInit {
  private viewport = inject(ViewportService);
  get simpleUi(): boolean {
    return this.viewport.compact();
  }
  private router = inject(Router);
  private renderer = inject(Renderer2);
  private sfx = inject(SfxService);
  get showCursor(): boolean {
    return !this.simpleUi && !this.viewport.coarse() && this.isShell(this.router.url);
  }

  ngOnInit(): void {
    this.renderer.addClass(document.documentElement, 'dark-mode');
  }

  constructor() {
    effect(() => this.lockBody(this.isShell(this.router.url)));
    this.lockBody(this.isShell(this.router.url));
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.lockBody(this.isShell(e.urlAfterRedirects));
    });
  }

  private isShell(url: string): boolean {
    const path = url.split(/[?#]/)[0].replace(/\/$/, '') || '/';
    return (
      ['/', '/about', '/projects'].includes(path) ||
      path.startsWith('/projects/')
    );
  }

  private lockBody(shell: boolean): void {
    if (shell && !this.simpleUi) this.renderer.setStyle(document.body, 'overflow', 'hidden');
    else this.renderer.removeStyle(document.body, 'overflow');
  }
}
