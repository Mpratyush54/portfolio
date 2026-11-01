import { Injectable, computed, signal } from '@angular/core';

export type ConsentChoice = 'granted' | 'denied';
export const ANALYTICS_CONSENT_KEY = 'portfolio-analytics-consent';

function read(): ConsentChoice | null {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

/** Visitor's analytics choice. Ignoring the notice counts as OK; only an explicit decline stops tracking. */
@Injectable({ providedIn: 'root' })
export class AnalyticsConsentService {
  private readonly state = signal<ConsentChoice | null>(read());
  readonly choice = this.state.asReadonly();
  readonly granted = computed(() => this.state() !== 'denied');
  readonly undecided = computed(() => this.state() === null);

  set(choice: ConsentChoice): void {
    this.state.set(choice);
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, choice);
    } catch {
      /* Choice still applies for this page view. */
    }
  }
}
