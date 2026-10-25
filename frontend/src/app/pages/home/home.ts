import { Component, OnInit, OnDestroy, ViewChild, inject, effect, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { HeroSceneComponent } from '../../components/hero-scene/hero-scene';
import { WorkCardComponent } from '../../components/work-card/work-card';
import { ProjectOverlayComponent } from '../../components/project-overlay/project-overlay';
import { ContactFormComponent } from '../../components/contact-form/contact-form';
import { AskConsoleComponent } from '../../components/ask-console/ask-console';
import { ApiService } from '../../services/api.service';
import { BudEventsService } from '../../services/bud-events.service';
import { ShellService, ShellView } from '../../services/shell.service';
import { SfxService } from '../../services/sfx.service';
import { AskService } from '../../services/ask.service';
import { NetworkPerfService } from '../../services/network-perf.service';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    HeroSceneComponent,
    WorkCardComponent,
    ProjectOverlayComponent,
    ContactFormComponent,
    AskConsoleComponent,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild(HeroSceneComponent) heroScene?: HeroSceneComponent;

  private api = inject(ApiService);
  private bud = inject(BudEventsService);
  private shell = inject(ShellService);
  private router = inject(Router);
  private sfx = inject(SfxService);
  private net = inject(NetworkPerfService);
  ask = inject(AskService);
  private sanitizer = inject(DomSanitizer);

  /** Soft robot indicator only — never blocks the shell. */
  loading = signal(false);
  /** Shell is interactive immediately (Slow-4G friendly). */
  stageReady = true;
  /** Mount Three.js after landing shell paints — never blocks first view. */
  enable3d = false;
  /** Only Save-Data: show tap CTA (everyone else auto-loads Bud in the background). */
  needsBudOptIn = false;
  /** Always allow intro; hero-scene skips walk when the GLB is already Cache-API warm. */
  playIntro = true;
  muted = false;
  playMode = false;
  randomMode = false;
  showNowPlaying = false;
  projects: Project[] = [];
  projectsLoading = true;

  /** Classy “last played” — Miles Davis · Kind of Blue. */
  nowPlaying = {
    title: 'Kind of Blue',
    artist: 'Miles Davis',
    note: 'last played · late night coding',
    spotifyUrl: 'https://open.spotify.com/album/1weenld61qoidwYuZ1GESA',
    embedUrl: 'https://open.spotify.com/embed/album/1weenld61qoidwYuZ1GESA?utm_source=generator&theme=0',
  };
  spotifyEmbed: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.nowPlaying.embedUrl);

  career = [
    { date: '2025 — Now', company: 'CAPS', role: 'Team Lead' },
    { date: '2025', company: 'CAPS', role: 'Backend Developer' },
    { date: '2024 — Now', company: 'COE · CHRIST', role: 'Flutter Developer' },
    { date: '2022 — 2029', company: 'CHRIST University', role: 'B.Tech CSE' },
  ];

  private fallback: Project[] = [
    {
      _id: 'classstream',
      title: 'ClassStream — Live Education',
      shortDescription: 'DRM streaming, WebRTC classes, and quizzes for 500+ concurrent users.',
      fullDescription: 'A full-stack school platform with DRM-protected video, live classes, real-time chat, and collaborative tools. Built for CHRIST University.',
      features: ['DRM video streaming', 'WebRTC live classes', 'Real-time quizzes', 'Attendance tracking', 'Analytics dashboard'],
      tags: ['Angular', 'Node.js', 'WebRTC', 'MongoDB', 'Kubernetes'],
      category: 'Web',
      source: 'github',
      status: { phase: 'Production', ciStatus: 'Passing' },
      timeline: { start: '2024-01', history: [] },
      link: 'https://classstream.christuniversity.in',
    },
    {
      _id: 'platform-paas',
      title: 'Platform — Internal PaaS',
      shortDescription: 'Multi-SDK PaaS on Kubernetes with OAuth2 and automated CI/CD.',
      fullDescription: 'Internal platform-as-a-service with SDKs in Angular, React, Node, and Python. Runs on Kubernetes with OAuth2 SSO.',
      features: ['Multi-language SDKs', 'Kubernetes + OAuth2', 'Docker Compose parity', 'CI/CD'],
      tags: ['TypeScript', 'Python', 'Kubernetes', 'Docker'],
      category: 'DevOps',
      source: 'github',
      status: { phase: 'Development', ciStatus: 'Passing' },
      timeline: { start: '2026-06', history: [] },
      repo: 'https://github.com/Mpratyush54/server-automation',
    },
    {
      _id: 'caps-automation',
      title: 'CAPS — Campus Automation',
      shortDescription: 'CI/CD, provisioning, and monitoring for campus apps.',
      fullDescription: 'Campus automation platform for CAPS: server provisioning, pipelines, K8s deploys, and monitoring.',
      features: ['Server provisioning', 'CI/CD pipelines', 'K8s automation', 'Monitoring'],
      tags: ['Node.js', 'Kubernetes', 'Docker', 'GitHub Actions'],
      category: 'DevOps',
      source: 'github',
      status: { phase: 'Production', ciStatus: 'Passing' },
      timeline: { start: '2025-01', history: [] },
      repo: 'https://github.com/Mpratyush54/server-automation',
    },
    {
      _id: 'exam-protector',
      title: 'Exam Protector',
      shortDescription: 'Distributed AI proctoring with real-time computer vision.',
      fullDescription: 'Exam security system: Android monitors device activity while Python CV pipelines detect anomalies over WebSocket.',
      features: ['CV anomaly detection', 'WebSocket alerts', 'App-switch lock', 'Distributed workers'],
      tags: ['Python', 'OpenCV', 'Kotlin', 'WebSocket'],
      category: 'Mobile',
      source: 'github',
      status: { phase: 'Development', ciStatus: 'Passing' },
      timeline: { start: '2026-02', history: [] },
    },
  ];

  private sub: any;
  private destroyed = false;

  constructor() {
    effect(() => {
      const v = this.shell.view();
      if (this.stageReady) {
        this.heroScene?.setMood(v);
        this.syncPhoneRobot(v);
      }
      if (v === 'about') {
        this.placeStickersIfNeeded();
        // Desktop About: make sure Bud/human swap can run
        if (!this.net.isPhone() && !this.enable3d && !this.needsBudOptIn) {
          this.loadBud(false);
        }
      }
      if (v === 'contact') {
        this.placeContactStickersIfNeeded();
      }
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.stageReady) this.syncPhoneRobot(this.shell.view());
    if (this.dragId) return;
    if (this.shell.view() === 'about') this.placeStickersIfNeeded(true);
    if (this.shell.view() === 'contact') this.placeContactStickersIfNeeded(true);
  }

  workScrolled = false;

  /** Draggable About credentials — free anywhere on the about stage. */
  aboutStickers: {
    id: 'azure' | 'odoo';
    x: number;
    y: number;
    z: number;
    preview: 'left' | 'right' | 'below' | 'above';
    previewShift: number;
  }[] = [];
  /** Contact “worked with” — free-floating stickers like About credentials. */
  contactStickers: {
    id: 'dive' | 'caps';
    x: number;
    y: number;
    z: number;
    preview: 'left' | 'right' | 'below' | 'above';
    previewShift: number;
  }[] = [];
  stickersReady = false;
  contactStickersReady = false;
  dragId: 'azure' | 'odoo' | 'dive' | 'caps' | null = null;
  hoverId: 'azure' | 'odoo' | 'dive' | 'caps' | null = null;
  private dragOrigin = { x: 0, y: 0, sx: 0, sy: 0 };
  private stickerZ = 4;
  private stickersPlaced = false;
  private stickersUserMoved = false;
  private contactStickersPlaced = false;
  private contactStickersUserMoved = false;
  private boundStickerMove = (e: PointerEvent) => this.onStickerPointerMove(e);
  private boundStickerUp = () => this.endStickerDrag();

  /**
   * Seed stickers in the right gutter — clear of the centered robot/human.
   * Never place into the middle ~35–68% band where Bud stands.
   */
  private placeStickersIfNeeded(force = false): void {
    if (typeof window === 'undefined') return;
    if (this.stickersPlaced && !force) return;
    // Don't yank stickers back on resize after the user has dragged them
    if (force && this.stickersUserMoved) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const phone = w <= 640;
    const stickerW = phone ? 180 : 210;
    const rail = 120; // sound / orbit rail on the right
    // Far-right X — always past the robot's screen footprint
    const rightX = Math.max(24, w - stickerW - rail);
    // Default preview opens inward (left) since stickers start on the right
    const base = { preview: 'left' as const, previewShift: 0 };

    if (phone) {
      // Phone About: robot usually hidden; park below copy, not mid-stage
      this.aboutStickers = [
        { id: 'azure', x: 16, y: Math.max(h * 0.52, 280), z: 2, preview: 'below', previewShift: 0 },
        { id: 'odoo', x: Math.max(16, w - stickerW - 16), y: Math.max(h * 0.68, 400), z: 3, preview: 'above', previewShift: 0 },
      ];
    } else {
      this.aboutStickers = [
        { id: 'azure', x: rightX, y: 108, z: 2, ...base },
        { id: 'odoo', x: Math.max(24, rightX - 28), y: Math.min(h - 260, 340), z: 3, ...base },
      ];
    }
    this.stickersPlaced = true;
    this.stickersReady = true;
  }

  /** Seed Contact brand stickers freely — not locked in a sidebar or form block. */
  private placeContactStickersIfNeeded(force = false): void {
    if (typeof window === 'undefined') return;
    if (this.contactStickersPlaced && !force) return;
    if (force && this.contactStickersUserMoved) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const phone = w <= 640;
    const stickerW = phone ? 120 : 140;
    const base = { preview: 'left' as const, previewShift: 0 };

    if (phone) {
      this.contactStickers = [
        { id: 'dive', x: 16, y: Math.max(h * 0.58, 360), z: 2, preview: 'above', previewShift: 0 },
        { id: 'caps', x: Math.max(16, w - stickerW - 16), y: Math.max(h * 0.72, 450), z: 3, preview: 'above', previewShift: 0 },
      ];
    } else {
      const rail = 100;
      const rightX = Math.max(24, w - stickerW - rail);
      this.contactStickers = [
        { id: 'dive', x: rightX, y: 130, z: 2, ...base },
        { id: 'caps', x: Math.max(24, rightX - 16), y: Math.min(h - 200, 320), z: 3, ...base },
      ];
    }
    this.contactStickersPlaced = true;
    this.contactStickersReady = true;
  }

  private findSticker(id: 'azure' | 'odoo' | 'dive' | 'caps') {
    return (
      this.aboutStickers.find(st => st.id === id) ||
      this.contactStickers.find(st => st.id === id) ||
      null
    );
  }

  /** Pick left/right/above/below so the hover card stays inside the viewport. */
  private fitStickerPreview(
    el: HTMLElement,
    s: { id: string; preview: 'left' | 'right' | 'below' | 'above'; previewShift: number },
  ): void {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 12;
    const previewW = Math.min(280, vw * 0.7) + gap;
    const previewH = (s.id === 'odoo' ? 240 : s.id === 'dive' || s.id === 'caps' ? 90 : 200) + gap;
    const spaceRight = vw - r.right;
    const spaceLeft = r.left;
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;

    if (spaceRight >= previewW) {
      s.preview = 'right';
      s.previewShift = 0;
    } else if (spaceLeft >= previewW) {
      s.preview = 'left';
      s.previewShift = 0;
    } else if (spaceBelow >= previewH) {
      s.preview = 'below';
      s.previewShift = this.clampPreviewShift(r, previewW - gap, vw);
    } else if (spaceAbove >= previewH) {
      s.preview = 'above';
      s.previewShift = this.clampPreviewShift(r, previewW - gap, vw);
    } else {
      // Tight viewport: prefer the roomier side, still clamp horizontally
      s.preview = spaceRight >= spaceLeft ? 'right' : 'left';
      if (Math.max(spaceRight, spaceLeft) < previewW * 0.55) {
        s.preview = spaceBelow >= spaceAbove ? 'below' : 'above';
        s.previewShift = this.clampPreviewShift(r, previewW - gap, vw);
      } else {
        s.previewShift = 0;
      }
    }
  }

  /** Keep a centered above/below preview from spilling past the viewport edges. */
  private clampPreviewShift(r: DOMRect, previewW: number, vw: number): number {
    const pad = 12;
    const center = r.left + r.width / 2;
    let left = center - previewW / 2;
    if (left < pad) left = pad;
    if (left + previewW > vw - pad) left = Math.max(pad, vw - pad - previewW);
    return left - (center - previewW / 2);
  }

  onStickerEnter(ev: PointerEvent, id: 'azure' | 'odoo' | 'dive' | 'caps'): void {
    this.hoverId = id;
    const s = this.findSticker(id);
    const el = ev.currentTarget as HTMLElement | null;
    if (s && el) this.fitStickerPreview(el, s);
  }

  startStickerDrag(ev: PointerEvent, id: 'azure' | 'odoo' | 'dive' | 'caps'): void {
    if (this.net.isPhone() || window.matchMedia('(max-height: 600px)').matches) return;
    if ((ev.target as HTMLElement)?.closest?.('a')) return;
    ev.preventDefault();
    ev.stopPropagation();
    const s = this.findSticker(id);
    if (!s) return;
    this.dragId = id;
    this.hoverId = id;
    this.stickerZ += 1;
    s.z = this.stickerZ;
    this.dragOrigin = { x: ev.clientX, y: ev.clientY, sx: s.x, sy: s.y };
    window.addEventListener('pointermove', this.boundStickerMove, { passive: false });
    window.addEventListener('pointerup', this.boundStickerUp);
    window.addEventListener('pointercancel', this.boundStickerUp);
  }

  private onStickerPointerMove(ev: PointerEvent): void {
    if (!this.dragId) return;
    ev.preventDefault();
    const s = this.findSticker(this.dragId);
    if (!s) return;
    const dx = ev.clientX - this.dragOrigin.x;
    const dy = ev.clientY - this.dragOrigin.y;
    const maxX = Math.max(40, window.innerWidth - 80);
    const maxY = Math.max(40, window.innerHeight - 80);
    s.x = Math.min(maxX, Math.max(-40, this.dragOrigin.sx + dx));
    s.y = Math.min(maxY, Math.max(-20, this.dragOrigin.sy + dy));
  }

  endStickerDrag(): void {
    if (this.dragId === 'azure' || this.dragId === 'odoo') this.stickersUserMoved = true;
    if (this.dragId === 'dive' || this.dragId === 'caps') this.contactStickersUserMoved = true;
    this.dragId = null;
    window.removeEventListener('pointermove', this.boundStickerMove);
    window.removeEventListener('pointerup', this.boundStickerUp);
    window.removeEventListener('pointercancel', this.boundStickerUp);
  }

  onStickerLeave(id: 'azure' | 'odoo' | 'dive' | 'caps'): void {
    if (this.dragId === id) return;
    if (this.hoverId === id) this.hoverId = null;
  }

  onWorkScroll(ev: Event): void {
    const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    if (!phone) {
      this.workScrolled = false;
      return;
    }
    const el = ev.target as HTMLElement;
    this.workScrolled = el.scrollTop > 10;
  }

  /** Phone: pause Bud off Home; desktop keeps scene for About human swap. */
  private syncPhoneRobot(v: ShellView): void {
    const phone = this.net.isPhone();
    if (!this.enable3d || !this.heroScene) {
      if (v !== 'work') this.workScrolled = false;
      return;
    }
    if (!phone) {
      this.heroScene.ensureStarted();
      this.heroScene.setPaused(false);
      this.heroScene.setMood(v);
    } else if (v === 'home') {
      this.heroScene.ensureStarted();
      this.heroScene.setPaused(false);
    } else {
      this.heroScene.setPaused(true);
    }
    if (v !== 'work') this.workScrolled = false;
  }

  /** Explicit start (Save-Data tap, or resume when returning to Home). */
  loadBud(fromUser = true): void {
    if (this.enable3d) return;
    this.needsBudOptIn = false;
    this.enable3d = true;
    this.loading.set(true);
    if (fromUser) this.sfx.play('click');
    queueMicrotask(() => this.syncPhoneRobot(this.shell.view()));
  }

  /**
   * Landing is the entry point: paint copy + nav first, then warm Bud.
   * Slow-4G waits longer so the landing stays snappy; Save-Data waits for a tap.
   */
  private scheduleBudAutoLoad(): void {
    if (this.net.saveData()) {
      this.needsBudOptIn = true;
      return;
    }
    const delay = this.net.budStartDelayMs();
    this.net.whenIdle(() => {
      if (this.destroyed || this.enable3d) return;
      // Visitors land on Home — only start 3D while still on the landing
      if (this.shell.view() !== 'home') return;
      this.loadBud(false);
    }, delay);
  }

  get view(): ShellView {
    return this.shell.view();
  }

  get mood(): string {
    return this.shell.mood;
  }

  get activeProject(): Project | null {
    const id = this.shell.projectId();
    if (!id) return null;
    return this.projects.find(p => p._id === id) || null;
  }

  get activeProjectIndex(): number {
    const id = this.shell.projectId();
    if (!id) return 0;
    return Math.max(0, this.projects.findIndex(p => p._id === id));
  }

  ngOnInit(): void {
    this.stageReady = true;
    this.loading.set(false);
    this.projects = this.fallback;
    this.projectsLoading = false;
    this.api.getProjects().subscribe({
      next: (data) => {
        if (data?.length) this.projects = data;
      },
      error: () => {}
    });

    this.syncFromUrl();
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.syncFromUrl());
    this.scheduleBudAutoLoad();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.endStickerDrag();
    this.sub?.unsubscribe();
  }

  private syncFromUrl(): void {
    const path = this.router.url.split('?')[0];
    if (path.startsWith('/projects/') && path !== '/projects' && path !== '/projects/systems') {
      const id = path.split('/')[2];
      this.shell.openProject(id);
      return;
    }
    if (path.startsWith('/projects') || path === '/work') this.shell.setView('work');
    else if (path.startsWith('/about')) this.shell.setView('about');
    else if (path.startsWith('/contact')) this.shell.setView('contact');
    else this.shell.setView('home');
  }

  setView(v: ShellView): void {
    this.shell.setView(v);
    const path = v === 'home' ? '/' : v === 'work' ? '/projects' : `/${v}`;
    this.router.navigateByUrl(path, { replaceUrl: true });
    // Back to landing: start Bud if we deferred while they browsed
    if (v === 'home' && !this.enable3d && !this.needsBudOptIn) {
      this.net.whenIdle(() => {
        if (!this.destroyed && !this.enable3d && this.shell.view() === 'home') {
          this.loadBud(false);
        }
      }, this.net.isSlow() ? 600 : 200);
    }
  }

  openDiscovery(): void {
    this.sfx.play('open');
    this.shell.openDiscovery();
  }

  onLoading(v: boolean): void {
    // Soft indicator only — shell stays usable
    this.loading.set(v);
  }

  onReady(): void {
    this.loading.set(false);
    this.stageReady = true;
    this.shell.markIntroDone();
    this.heroScene?.setMood(this.shell.view());
    this.syncPhoneRobot(this.shell.view());
  }

  toggleMute(): void {
    this.muted = this.sfx.toggleMute();
  }

  togglePlayMode(): void {
    this.playMode = !this.playMode;
    this.sfx.play('click');
    this.heroScene?.setPlayMode(this.playMode);
  }

  toggleRandomMode(): void {
    this.randomMode = !this.randomMode;
    this.sfx.play('click');
    this.heroScene?.setRandomMode(this.randomMode);
  }

  toggleNowPlaying(): void {
    this.showNowPlaying = !this.showNowPlaying;
    this.sfx.play(this.showNowPlaying ? 'open' : 'click');
  }

  closeNowPlaying(): void {
    this.showNowPlaying = false;
  }

  toggleAsk(): void {
    this.sfx.play('open');
    this.ask.toggle();
  }

  triggerQnA(key: string): void {
    this.ask.show(key);
  }

  openProject(id: string): void {
    this.sfx.play('open');
    this.shell.openProject(id);
    this.router.navigateByUrl(`/projects/${id}`, { replaceUrl: true });
  }

  closeProject(): void {
    this.shell.closeProject();
    this.router.navigateByUrl('/projects', { replaceUrl: true });
  }

  prevProject(): void {
    const i = this.activeProjectIndex;
    const next = this.projects[(i - 1 + this.projects.length) % this.projects.length];
    if (next?._id) this.openProject(next._id);
  }

  nextProject(): void {
    const i = this.activeProjectIndex;
    const next = this.projects[(i + 1) % this.projects.length];
    if (next?._id) this.openProject(next._id);
  }

  onContactSuccess(): void {
    this.sfx.play('success');
    this.bud.celebrate();
  }

}
