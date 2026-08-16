import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AskService {
  private _open = signal(false);
  private _seedQuestion = signal<string | null>(null);

  open = this._open.asReadonly();
  seedQuestion = this._seedQuestion.asReadonly();

  toggle(): void {
    this._open.update(v => !v);
    if (!this._open()) this._seedQuestion.set(null);
  }

  show(seed?: string): void {
    if (seed) this._seedQuestion.set(seed);
    this._open.set(true);
  }

  close(): void {
    this._open.set(false);
    this._seedQuestion.set(null);
  }

  consumeSeed(): string | null {
    const s = this._seedQuestion();
    this._seedQuestion.set(null);
    return s;
  }
}
