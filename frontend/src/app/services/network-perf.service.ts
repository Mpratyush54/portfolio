import { Injectable, NgZone, inject } from '@angular/core';

type NetInfo = {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
};

/** Landing-page first: shell paints now; Bud follows on idle (longer wait on Slow-4G). */
@Injectable({ providedIn: 'root' })
export class NetworkPerfService {
  private zone = inject(NgZone);
  isPhone(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
  }

  private connection(): NetInfo | null {
    if (typeof navigator === 'undefined') return null;
    return (navigator as Navigator & { connection?: NetInfo }).connection ?? null;
  }

  /** User explicitly asked for less data — only case we wait for a tap. */
  saveData(): boolean {
    return !!this.connection()?.saveData;
  }

  /** Slow radio / phone — still auto-load Bud, but only after the landing shell is up. */
  isSlow(): boolean {
    const c = this.connection();
    if (!c) return this.isPhone();
    if (c.saveData) return true;
    const t = c.effectiveType || '';
    if (t === 'slow-2g' || t === '2g' || t === '3g') return true;
    if (typeof c.downlink === 'number' && c.downlink > 0 && c.downlink < 2) return true;
    if (typeof c.rtt === 'number' && c.rtt >= 300) return true;
    return this.isPhone();
  }

  /** How long to protect the landing critical path before fetching Three + GLB. */
  budStartDelayMs(): number {
    if (this.saveData()) return 0; // unused — Save-Data uses opt-in
    if (this.isSlow()) return 4000; // Slow-4G: landing usable first, Bud warms after
    return 600; // Fast links: almost immediate after first paint
  }

  whenIdle(cb: () => void, timeoutMs = 2500): void {
    // requestIdleCallback is not patched by Zone.js. Re-enter Angular so the
    // deferred scene and its loading state render without a subsequent tap.
    const run = () => this.zone.run(cb);
    if (typeof window === 'undefined') {
      run();
      return;
    }
    const ric = (window as Window & {
      requestIdleCallback?: (fn: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) {
      ric(run, { timeout: timeoutMs });
    } else {
      setTimeout(run, Math.min(timeoutMs, 1200));
    }
  }
}
