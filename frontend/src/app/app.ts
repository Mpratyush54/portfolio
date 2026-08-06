import { Component, inject, Renderer2 } from '@angular/core';
import { RouterOutlet, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { NavbarComponent } from './components/navbar/navbar';
import { FooterComponent } from './components/footer/footer';
import { CommandPaletteComponent } from './components/command-palette/command-palette';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, CommandPaletteComponent],
  template: `
    @if (!isHome) {
      <app-navbar></app-navbar>
    }
    <main [class.home-main]="isHome">
      <router-outlet></router-outlet>
    </main>
    @if (!isHome) {
      <app-footer></app-footer>
    }
    <app-command-palette></app-command-palette>
  `,
  styles: [`
    main:not(.home-main) {
      min-height: calc(100vh - 80px);
    }
    main.home-main {
      min-height: 100vh;
    }
  `]
})
export class App {
  private router = inject(Router);
  private renderer = inject(Renderer2);
  isHome = false;

  constructor() {
    this.syncRoute(this.router.url);

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.syncRoute(e.urlAfterRedirects);
    });
  }

  private syncRoute(url: string): void {
    this.isHome = url === '/' || url.startsWith('/#') || url.startsWith('/?');
    // Home manages its own immersive scroll; never lock body overflow
    this.renderer.removeStyle(document.body, 'overflow');
  }
}
