import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';

interface Milestone {
  year: string;
  title: string;
  description: string;
  color: string;
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
  @ViewChild('storyCanvas') canvasRef!: ElementRef<HTMLDivElement>;

  milestones: Milestone[] = [
    { year: '2022', title: 'First Steps', description: 'Began coding — discovered a passion for building software that solves real problems.', color: '#6366f1' },
    { year: '2023', title: 'CAPS & University', description: 'Joined CHRIST University and CAPS club — started shipping production systems for campus.', color: '#8b5cf6' },
    { year: '2024', title: 'ClassStream', description: 'Built a live education platform with DRM streaming, WebRTC, and real-time collaboration tools.', color: '#a78bfa' },
    { year: '2025', title: 'CAPS Automation', description: 'Cross-platform ops hub bridging GitHub and GitLab — automating club infrastructure at scale.', color: '#c084fc' },
    { year: '2026', title: 'Phone Proctor', description: 'AI-powered exam integrity with computer vision and distributed processing across worker nodes.', color: '#e879f9' },
    { year: 'Now', title: 'Full Stack at Scale', description: 'Deploying production systems on Kubernetes with ArgoCD, CI/CD, and auto-scaling.', color: '#f472b6' }
  ];

  activeIndex = 0;
  ready = false;
  totalMilestones = this.milestones.length;

  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private particles: any = null;
  private orbitGroups: any[] = [];
  private mouseX = 0;
  private mouseY = 0;
  private animId = 0;
  private destroyed = false;
  private T: any = null;
  private cameraZ = 6;
  private targetZ = 0;
  private locked = false;
  private transitionTimer: any = null;
  private touchStartY = 0;

  async ngAfterViewInit(): Promise<void> {
    try {
      this.T = await import('three');
      this.initScene();
      this.animate();
      window.addEventListener('resize', this.onResize);
      this.ready = true;
    } catch {
      // Three.js failed to load — timeline still works
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  @HostListener('wheel', ['$event'])
  onWheel(e: WheelEvent): void {
    if (!this.ready) return;
    const rect = this.sectionRef.nativeElement.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;
    if (this.locked) { e.preventDefault(); return; }
    if (e.deltaY > 0 && this.activeIndex < this.milestones.length - 1) {
      e.preventDefault(); this.advance(1);
    } else if (e.deltaY < 0 && this.activeIndex > 0) {
      e.preventDefault(); this.advance(-1);
    }
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent): void {
    if (!this.ready) return;
    const rect = this.sectionRef.nativeElement.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;
    this.touchStartY = e.touches[0].clientY;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent): void {
    if (!this.ready || this.locked) return;
    const rect = this.sectionRef.nativeElement.getBoundingClientRect();
    if (rect.top > window.innerHeight || rect.bottom < 0) return;
    const dy = this.touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) < 40) return;
    if (dy > 0 && this.activeIndex < this.milestones.length - 1) this.advance(1);
    else if (dy < 0 && this.activeIndex > 0) this.advance(-1);
  }

  goTo(index: number): void {
    if (this.locked || index === this.activeIndex) return;
    this.locked = true;
    this.activeIndex = index;
    this.targetZ = -index * 8;
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(() => { this.locked = false; }, 900);
  }

  private advance(dir: number): void {
    const next = this.activeIndex + dir;
    if (next < 0 || next >= this.milestones.length) return;
    this.locked = true;
    this.activeIndex = next;
    this.targetZ = -this.activeIndex * 8;
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(() => { this.locked = false; }, 900);
  }

  private initScene(): void {
    const T = this.T;
    const el = this.canvasRef.nativeElement;
    const w = el.clientWidth;
    const h = el.clientHeight;

    this.scene = new T.Scene();
    this.scene.fog = new T.FogExp2(0x000000, 0.008);

    this.camera = new T.PerspectiveCamera(60, w / h, 0.1, 200);
    this.camera.position.set(0, 0.5, 6);

    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 120;
      if (i % 3 === 2) pos[i] = (Math.random() - 0.5) * 80;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({
      color: 0x818cf8, size: 0.06, transparent: true, opacity: 0.6,
      blending: T.AdditiveBlending, sizeAttenuation: true,
    });
    this.particles = new T.Points(geo, mat);
    this.scene.add(this.particles);
  }

  private buildNodes(T: any): void {
    this.milestones.forEach((m, i) => {
      const z = -i * 8;
      const group = new T.Group();
      group.position.set(0, 0, z);

      const c = new T.Color(m.color);
      const sphere = new T.Mesh(
        new T.SphereGeometry(0.5, 24, 24),
        new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.6 })
      );
      group.add(sphere);

      const glow = new T.Mesh(
        new T.SphereGeometry(0.65, 16, 16),
        new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.15 })
      );
      group.add(glow);

      const ringMat = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.25, side: T.DoubleSide });
      const ring1 = new T.Mesh(new T.RingGeometry(0.8, 1, 48), ringMat);
      ring1.rotation.x = Math.PI / 3;
      ring1.position.y = 0.1;
      group.add(ring1);

      const ring2 = new T.Mesh(new T.RingGeometry(0.8, 1, 48), ringMat.clone());
      ring2.rotation.x = -Math.PI / 4;
      ring2.rotation.z = Math.PI / 5;
      ring2.position.y = -0.1;
      group.add(ring2);

      const starCount = 60;
      const starPos = new Float32Array(starCount * 3);
      for (let j = 0; j < starCount * 3; j++) {
        const r = 0.6 + Math.random() * 0.8;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 2;
        if (j % 3 === 0) starPos[j] = r * Math.sin(theta) * Math.cos(phi);
        else if (j % 3 === 1) starPos[j] = r * Math.sin(theta) * Math.sin(phi);
        else starPos[j] = r * Math.cos(theta);
      }
      const starGeo = new T.BufferGeometry();
      starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
      const stars = new T.Points(starGeo, new T.PointsMaterial({
        color: c, size: 0.035, transparent: true, opacity: 0.6, blending: T.AdditiveBlending,
      }));
      group.add(stars);

      this.scene.add(group);
      this.orbitGroups.push({ group, ring1, ring2, phase: Math.random() * Math.PI * 2 });
    });
  }

  private animate = (): void => {
    if (this.destroyed) return;
    this.animId = requestAnimationFrame(this.animate);

    this.cameraZ += (6 + this.targetZ - this.cameraZ) * 0.08;
    this.camera.position.z = this.cameraZ;
    this.camera.position.x += (this.mouseX * 1.2 - this.camera.position.x) * 0.03;
    this.camera.position.y += (this.mouseY * 0.6 + 0.5 - this.camera.position.y) * 0.03;
    this.camera.lookAt(0, 0, this.targetZ);

    this.particles.rotation.y += 0.0003;

    this.orbitGroups.forEach((o, i) => {
      const dist = Math.abs(-i * 8 - this.cameraZ);
      const near = Math.max(0, 1 - dist / 12);
      const s = 1 + near * 0.4;
      o.group.scale.set(s, s, s);
      o.ring1.rotation.z += 0.01 + near * 0.02;
      o.ring2.rotation.x += 0.008 + near * 0.015;
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.002 + o.phase);
      o.group.children[1].scale.set(pulse, pulse, pulse);
      if (i === this.activeIndex) {
        const ap = 1 + 0.15 * Math.sin(Date.now() * 0.003);
        o.group.children[0].scale.set(ap, ap, ap);
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
