import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ViewportService {
  readonly compact = signal(false);
  readonly coarse = signal(false);
  private zone = inject(NgZone);
  private destroy = inject(DestroyRef);

  constructor() {
    this.observe('(max-width: 900px)', this.compact);
    this.observe('(pointer: coarse)', this.coarse);
  }

  private observe(query: string, state: ReturnType<typeof signal<boolean>>) {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia(query);
    state.set(media.matches);
    const update = () => this.zone.run(() => state.set(media.matches));
    media.addEventListener('change', update);
    this.destroy.onDestroy(() => media.removeEventListener('change', update));
  }
}
