import { Component, OnInit, OnDestroy, ViewChild, inject, effect, HostListener } from '@angular/core';
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
  @ViewChild(HeroSceneComponent) heroScene!: HeroSceneComponent;

  private api = inject(ApiService);
  private bud = inject(BudEventsService);
  private shell = inject(ShellService);
  private router = inject(Router);
  private sfx = inject(SfxService);
  ask = inject(AskService);
  private sanitizer = inject(DomSanitizer);

  loading = true;
  stageReady = false;
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
    { date: '2025 — Now', company: 'CAPS', role: 'Tech Lead' },
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

  constructor() {
    effect(() => {
      const v = this.shell.view();
      if (this.stageReady) {
        this.heroScene?.setMood(v);
        this.syncPhoneRobot(v);
      }
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.stageReady) this.syncPhoneRobot(this.shell.view());
  }

  workScrolled = false;

  onWorkScroll(ev: Event): void {
    const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    if (!phone) {
      this.workScrolled = false;
      return;
    }
    const el = ev.target as HTMLElement;
    this.workScrolled = el.scrollTop > 10;
  }

  /** Phone: pause/hide Bud everywhere except Home. */
  private syncPhoneRobot(v: ShellView): void {
    const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    this.heroScene?.setPaused(phone && v !== 'home');
    if (v !== 'work') this.workScrolled = false;
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
  }

  ngOnDestroy(): void {
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
  }

  onLoading(v: boolean): void {
    this.loading = v;
  }

  onReady(): void {
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
