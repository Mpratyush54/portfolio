import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AnalyticsConsentService } from '../../../core/analytics/analytics-consent.service';
import { analyticsPath } from '../../../core/analytics/analytics.contract';
import { AnalyticsService } from '../../../core/analytics/analytics.service';

@Component({
  selector: 'app-consent-banner',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <section class="consent" role="dialog" aria-live="polite" aria-labelledby="consent-title">
        <h2 id="consent-title">Analytics notice</h2>
        <p>
          This site uses anonymous analytics and session replay to see how it's used. Text and
          form fields are masked, there are no cookies or profiles, and your IP isn't stored.
          See the <a routerLink="/privacy">privacy policy</a>.
        </p>
        <div class="consent__actions">
          <button type="button" class="consent__btn consent__btn--ghost" (click)="choose('denied')">
            No thanks
          </button>
          <button type="button" class="consent__btn" (click)="choose('granted')">Accept</button>
        </div>
      </section>
    }
  `,
  styles: [
    `
      .consent {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 1000;
        width: min(380px, calc(100vw - 40px));
        padding: 18px 20px;
        border-radius: 14px;
        border: 1px solid var(--border-color);
        background: var(--surface-color);
        color: var(--text-color);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
        animation: consent-in 0.5s var(--ease-out) both;
      }
      h2 {
        margin: 0 0 6px;
        font-size: 15px;
        font-weight: 600;
      }
      p {
        margin: 0 0 14px;
        font-size: 13px;
        line-height: 1.5;
        color: var(--text-secondary);
      }
      a {
        color: var(--text-color);
        text-decoration: underline;
      }
      .consent__actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .consent__btn {
        cursor: pointer;
        padding: 8px 16px;
        border-radius: 999px;
        border: 1px solid transparent;
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        background: var(--text-color);
        color: var(--bg-color);
        transition: opacity 0.2s;
      }
      .consent__btn:hover {
        opacity: 0.85;
      }
      .consent__btn--ghost {
        background: transparent;
        color: var(--text-secondary);
        border-color: var(--chip-border);
      }
      .consent__btn:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
      }
      @keyframes consent-in {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
      }
      @media (max-width: 600px) {
        .consent {
          left: 12px;
          right: 12px;
          bottom: 12px;
          width: auto;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .consent {
          animation: none;
        }
      }
    `,
  ],
})
export class ConsentBannerComponent {
  private consent = inject(AnalyticsConsentService);
  private router = inject(Router);
  // Instantiated here so it reacts to the choice even if nothing else touched it yet.
  private analytics = inject(AnalyticsService);
  private url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly visible = computed(
    () => this.consent.undecided() && analyticsPath(this.url()) !== null,
  );

  choose(choice: 'granted' | 'denied'): void {
    this.consent.set(choice);
  }
}
