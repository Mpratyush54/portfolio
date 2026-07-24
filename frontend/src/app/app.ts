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
    <main>
      <router-outlet></router-outlet>
    </main>
    @if (!isHome) {
      <app-footer></app-footer>
    }
    <app-command-palette></app-command-palette>
  `,
  styles: [`
    :host.home-route main {
       min-height: 100vh;
    }
    :host:not(.home-route) main {
       min-height: calc(100vh - 80px);
    }
  `]
})
export class App {
  private router = inject(Router);
  private renderer = inject(Renderer2);
  isHome = false;

  constructor() {
    this.isHome = this.router.url === '/';
    this.setBodyOverflow(this.isHome);

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.isHome = e.urlAfterRedirects === '/';
      this.setBodyOverflow(this.isHome);
    });
  }

  private setBodyOverflow(home: boolean): void {
    if (home) {
      this.renderer.setStyle(document.body, 'overflow', 'hidden');
    } else {
      this.renderer.removeStyle(document.body, 'overflow');
    }
  }
}
