import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-hero-scene',
  standalone: true,
  imports: [],
  templateUrl: './hero-scene.html',
  styleUrl: './hero-scene.scss'
})
export class HeroSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sceneEl') canvasRef!: ElementRef<HTMLDivElement>;

  @Output() ready = new EventEmitter<void>();

  speechText = '';
  showSpeech = false;
  waveLoop = false;

  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private robot: any = null;
  private head: any = null;
  private leftEye: any = null;
  private rightEye: any = null;
  private antennaBall: any = null;
  private leftArm: any = null;
  private rightArm: any = null;
  private body: any = null;
  private platform: any = null;
  private particles: any = null;
  private orbitGroup1: any = null;
  private orbitGroup2: any = null;
  private mouseX = 0;
  private mouseY = 0;
  private animId = 0;
  private destroyed = false;
  private T: any = null;
  private time = 0;
  private waveTimer: any = null;
  private speechTimer: any = null;

  phrases = [
    'Hey, I\'m Bud!',
    'I know everything about Pratyush\'s work.',
    'Check out his projects!',
    'Press L for the terminal.',
    'Built with Angular + Three.js',
  ];

  async ngAfterViewInit(): Promise<void> {
    try {
      this.T = await import('three');
      this.initScene();
      this.animate();
      window.addEventListener('resize', this.onResize);
      setTimeout(() => this.ready.emit(), 200);
      setTimeout(() => this.doWave(), 1500);
      setTimeout(() => this.showRandomPhrase(), 3000);
    } catch {}
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
    if (this.waveTimer) clearTimeout(this.waveTimer);
    if (this.speechTimer) clearTimeout(this.speechTimer);
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    const rect = this.canvasRef?.nativeElement?.getBoundingClientRect();
    if (!rect) return;
    this.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  interact(): void {
    this.doWave();
    this.showRandomPhrase();
  }

  private doWave(): void {
    if (this.waveTimer) clearTimeout(this.waveTimer);
    this.waveLoop = true;
    this.waveTimer = setTimeout(() => { this.waveLoop = false; }, 2000);
  }

  private showRandomPhrase(): void {
    const p = this.phrases[Math.floor(Math.random() * this.phrases.length)];
    this.speechText = p;
    this.showSpeech = true;
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(() => { this.showSpeech = false; }, 4000);
  }

  private initScene(): void {
    const T = this.T;
    const el = this.canvasRef.nativeElement;
    const w = el.clientWidth;
    const h = el.clientHeight;

    this.scene = new T.Scene();
    this.scene.fog = new T.FogExp2(0x0a0a14, 0.025);

    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 1.5, 5.5);
    this.camera.lookAt(0, 0.5, 0);

    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);

    this.buildPlatform(T);
    this.buildRobot(T);
    this.buildOrbitals(T);
    this.buildParticles(T);

    const ambient = new T.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);
    const key = new T.DirectionalLight(0xffffff, 1.8);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.width = 512;
    key.shadow.mapSize.height = 512;
    this.scene.add(key);
    const fill = new T.DirectionalLight(0x818cf8, 0.6);
    fill.position.set(-3, 2, 4);
    this.scene.add(fill);
    const rim = new T.DirectionalLight(0x6366f1, 0.4);
    rim.position.set(0, -2, -6);
    this.scene.add(rim);
  }

  private buildPlatform(T: any): void {
    const geo = new T.CircleGeometry(2.2, 32);
    const mat = new T.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.7,
      metalness: 0.2,
      transparent: true,
      opacity: 0.6,
      side: T.DoubleSide,
    });
    this.platform = new T.Mesh(geo, mat);
    this.platform.rotation.x = -Math.PI / 2;
    this.platform.position.y = -0.6;
    this.platform.receiveShadow = true;
    this.scene.add(this.platform);

    const ringGeo = new T.RingGeometry(2.3, 2.5, 48);
    const ringMat = new T.MeshBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.15,
      side: T.DoubleSide,
    });
    const ring = new T.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.55;
    this.scene.add(ring);

    const gridHelper = new T.GridHelper(5, 12, 0x818cf8, 0x6366f1);
    gridHelper.position.y = -0.55;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.15;
    this.scene.add(gridHelper);
  }

  private buildRobot(T: any): void {
    this.robot = new T.Group();
    this.robot.position.y = 0;
    this.robot.castShadow = true;

    this.body = new T.Mesh(
      new T.BoxGeometry(0.9, 1.0, 0.6),
      new T.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4, metalness: 0.3 })
    );
    this.body.position.y = 0;
    this.body.castShadow = true;
    this.robot.add(this.body);

    this.head = new T.Mesh(
      new T.SphereGeometry(0.42, 20, 20),
      new T.MeshStandardMaterial({ color: 0x312e81, roughness: 0.3, metalness: 0.4 })
    );
    this.head.position.y = 0.75;
    this.head.castShadow = true;
    this.robot.add(this.head);

    const eyeMat = new T.MeshStandardMaterial({ color: 0x818cf8, emissive: 0x818cf8, emissiveIntensity: 0.8 });
    const eyeGeo = new T.SphereGeometry(0.09, 10, 10);
    this.leftEye = new T.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.15, 0.82, 0.38);
    this.robot.add(this.leftEye);
    this.rightEye = new T.Mesh(eyeGeo.clone(), eyeMat);
    this.rightEye.position.set(0.15, 0.82, 0.38);
    this.robot.add(this.rightEye);

    const mouthGeo = new T.BoxGeometry(0.2, 0.04, 0.05);
    const mouthMat = new T.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x6366f1, emissiveIntensity: 0.3 });
    const mouth = new T.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 0.68, 0.4);
    this.robot.add(mouth);

    const antennaMat = new T.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.2, metalness: 0.6 });
    const antenna = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.3, 6), antennaMat);
    antenna.position.set(0, 1.1, 0);
    this.robot.add(antenna);
    this.antennaBall = new T.Mesh(
      new T.SphereGeometry(0.06, 8, 8),
      new T.MeshStandardMaterial({ color: 0x818cf8, emissive: 0x818cf8, emissiveIntensity: 1 })
    );
    this.antennaBall.position.set(0, 1.25, 0);
    this.robot.add(this.antennaBall);

    const armMat = new T.MeshStandardMaterial({ color: 0x312e81, roughness: 0.4, metalness: 0.3 });
    this.leftArm = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 0.5, 6), armMat);
    this.leftArm.position.set(-0.55, 0.15, 0);
    this.leftArm.rotation.z = 0.3;
    this.leftArm.rotation.x = -0.2;
    this.leftArm.castShadow = true;
    this.robot.add(this.leftArm);

    this.rightArm = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 0.5, 6), armMat);
    this.rightArm.position.set(0.55, 0.15, 0);
    this.rightArm.rotation.z = -0.3;
    this.rightArm.rotation.x = 0.2;
    this.rightArm.castShadow = true;
    this.robot.add(this.rightArm);

    this.scene.add(this.robot);
  }

  private buildOrbitals(T: any): void {
    const colors = [0x6366f1, 0x8b5cf6, 0xa78bfa];
    for (let i = 0; i < 3; i++) {
      const g = new T.Group();
      const size = 0.12 + Math.random() * 0.1;
      const mesh = new T.Mesh(
        new T.IcosahedronGeometry(size, 0),
        new T.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.5 })
      );
      g.add(mesh);
      const angle = (i / 3) * Math.PI * 2;
      const radius = 1.8 + Math.random() * 0.3;
      g.position.set(Math.cos(angle) * radius, -0.3 + Math.random() * 0.3, Math.sin(angle) * radius);
      this.scene.add(g);
      if (i === 0) this.orbitGroup1 = { group: g, angle, radius, speed: 0.3 + Math.random() * 0.2 };
      else if (i === 1) this.orbitGroup2 = { group: g, angle, radius, speed: 0.2 + Math.random() * 0.2 };
    }
  }

  private buildParticles(T: any): void {
    const count = 500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 20;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({
      color: 0x818cf8, size: 0.04, transparent: true, opacity: 0.4,
      blending: T.AdditiveBlending, sizeAttenuation: true,
    });
    this.particles = new T.Points(geo, mat);
    this.particles.position.y = 8;
    this.scene.add(this.particles);
  }

  private animate = (): void => {
    if (this.destroyed) return;
    this.animId = requestAnimationFrame(this.animate);
    this.time += 0.016;

    const bob = Math.sin(this.time * 1.5) * 0.06;
    this.robot.position.y = bob;

    const headX = this.mouseY * 0.2;
    const headY = this.mouseX * 0.25;
    this.head.rotation.x = headX;
    this.head.rotation.y = headY;
    this.leftEye.position.x = -0.15 + this.mouseX * 0.02;
    this.leftEye.position.y = 0.82 - this.mouseY * 0.02;
    this.rightEye.position.x = 0.15 + this.mouseX * 0.02;
    this.rightEye.position.y = 0.82 - this.mouseY * 0.02;

    this.antennaBall.material.emissiveIntensity = 0.6 + Math.sin(this.time * 2.5) * 0.4;

    if (this.waveLoop) {
      this.leftArm.rotation.z = 0.3 + Math.sin(this.time * 6) * 0.5;
      this.leftArm.rotation.x = -0.2 + Math.sin(this.time * 6) * 0.3;
    } else {
      this.leftArm.rotation.z += (0.3 - this.leftArm.rotation.z) * 0.05;
      this.leftArm.rotation.x += (-0.2 - this.leftArm.rotation.x) * 0.05;
    }
    this.rightArm.rotation.z += (-0.3 - this.rightArm.rotation.z) * 0.05;
    this.rightArm.rotation.x += (0.2 - this.rightArm.rotation.x) * 0.05;

    if (this.orbitGroup1) {
      this.orbitGroup1.angle += 0.005 * this.orbitGroup1.speed;
      this.orbitGroup1.group.position.x = Math.cos(this.orbitGroup1.angle) * this.orbitGroup1.radius;
      this.orbitGroup1.group.position.z = Math.sin(this.orbitGroup1.angle) * this.orbitGroup1.radius;
    }
    if (this.orbitGroup2) {
      this.orbitGroup2.angle += 0.005 * this.orbitGroup2.speed;
      this.orbitGroup2.group.position.x = Math.cos(this.orbitGroup2.angle) * this.orbitGroup2.radius;
      this.orbitGroup2.group.position.z = Math.sin(this.orbitGroup2.angle) * this.orbitGroup2.radius;
    }

    this.particles.rotation.y += 0.0005;

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
