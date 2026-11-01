import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-primary-navigation',
  standalone: true,

  template: `
    <nav
      [class]="variant === 'mobile' ? 'bottom-nav' : 'menu-pill'"
      [class.visible]="visible"
      aria-label="Primary"
    >
      @for (item of items; track item.key) {
        <button
          type="button"
          (click)="navigate(item.key)"
          [class.active]="active === item.key"
          [attr.aria-current]="active === item.key ? 'page' : null"
        >
          @if (variant === 'mobile') {
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              @switch (item.key) {
                @case ('home') {
                  <path d="M3 10.5 12 3l9 7.5" />
                  <path d="M5 9.5V21h14V9.5" />
                }
                @case ('work') {
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                }
                @case ('about') {
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20a7 7 0 0 1 14 0" />
                }
                @case ('contact') {
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                }
              }
            </svg>
          }
          <span>{{ item.label }}</span>
        </button>
      }
    </nav>
  `,
  styleUrl: './primary-navigation.scss',
})
export class PrimaryNavigationComponent {
  private router = inject(Router);
  @Input() routed = true;
  @Output() selected = new EventEmitter<'home' | 'work' | 'about' | 'contact'>();
  navigate(key: 'home' | 'work' | 'about' | 'contact') {
    this.selected.emit(key);
    if (this.routed)
      void this.router.navigateByUrl(key === 'home' ? '/' : '/' + key, { replaceUrl: true });
  }
  @Input() active = 'home';
  @Input() variant: 'desktop' | 'mobile' = 'desktop';
  @Input() visible = true;
  readonly items = [
    { key: 'home', path: '/', label: 'Home' },
    { key: 'work', path: '/work', label: 'Services' },
    { key: 'about', path: '/about', label: 'About' },
    { key: 'contact', path: '/contact', label: 'Contact' },
  ] as const;
}
