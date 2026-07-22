import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';

interface Milestone {
  year: string;
  title: string;
  description: string;
  color: number;
}

@Component({
  selector: 'app-story-section',
  standalone: true,
  imports: [],
  templateUrl: './story-section.html',
  styleUrl: './story-section.scss'
})
export class StorySectionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('storyCanvas') canvasRef!: ElementRef<HTMLDivElement>;

  milestones: Milestone[] = [
    { year: '2022', title: 'First Steps', description: 'Began coding — discovered a passion for building software that solves real problems.', color: 0x6366f1 },
    { year: '2023', title: 'CAPS & University', description: 'Joined CHRIST University and CAPS club — started shipping production systems for campus.', color: 0x8b5cf6 },
    { year: '2024', title: 'ClassStream', description: 'Built a live education platform with DRM streaming, WebRTC, and real-time collaboration tools.', color: 0xa78bfa },
    { year: '2025', title: 'CAPS Automation', description: 'Cross-platform ops hub bridging GitHub and GitLab — automating club infrastructure at scale.', color: 0xc084fc },
    { year: '2026', title: 'Phone Proctor', description: 'AI-powered exam integrity with computer vision and distributed processing across worker nodes.', color: 0xe879f9 },
    { year: 'Now', title: 'Full Stack at Scale', description: 'Deploying production systems on Kubernetes with ArgoCD, CI/CD, and auto-scaling.', color: 0xf472b6 }
  ];

  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private particles: any = null;
  private mainShape: any = null;
  private mouseX = 0;
  private mouseY = 0;
  private animId = 0;
  private destroyed = false;
  private T: any = null;
  private scrollFact = 0;

  async ngAfterViewInit(): Promise<void> {
    this.T = await import('three');
    this.initScene();
    this.animate();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('scroll', this.onScroll);
    if (this.mainShape) { this.mainShape.geometry.dispose(); this.mainShape.material.dispose(); }
    if (this.particles) { this.particles.geometry.dispose(); this.particles.material.dispose(); }
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  private onScroll = (): void => {
    const el = this.canvasRef.nativeElement;
    const rect = el.getBoundingClientRect();
    const secH = el.offsetHeight;
    const viewH = window.innerHeight;
    const offset = viewH - rect.top;
    this.scrollFact = Math.max(-0.2, Math.min(1.2, offset / (secH + viewH)));
  };

  private initScene(): void {
    const T = this.T;
    const el = this.canvasRef.nativeElement;
    const w = el.clientWidth;
    const h = el.clientHeight;

    this.scene = new T.Scene();

    this.camera = new T.PerspectiveCamera(60, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 8);

    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(this.renderer.domElement);

    const geo = new T.IcosahedronGeometry(1.4, 1);
    const mat = new T.MeshStandardMaterial({
      color: 0x6366f1,
      roughness: 0.3,
      metalness: 0.5,
      wireframe: true,
      emissive: 0x6366f1,
      emissiveIntensity: 0.1,
    });
    this.mainShape = new T.Mesh(geo, mat);
    this.scene.add(this.mainShape);

    const count = 2000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 40;
    const pg = new T.BufferGeometry();
    pg.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pm = new T.PointsMaterial({
      color: 0x818cf8,
      size: 0.05,
      transparent: true,
      opacity: 0.5,
      blending: T.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.particles = new T.Points(pg, pm);
    this.scene.add(this.particles);

    const amb = new T.AmbientLight(0xffffff, 0.4);
    this.scene.add(amb);
    const dl = new T.DirectionalLight(0xffffff, 1.2);
    dl.position.set(5, 10, 7);
    this.scene.add(dl);
  }

  private animate = (): void => {
    if (this.destroyed) return;
    this.animId = requestAnimationFrame(this.animate);

    const T = this.T;
    this.mainShape.rotation.x += 0.003;
    this.mainShape.rotation.y += 0.007;
    this.mainShape.rotation.z += 0.001;

    const s = 1 + Math.sin(Date.now() * 0.001) * 0.04;
    this.mainShape.scale.set(s, s, s);

    this.particles.rotation.y += 0.0003;

    const px = this.mouseX * 1.5;
    const py = this.mouseY * 0.8;
    this.camera.position.x += (px - this.camera.position.x) * 0.03;
    this.camera.position.y += (py - this.camera.position.y) * 0.03;
    this.camera.lookAt(0, 0, 0);

    const colorIdx = Math.floor(this.scrollFact * this.milestones.length);
    const idx = Math.max(0, Math.min(this.milestones.length - 1, colorIdx));
    const c = new T.Color(this.milestones[idx].color);
    this.mainShape.material.color.lerp(c, 0.04);
    this.mainShape.material.emissive.lerp(c, 0.04);

    this.renderer.render(this.scene, this.camera);
  };

  private onResize = (): void => {
    const el = this.canvasRef?.nativeElement;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
