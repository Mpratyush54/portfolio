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
  @ViewChild('sectionEl') sectionRef!: ElementRef<HTMLElement>;

  milestones: Milestone[] = [
    { year: '2022', title: 'First Steps', description: 'Began coding — discovered a passion for building software that solves real problems.', color: 0x6366f1 },
    { year: '2023', title: 'CAPS & University', description: 'Joined CHRIST University and CAPS club — started shipping production systems for campus.', color: 0x8b5cf6 },
    { year: '2024', title: 'ClassStream', description: 'Built a live education platform with DRM streaming, WebRTC, and real-time collaboration tools.', color: 0xa78bfa },
    { year: '2025', title: 'CAPS Automation', description: 'Cross-platform ops hub bridging GitHub and GitLab — automating club infrastructure at scale.', color: 0xc084fc },
    { year: '2026', title: 'Phone Proctor', description: 'AI-powered exam integrity with computer vision and distributed processing across worker nodes.', color: 0xe879f9 },
    { year: 'Now', title: 'Full Stack at Scale', description: 'Deploying production systems on Kubernetes with ArgoCD, CI/CD, and auto-scaling.', color: 0xf472b6 }
  ];

  activeIndex = 0;
  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private particles: any = null;
  private nodeGroup: any = null;
  private orbitGroups: any[] = [];
  private mouseX = 0;
  private mouseY = 0;
  private animId = 0;
  private destroyed = false;
  private T: any = null;
  private scrollProgress = 0;
  private targetZ = 0;

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
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  private onScroll = (): void => {
    const el = this.sectionRef.nativeElement;
    const rect = el.getBoundingClientRect();
    const sectionHeight = el.offsetHeight;
    const viewH = window.innerHeight;
    const offset = viewH - rect.top;
    this.scrollProgress = Math.max(0, Math.min(1, offset / (sectionHeight + viewH)));
    this.targetZ = -this.scrollProgress * (this.milestones.length - 1) * 8;
    const idx = Math.round(this.scrollProgress * (this.milestones.length - 1));
    this.activeIndex = Math.min(this.milestones.length - 1, Math.max(0, idx));
  };

  private initScene(): void {
    const T = this.T;
    const el = this.canvasRef.nativeElement;
    const w = el.clientWidth;
    const h = el.clientHeight;

    this.scene = new T.Scene();

    this.camera = new T.PerspectiveCamera(60, w / h, 0.1, 200);
    this.camera.position.set(0, 0.5, 6);

    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    el.appendChild(this.renderer.domElement);

    this.buildParticles(T);
    this.buildNodes(T);

    const ambient = new T.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambient);
    const dir = new T.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);
    const dir2 = new T.DirectionalLight(0x818cf8, 0.8);
    dir2.position.set(-5, -5, -5);
    this.scene.add(dir2);
  }

  private buildParticles(T: any): void {
    const count = 3000;
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 120;
      if (i % 3 === 2) pos[i] = (Math.random() - 0.5) * 80;
    }
    for (let i = 0; i < count; i++) sizes[i] = Math.random() * 0.12 + 0.02;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('size', new T.BufferAttribute(sizes, 1));
    const mat = new T.PointsMaterial({
      color: 0x818cf8,
      size: 0.06,
      transparent: true,
      opacity: 0.6,
      blending: T.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.particles = new T.Points(geo, mat);
    this.scene.add(this.particles);
  }

  private buildNodes(T: any): void {
    this.milestones.forEach((m, i) => {
      const z = -i * 8;
      const group = new T.Group();
      group.position.set(0, 0, z);

      const sphereGeo = new T.SphereGeometry(0.5, 24, 24);
      const sphereMat = new T.MeshStandardMaterial({
        color: m.color,
        emissive: m.color,
        emissiveIntensity: 0.3,
        roughness: 0.2,
        metalness: 0.6,
      });
      const sphere = new T.Mesh(sphereGeo, sphereMat);
      group.add(sphere);

      const glowGeo = new T.SphereGeometry(0.65, 16, 16);
      const glowMat = new T.MeshBasicMaterial({
        color: m.color,
        transparent: true,
        opacity: 0.15,
      });
      const glow = new T.Mesh(glowGeo, glowMat);
      group.add(glow);

      const ringGeo = new T.RingGeometry(0.8, 1, 48);
      const ringMat = new T.MeshBasicMaterial({
        color: m.color,
        transparent: true,
        opacity: 0.25,
        side: T.DoubleSide,
      });
      const ring = new T.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 3;
      ring.position.y = 0.1;
      group.add(ring);

      const ring2 = ring.clone();
      ring2.rotation.x = -Math.PI / 4;
      ring2.rotation.z = Math.PI / 5;
      ring2.position.y = -0.1;
      group.add(ring2);

      const starCount = 60;
      const starPos = new Float32Array(starCount * 3);
      for (let j = 0; j < starCount * 3; j++) {
        const r = 0.8 + Math.random() * 0.6;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 2;
        if (j % 3 === 0) starPos[j] = r * Math.sin(theta) * Math.cos(phi);
        else if (j % 3 === 1) starPos[j] = r * Math.sin(theta) * Math.sin(phi);
        else starPos[j] = r * Math.cos(theta);
      }
      const starGeo = new T.BufferGeometry();
      starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
      const starMat = new T.PointsMaterial({
        color: m.color,
        size: 0.035,
        transparent: true,
        opacity: 0.6,
        blending: T.AdditiveBlending,
      });
      const stars = new T.Points(starGeo, starMat);
      group.add(stars);

      this.scene.add(group);
      this.orbitGroups.push({ group, ring1: ring, ring2, stars, phase: Math.random() * Math.PI * 2 });
    });
  }

  private animate = (): void => {
    if (this.destroyed) return;
    this.animId = requestAnimationFrame(this.animate);

    const T = this.T;

    this.camera.position.z += (6 + this.targetZ - this.camera.position.z) * 0.06;
    this.camera.position.x += (this.mouseX * 1.2 - this.camera.position.x) * 0.03;
    this.camera.position.y += (this.mouseY * 0.6 + 0.5 - this.camera.position.y) * 0.03;
    this.camera.lookAt(0, 0, this.targetZ);

    this.particles.rotation.y += 0.0003;
    this.particles.rotation.x += 0.0001;

    this.orbitGroups.forEach((o, i) => {
      const distToCamera = Math.abs(-i * 8 - this.camera.position.z);
      const nearFactor = Math.max(0, 1 - distToCamera / 12);
      const scale = 1 + nearFactor * 0.4;
      o.group.scale.set(scale, scale, scale);

      o.ring1.rotation.z += 0.01;
      o.ring2.rotation.x += 0.008;

      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.002 + o.phase);
      o.group.children[1].scale.set(pulse, pulse, pulse);

      if (i === this.activeIndex) {
        const activePulse = 1 + 0.15 * Math.sin(Date.now() * 0.003);
        o.group.children[0].scale.set(activePulse, activePulse, activePulse);
      } else {
        o.group.children[0].scale.set(1, 1, 1);
      }
    });

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
