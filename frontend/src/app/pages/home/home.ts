import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeroSceneComponent } from '../../components/hero-scene/hero-scene';
import { ProjectCardComponent } from '../../components/project-card/project-card';
import { ContactFormComponent } from '../../components/contact-form/contact-form';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/project.model';

interface StoryBeat {
  id: string;
  speech: string;
  anim: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, HeroSceneComponent, ProjectCardComponent, ContactFormComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(HeroSceneComponent) heroScene!: HeroSceneComponent;

  private apiService = inject(ApiService);
  private observer?: IntersectionObserver;
  activeSection = 'hero';

  featuredProjects: Project[] = [];
  projectsLoading = true;

  private beats: StoryBeat[] = [
    { id: 'hero', speech: "i'm bud — i know everything about pratyush.", anim: 'Wave' },
    { id: 'about', speech: 'he builds backends, leads teams, ships real systems.', anim: 'ThumbsUp' },
    { id: 'projects', speech: "here's what he's shipped. pick one to dig in.", anim: 'Idle' },
    { id: 'contact', speech: 'want to reach him? leave a note — he replies fast.', anim: 'Wave' },
  ];

  private fallbackProjects: Project[] = [
    {
      _id: 'classstream',
      title: 'ClassStream — Live Education Platform',
      shortDescription: 'Live education with DRM streaming, WebRTC classes, and quizzes for 500+ concurrent users.',
      fullDescription: '',
      features: [],
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
      fullDescription: '',
      features: [],
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
      shortDescription: 'DevOps automation: CI/CD, provisioning, and monitoring for campus apps.',
      fullDescription: '',
      features: [],
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
      fullDescription: '',
      features: [],
      tags: ['Python', 'OpenCV', 'Kotlin', 'WebSocket'],
      category: 'Mobile',
      source: 'github',
      status: { phase: 'Development', ciStatus: 'Passing' },
      timeline: { start: '2026-02', history: [] },
    },
  ];

  ngOnInit() {
    this.featuredProjects = this.fallbackProjects.slice(0, 4);
    this.projectsLoading = false;
    this.apiService.getProjects().subscribe({
      next: (data) => {
        if (data?.length) this.featuredProjects = data.slice(0, 4);
      },
      error: () => {}
    });
  }

  ngAfterViewInit(): void {
    // Initial narration after robot loads
    setTimeout(() => this.applyBeat('hero'), 1800);

    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = (visible.target as HTMLElement).dataset['beat'];
        if (id) this.applyBeat(id);
      },
      { root: null, threshold: [0.35, 0.55], rootMargin: '-10% 0px -25% 0px' }
    );

    document.querySelectorAll('[data-beat]').forEach(el => this.observer!.observe(el));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private applyBeat(id: string): void {
    if (this.activeSection === id) return;
    this.activeSection = id;
    const beat = this.beats.find(b => b.id === id);
    if (beat) this.heroScene?.narrate(beat.speech, beat.anim);
  }

  triggerQnA(key: string): void {
    this.heroScene?.triggerQnA(key);
  }

  toggleChat(): void {
    this.heroScene?.toggleChat();
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
