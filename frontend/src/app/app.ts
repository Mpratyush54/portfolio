import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';
import { FooterComponent } from './components/footer/footer';
import { CommandPaletteComponent } from './components/command-palette/command-palette';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, CommandPaletteComponent],
  template: `
    <app-navbar></app-navbar>
    <main>
      <router-outlet></router-outlet>
    </main>
    <app-footer></app-footer>
    <app-command-palette></app-command-palette>
  `,
  styles: [`
    main {
       min-height: calc(100vh - 80px); /* Adjust for navbar height */
    }
  `]
})
export class App { }
