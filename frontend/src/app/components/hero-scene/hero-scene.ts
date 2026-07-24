import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';

interface QAPair {
  key: string;
  question: string;
  answer: string;
}

@Component({
  selector: 'app-hero-scene',
  standalone: true,
  imports: [],
  templateUrl: './hero-scene.html',
  styleUrl: './hero-scene.scss'
})
export class HeroSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sceneEl') canvasRef!: ElementRef<HTMLDivElement>;

  speechText = '';
  showSpeech = false;
  chatOpen = false;
  messages: { type: 'q' | 'a'; text: string }[] = [];

  qaMap: Record<string, QAPair> = {
    who: { key: 'who', question: 'who is pratyush?', answer: 'I\'m <b>Pratyush Mishra</b> — Backend Engineer & Full Stack Dev. I build systems that scale. Clean architecture, automated deploys, great DX. When not coding: distributed systems, open source, planning the next project.' },
    built: { key: 'built', question: 'what has he built?', answer: '6+ projects — ClassStream (live edu with DRM/WebRTC), CAPS Automation, Phone Proctor (AI exam integrity), Ambue (pharma scanner), and more. Check <b>/projects</b>.' },
    work: { key: 'work', question: 'is he open to work?', answer: 'Yes — actively looking for <b>Backend Engineer</b> or <b>Full Stack</b> roles. Check <b>/resume</b> or head to <b>/contact</b>.' },
    stack: { key: 'stack', question: 'what is his tech stack?', answer: '<b>Backend:</b> Node.js, Express, Python, Go, Rust | <b>Frontend:</b> Angular, React, TypeScript | <b>DevOps:</b> Docker, Kubernetes, ArgoCD, Nginx, GitHub Actions | <b>DB:</b> MongoDB, MySQL, PostgreSQL' },
    experience: { key: 'experience', question: 'what is his experience?', answer: 'Started coding in <b>2022</b>. At <b>CHRIST University</b>, leads CAPS club tech — building platforms used by campus. Shipped DRM video streaming, AI proctoring, and more — all on Kubernetes with CI/CD.' },
    contact: { key: 'contact', question: 'how to contact him?', answer: 'Email <a href="mailto:mpratyush54@gmail.com">mpratyush54@gmail.com</a> or connect on <a href="https://www.linkedin.com/in/pratyushm07" target="_blank">LinkedIn</a>. Contact form also works — replies within 24h.' },
  };

  phrases = [
    'I know everything about Pratyush.',
    'Ask me anything about his work.',
    'His projects are impressive.',
    'Check out his projects!'
  ];

  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private mixer: any = null;
  private robot: any = null;
  private headBone: any = null;
  private particles: any = null;
  private actions: any[] = [];
  private currentAction: any = null;
  private mouseX = 0;
  private mouseY = 0;
  private animId = 0;
  private destroyed = false;
  private T: any = null;
  private time = 0;
  private speechTimer: any = null;
  private waveTimer: any = null;
  private controls: any = null;
  private isDragging = false;

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    this.onPointerMove(e.clientX, e.clientY);
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(e: TouchEvent): void {
    const t = e.touches[0];
    if (t) this.onPointerMove(t.clientX, t.clientY);
  }

  private onPointerMove(cx: number, cy: number): void {
    if (this.isDragging || !this.canvasRef?.nativeElement) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    if (!rect) return;
    this.mouseX = ((cx - rect.left) / rect.width) * 2 - 1;
    this.mouseY = -((cy - rect.top) / rect.height) * 2 + 1;
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      const T = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      this.T = T;
      this.initScene();
      this.initControls(OrbitControls);
      await this.loadRobot(GLTFLoader);
      this.buildEnvironment(T);
      this.animate();
      window.addEventListener('resize', this.onResize);
      setTimeout(() => this.playIdle(), 200);
      setTimeout(() => this.showPhrase(), 1500);
      this.waveTimer = setInterval(() => {
        if (!this.chatOpen && Math.random() < 0.35) {
          this.playAnim('Wave');
          setTimeout(() => this.playIdle(), 1200);
        }
      }, 8000);
    } catch (e) {
      console.error('3D scene failed to load:', e);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
    if (this.speechTimer) clearTimeout(this.speechTimer);
    if (this.waveTimer) clearInterval(this.waveTimer);
    if (this.controls) this.controls.dispose();
    if (this.mixer) this.mixer.stopAllAction();
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); }
  }

  triggerQnA(key: string): void {
    const qa = this.qaMap[key];
    if (!qa) return;
    if (!this.chatOpen) this.toggleChat();
    this.messages.push({ type: 'q', text: qa.question });
    this.playAnim('Thinking');
    setTimeout(() => {
      this.messages.push({ type: 'a', text: qa.answer });
      this.playIdle();
    }, 600);
  }

  toggleChat(): void {
    this.chatOpen = !this.chatOpen;
    if (this.chatOpen && this.messages.length === 0) {
      this.messages.push({ type: 'a', text: 'Ask me anything about Pratyush.' });
    }
    if (this.chatOpen) this.playAnim('Dance');
    else this.playIdle();
    setTimeout(() => this.playIdle(), 2000);
  }

  ask(qa: QAPair): void {
    this.messages.push({ type: 'q', text: qa.question });
    this.playAnim('Thinking');
    setTimeout(() => {
      this.messages.push({ type: 'a', text: qa.answer });
      this.playIdle();
    }, 600);
  }

  private showPhrase(): void {
    const p = this.phrases[Math.floor(Math.random() * this.phrases.length)];
    this.speechText = p;
    this.showSpeech = true;
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(() => { this.showSpeech = false; }, 4000);
  }

  private playAnim(name: string): void {
    const clip = this.actions.find((a: any) => a.name === name);
    if (!clip) return;
    if (this.currentAction) this.currentAction.fadeOut(0.3);
    this.currentAction = clip;
    clip.reset().fadeIn(0.3).play();
  }

  private playIdle(): void {
    this.playAnim('Idle');
  }

  private initScene(): void {
    const T = this.T;
    const el = this.canvasRef.nativeElement;
    const w = el.clientWidth;
    const h = el.clientHeight;

    this.scene = new T.Scene();
    const isMobile = w < 768;
    this.camera = new T.PerspectiveCamera(isMobile ? 50 : 45, w / h, 0.1, 100);
    const dist = isMobile ? 4.2 : 4.5;
    this.camera.position.set(0, isMobile ? 0.8 : 1.0, dist);

    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.8;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    el.appendChild(this.renderer.domElement);
  }

  private initControls(OrbitControls: any): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    const el = this.canvasRef.nativeElement;
    this.controls.target.set(0, el.clientWidth < 768 ? 0.4 : 0.6, 0);
    this.controls.update();
    this.controls.addEventListener('start', () => { this.isDragging = true; });
    this.controls.addEventListener('end', () => { this.isDragging = false; });
  }

  private async loadRobot(GLTFLoader: any): Promise<void> {
    const url = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    this.robot = gltf.scene;
    this.robot.scale.set(0.55, 0.55, 0.55);
    this.robot.position.y = -0.15;
    this.robot.traverse((node: any) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
      if (node.isBone) {
        const lower = node.name.toLowerCase();
        if (lower.includes('head') && !lower.includes('upper') && !this.headBone) {
          this.headBone = node;
        }
      }
    });
    this.scene.add(this.robot);

    this.mixer = new this.T.AnimationMixer(this.robot);
    gltf.animations.forEach((clip: any) => {
      const action = this.mixer.clipAction(clip);
      this.actions.push(action);
    });
  }

  private buildEnvironment(T: any): void {
    const groundGeo = new T.CircleGeometry(4, 48);
    const groundMat = new T.MeshStandardMaterial({
      color: 0x111122, roughness: 0.9, metalness: 0.05,
      transparent: true, opacity: 0.3, side: T.DoubleSide
    });
    const ground = new T.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new T.GridHelper(8, 16, 0x6366f1, 0x4338ca);
    grid.position.y = -0.55;
    (grid.material as any).transparent = true;
    (grid.material as any).opacity = 0.08;
    this.scene.add(grid);

    const count = 600;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 25;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({
      color: 0x818cf8, size: 0.035, transparent: true, opacity: 0.3,
      blending: T.AdditiveBlending, sizeAttenuation: true,
    });
    this.particles = new T.Points(geo, mat);
    this.particles.position.y = 5;
    this.scene.add(this.particles);

    const amb = new T.AmbientLight(0x404060, 0.5);
    this.scene.add(amb);
    const key = new T.DirectionalLight(0xffffff, 2.5);
    key.position.set(5, 10, 7);
    key.castShadow = true;
    this.scene.add(key);
    const fill = new T.DirectionalLight(0x818cf8, 1);
    fill.position.set(-4, 3, 5);
    this.scene.add(fill);
    const rim = new T.DirectionalLight(0x6366f1, 0.6);
    rim.position.set(0, -2, -7);
    this.scene.add(rim);
  }

  private animate = (): void => {
    if (this.destroyed) return;
    this.animId = requestAnimationFrame(this.animate);
    this.time += 0.016;

    if (this.mixer) this.mixer.update(0.016);
    if (this.robot) {
      this.robot.position.y = -0.15 + Math.sin(this.time * 0.8) * 0.03;
    }
    if (this.headBone && !this.isDragging) {
      this.headBone.rotation.x += (this.mouseY * 0.15 - this.headBone.rotation.x) * 0.035;
      this.headBone.rotation.y += (this.mouseX * 0.25 - this.headBone.rotation.y) * 0.035;
    }
    if (this.particles) this.particles.rotation.y += 0.0003;
    if (this.controls) this.controls.update();

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
