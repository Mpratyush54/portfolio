import { Injectable, signal } from '@angular/core';

/** Lightweight event bus so pages can ask Bud to celebrate / narrate without ViewChild coupling. */
@Injectable({ providedIn: 'root' })
export class BudEventsService {
  private _celebrateTick = signal(0);
  celebrateTick = this._celebrateTick.asReadonly();

  celebrate(): void {
    this._celebrateTick.update(n => n + 1);
  }
}
