import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PrimaryNavigationComponent } from '../primary-navigation/primary-navigation';
@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [RouterLink, PrimaryNavigationComponent],
  template: `<header class="public-header">
      <div class="hud-left">
        <a routerLink="/" class="brand">pratyush mishra.</a>
        <p class="hud-sub">backend engineer · team lead · full stack</p>
      </div>
      <div class="hud-right">
        <span class="mood">{{ context }}</span
        ><app-primary-navigation [active]="active" />
      </div>
      <a
        class="mobile-book"
        routerLink="/book"
        aria-label="Book a technical consultation"
        [attr.aria-current]="active === 'book' ? 'page' : null"
        >Book a call</a
      >
    </header>
    <app-primary-navigation variant="mobile" [active]="active" />`,
  styleUrl: './public-header.scss',
})
export class PublicHeaderComponent {
  @Input() active = '';
  @Input() context = 'services · pricing';
}
