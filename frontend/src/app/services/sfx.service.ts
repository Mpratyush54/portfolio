import { Injectable } from '@angular/core';

export type SfxType = 'click' | 'open' | 'success' | 'hover';

/**
 * UI sounds via Web Audio.
 * Browsers block audio until a user gesture — unlock() must run on pointer/key.
 */
@Injectable({ providedIn: 'root' })
export class SfxService {
  private ctx: AudioContext | null = null;
  private muted = false;
  private unlocked = false;
  private unlockBound = false;

  constructor() {
    if (typeof window !== 'undefined') this.bindUnlock();
  }

  setMuted(v: boolean): void {
    this.muted = v;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (!this.muted) this.unlock();
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Call from pointer/key events so AudioContext can start. */
  unlock(): void {
    try {
      const ctx = this.ensure();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        void ctx.resume().then(() => { this.unlocked = true; });
      } else {
        this.unlocked = true;
      }
    } catch { /* ignore */ }
  }

  play(type: SfxType = 'click'): void {
    if (this.muted || typeof window === 'undefined') return;
    try {
      this.unlock();
      const ctx = this.ensure();
      if (!ctx) return;

      const run = () => {
        const t = ctx.currentTime;
        if (type === 'click') this.toneClick(ctx, t);
        else if (type === 'open') this.toneOpen(ctx, t);
        else if (type === 'success') this.toneSuccess(ctx, t);
        else this.toneHover(ctx, t);
      };

      if (ctx.state === 'suspended') {
        void ctx.resume().then(run);
      } else {
        run();
      }
    } catch {
      /* ignore */
    }
  }

  private toneClick(ctx: AudioContext, t: number): void {
    // Layered click: soft noise tick + tone (actually audible on laptop speakers)
    const noiseDur = 0.04;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * noiseDur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const ng = ctx.createGain();
    noise.connect(ng);
    ng.connect(ctx.destination);
    ng.gain.setValueAtTime(0.22, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + noiseDur);
    noise.start(t);
    noise.stop(t + noiseDur);

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.08);
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.start(t);
    o.stop(t + 0.12);
  }

  private toneOpen(ctx: AudioContext, t: number): void {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(280, t);
    o.frequency.exponentialRampToValueAtTime(640, t + 0.12);
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.start(t);
    o.stop(t + 0.24);
  }

  private toneSuccess(ctx: AudioContext, t: number): void {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(523, t);
    o.frequency.setValueAtTime(784, t + 0.09);
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.start(t);
    o.stop(t + 0.34);
  }

  private toneHover(ctx: AudioContext, t: number): void {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 720;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.start(t);
    o.stop(t + 0.06);
  }

  private bindUnlock(): void {
    if (this.unlockBound) return;
    this.unlockBound = true;
    const once = () => {
      this.unlock();
      // Tiny silent buffer kick so the context stays alive after first gesture
      try {
        const ctx = this.ensure();
        if (ctx) {
          const b = ctx.createBuffer(1, 1, 22050);
          const s = ctx.createBufferSource();
          s.buffer = b;
          s.connect(ctx.destination);
          s.start(0);
        }
      } catch { /* ignore */ }
      window.removeEventListener('pointerdown', once, true);
      window.removeEventListener('keydown', once, true);
    };
    window.addEventListener('pointerdown', once, true);
    window.addEventListener('keydown', once, true);
  }

  private ensure(): AudioContext | null {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!this.ctx) this.ctx = new Ctx();
    return this.ctx;
  }
}
