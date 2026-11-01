import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';

interface Milestone {
  year: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-story-section',
  standalone: true,
  imports: [],
  templateUrl: './story-section.html',
  styleUrl: './story-section.scss'
})
export class StorySectionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sectionEl') sectionRef!: ElementRef<HTMLElement>;
  @ViewChild('stickyEl') stickyRef!: ElementRef<HTMLElement>;

  milestones: Milestone[] = [
    { year: '2022', title: 'First Steps', description: 'Began coding — discovered a passion for building software that solves real problems.' },
    { year: '2023', title: 'CAPS & University', description: 'Joined CHRIST University and CAPS club — started shipping production systems for campus.' },
    { year: '2024', title: 'ClassStream', description: 'Built a live education platform with DRM streaming, WebRTC, and real-time collaboration tools.' },
    { year: '2025', title: 'CAPS Automation', description: 'Cross-platform ops hub bridging GitHub and GitLab — automating club infrastructure at scale.' },
    { year: '2026', title: 'Phone Proctor', description: 'AI-powered exam integrity with computer vision and distributed processing across worker nodes.' },
    { year: 'Now', title: 'Full Stack at Scale', description: 'Deploying production systems on Kubernetes with ArgoCD, CI/CD, and auto-scaling.' }
  ];

  activeIndex = 0;
  nextIndex = 0;
  progress = 0;
  parallaxY = 0;
  totalMilestones = this.milestones.length;

  private destroyed = false;

  ngAfterViewInit(): void {
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    window.removeEventListener('scroll', this.onScroll);
  }

  private onScroll = (): void => {
    const el = this.sectionRef.nativeElement;
    const rect = el.getBoundingClientRect();
    const sectionH = el.offsetHeight;
    const viewH = window.innerHeight;
    const stickyH = viewH;

    const totalScroll = sectionH - stickyH;
    const scrolled = -rect.top;
    const raw = Math.max(0, Math.min(1, scrolled / totalScroll));

    const idx = raw * (this.milestones.length - 1);
    this.activeIndex = Math.min(this.milestones.length - 1, Math.max(0, Math.floor(idx)));
    this.nextIndex = Math.min(this.milestones.length - 1, this.activeIndex + 1);
    this.progress = idx - this.activeIndex;

    this.parallaxY = raw * 120;
  };
}
