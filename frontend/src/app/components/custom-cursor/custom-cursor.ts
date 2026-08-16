import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SfxService } from '../../services/sfx.service';

@Component({
  selector: 'app-custom-cursor',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (active) {
      <div class="cursor-root" aria-hidden="true">
        <div class="cursor"
          [class.is-down]="pressed"
          [class.is-hover]="hovering"
          [style.transform]="cursorTransform">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <path class="tri" d="M5 3.5 L28 17 L5 30.5 Z" stroke="currentColor" stroke-width="1.5"
              fill="rgba(240,240,246,0.16)" stroke-linejoin="round"/>
            <g class="dots" fill="currentColor">
              <path class="dot d1" d="M9,10.5 m0,-2.5 l2.2,-1.25 l2.2,1.25 l0,2.5 l-2.2,1.25 l-2.2,-1.25 z"/>
              <path class="dot d2" d="M15.5,17 m0,-2.5 l2.2,-1.25 l2.2,1.25 l0,2.5 l-2.2,1.25 l-2.2,-1.25 z"/>
              <path class="dot d3" d="M9,23.5 m0,-2.5 l2.2,-1.25 l2.2,1.25 l0,2.5 l-2.2,1.25 l-2.2,-1.25 z"/>
            </g>
          </svg>
          <span class="ring"></span>
          <span class="pulse"></span>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .cursor-root {
      position: fixed; inset: 0; z-index: 999999; pointer-events: none;
    }
    .cursor {
      position: fixed; top: 0; left: 0; width: 34px; height: 34px;
      margin: -6px 0 0 -4px; color: #f0f0f6; pointer-events: none;
      will-change: transform;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.55));
      transition: color 0.2s ease;
    }
    .ring {
      position: absolute; inset: -8px; border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.28);
      opacity: 0; transform: scale(0.55);
      transition: opacity 0.28s, transform 0.4s cubic-bezier(0.16,1,0.3,1);
    }
    .pulse {
      position: absolute; inset: -2px; border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.18);
      animation: cursorIdlePulse 2.2s ease-in-out infinite;
      pointer-events: none;
    }
    .cursor.is-hover {
      color: #fff;
    }
    .cursor.is-hover .ring {
      opacity: 1; transform: scale(1.05);
    }
    .cursor.is-hover .pulse { opacity: 0; }
    .cursor.is-down .ring {
      opacity: 0.55; transform: scale(0.72);
    }
    .cursor.is-down .tri {
      fill: rgba(240,240,246,0.32);
    }
    .dot {
      transform-box: fill-box;
      transform-origin: center;
      animation: hexPulse 1.35s ease-in-out infinite;
    }
    .d1 { animation-delay: 0s; }
    .d2 { animation-delay: 0.18s; }
    .d3 { animation-delay: 0.36s; }
    .tri {
      animation: triBreathe 2s ease-in-out infinite, triWiggle 3.2s ease-in-out infinite;
      transform-origin: 8px 17px;
      transform-box: fill-box;
    }
    @keyframes hexPulse {
      0%, 100% { opacity: 0.45; transform: scale(0.88); }
      50% { opacity: 1; transform: scale(1.12); }
    }
    @keyframes triBreathe {
      0%, 100% { fill: rgba(240,240,246,0.12); }
      50% { fill: rgba(240,240,246,0.28); }
    }
    @keyframes triWiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-3deg); }
      75% { transform: rotate(3deg); }
    }
    @keyframes cursorIdlePulse {
      0%, 100% { opacity: 0.35; transform: scale(0.85); }
      50% { opacity: 0; transform: scale(1.35); }
    }
    @media (pointer: coarse) {
      .cursor-root { display: none; }
    }
  `]
})
export class CustomCursorComponent implements OnInit, OnDestroy {
  private sfx = inject(SfxService);

  x = -100;
  y = -100;
  sx = -100;
  sy = -100;
  active = true;
  pressed = false;
  hovering = false;
  private raf = 0;
  private angle = 0;

  get cursorTransform(): string {
    const s = this.pressed ? 0.78 : this.hovering ? 1.22 : 1;
    const rot = this.hovering ? this.angle * 0.15 : this.angle * 0.04;
    return `translate3d(${this.sx}px, ${this.sy}px, 0) scale(${s}) rotate(${rot}deg)`;
  }

  private tick = () => {
    const dx = this.x - this.sx;
    const dy = this.y - this.sy;
    // Snappy follow with a little lag so motion feels alive
    this.sx += dx * 0.32;
    this.sy += dy * 0.32;
    this.angle += (dx * 0.08 - this.angle) * 0.12;
    this.raf = requestAnimationFrame(this.tick);
  };

  private onMove = (e: MouseEvent) => {
    this.x = e.clientX;
    this.y = e.clientY;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    this.hovering = !!el?.closest(
      'a, button, [role="button"], .chip, .work-card, .menu-pill button, .menu-pill a, .nav-link, .mute-btn, .rail-btn, .np-close, .np-open, .ask-field, .ask-x, .sug, input, textarea'
    );
  };

  private onDown = (e: PointerEvent) => {
    this.pressed = true;
    this.sfx.unlock();
    const t = e.target as HTMLElement | null;
    if (t?.closest(
      'a, button, [role="button"], .chip, .work-card, .menu-pill button, .menu-pill a, .nav-link, .mute-btn, .rail-btn, .np-close, .np-open'
    )) {
      this.sfx.play('click');
    }
  };
  private onUp = () => { this.pressed = false; };

  ngOnInit(): void {
    const fine = window.matchMedia('(pointer: fine)').matches;
    this.active = fine;
    if (!fine) return;
    document.documentElement.classList.add('custom-cursor-on');
    this.raf = requestAnimationFrame(this.tick);
    window.addEventListener('mousemove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', this.onDown, { passive: true, capture: true });
    window.addEventListener('pointerup', this.onUp, { passive: true });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    document.documentElement.classList.remove('custom-cursor-on');
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('pointerdown', this.onDown, true);
    window.removeEventListener('pointerup', this.onUp);
  }
}
