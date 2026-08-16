import { Injectable, signal } from '@angular/core';

export type ShellView = 'home' | 'work' | 'about' | 'contact';

const MOODS: Record<ShellView, string> = {
  home: 'curious',
  work: 'thinking',
  about: 'bashful',
  contact: 'listening',
};

@Injectable({ providedIn: 'root' })
export class ShellService {
  private _view = signal<ShellView>('home');
  private _projectId = signal<string | null>(null);
  private _introDone = signal(false);

  view = this._view.asReadonly();
  projectId = this._projectId.asReadonly();
  introDone = this._introDone.asReadonly();

  get mood(): string {
    return MOODS[this._view()];
  }

  setView(v: ShellView): void {
    this._view.set(v);
    if (v !== 'work') this._projectId.set(null);
  }

  openProject(id: string): void {
    this._view.set('work');
    this._projectId.set(id);
  }

  closeProject(): void {
    this._projectId.set(null);
  }

  markIntroDone(): void {
    this._introDone.set(true);
  }
}
