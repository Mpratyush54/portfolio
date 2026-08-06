import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener, Input } from '@angular/core';

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
  @ViewChild('chatMsgs') chatMsgsRef?: ElementRef<HTMLDivElement>;

  /** When true, canvas ignores pointer so page scroll/UI work; chat still works. */
  @Input() stageOnly = false;

  speechText = '';
  showSpeech = false;
  chatOpen = false;
  messages: { type: 'q' | 'a'; text: string }[] = [];

  qaMap: Record<string, QAPair> = {
    who: { key: 'who', question: 'who is pratyush?', answer: 'I\'m <b>Pratyush Mishra</b> — Backend Engineer & Full Stack Dev. I build systems that scale. Clean architecture, automated deploys, great DX.' },
    built: { key: 'built', question: 'what has he built?', answer: '6+ projects — ClassStream (DRM/WebRTC), CAPS Automation, Phone Proctor, Ambue, and an internal PaaS. Check the work section.' },
    work: { key: 'work', question: 'is he open to work?', answer: 'Yes — looking for <b>Backend Engineer</b> or <b>Full Stack</b> roles. Resume is in the nav, or scroll to contact.' },
    stack: { key: 'stack', question: 'what is his tech stack?', answer: '<b>Backend:</b> Node, Express, Python, Go, Rust · <b>Frontend:</b> Angular, React · <b>Infra:</b> Docker, K8s, GitHub Actions · <b>DB:</b> MongoDB, Postgres, Redis' },
    experience: { key: 'experience', question: 'what is his experience?', answer: 'Coding since <b>2022</b>. Tech Lead at CAPS (CHRIST Univ) — platforms used on campus. DRM streaming, AI proctoring, CI/CD on Kubernetes.' },
    contact: { key: 'contact', question: 'how to contact him?', answer: 'Email <a href="mailto:mpratyush54@gmail.com">mpratyush54@gmail.com</a> or <a href="https://www.linkedin.com/in/pratyushm07" target="_blank">LinkedIn</a>. Form below works too.' },
  };

  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private mixer: any = null;
  private robot: any = null;
  private robotBaseY = 0;
  private headBone: any = null;
  private particles: any = null;
  private actions: Map<string, any> = new Map();
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
  private hasClipAnims = false;
  private lastNarration = '';

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
    if (!rect.width) return;
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
      if (!this.stageOnly) this.initControls(OrbitControls);
      await this.loadRobot(GLTFLoader);
      this.buildEnvironment(T);
      this.animate();
      window.addEventListener('resize', this.onResize);
      setTimeout(() => this.playIdle(), 200);
      this.waveTimer = setInterval(() => {
        if (!this.chatOpen && Math.random() < 0.3) {
          this.playAnim('Wave');
          setTimeout(() => this.playIdle(), 1400);
        }
      }, 10000);
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
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }

  /** Scroll-driven narration from the home page. */
  narrate(text: string, anim: string = 'Idle'): void {
    if (text === this.lastNarration) return;
    this.lastNarration = text;
    this.speechText = text;
    this.showSpeech = true;
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(() => { this.showSpeech = false; }, 5200);
    this.playAnim(anim);
    setTimeout(() => this.playIdle(), 1600);
  }

  triggerQnA(key: string): void {
    const qa = this.qaMap[key];
    if (!qa) return;
    if (!this.chatOpen) this.toggleChat();
    this.messages.push({ type: 'q', text: qa.question });
    this.scrollToBottom();
    this.playAnim('Thinking');
    setTimeout(() => {
      this.messages.push({ type: 'a', text: qa.answer });
      this.scrollToBottom();
      this.playIdle();
    }, 600);
  }

  toggleChat(): void {
    this.chatOpen = !this.chatOpen;
    if (this.chatOpen && this.messages.length === 0) {
      this.messages.push({ type: 'a', text: 'Ask me anything about Pratyush.' });
    }
    if (this.chatOpen) {
      this.playAnim('Dance');
      this.scrollToBottom();
    } else {
      this.playIdle();
    }
    setTimeout(() => this.playIdle(), 2000);
  }

  private scrollToBottom(): void {
    [100, 350].forEach(ms => setTimeout(() => {
      if (this.chatMsgsRef?.nativeElement) {
        this.chatMsgsRef.nativeElement.scrollTop = this.chatMsgsRef.nativeElement.scrollHeight;
      }
    }, ms));
  }

  private resolveClip(logical: string): any | null {
    if (this.actions.has(logical)) return this.actions.get(logical);
    const aliases: Record<string, string[]> = {
      Idle: ['Idle', 'Standing', 'idle'],
      Wave: ['Wave', 'ThumbsUp', 'Yes', 'Hello'],
      Thinking: ['Sitting', 'Thinking', 'Idle'],
      Dance: ['Dance', 'Jump', 'Running'],
      ThumbsUp: ['ThumbsUp', 'Yes', 'Wave'],
    };
    for (const n of aliases[logical] || [logical]) {
      if (this.actions.has(n)) return this.actions.get(n);
    }
    return this.actions.get('Idle') || null;
  }

  private playAnim(name: string): void {
    if (!this.hasClipAnims) return;
    const clip = this.resolveClip(name);
    if (!clip) return;
    if (this.currentAction === clip && name === 'Idle') return;
    if (this.currentAction) this.currentAction.fadeOut(0.25);
    this.currentAction = clip;
    clip.reset().fadeIn(0.25).play();
  }

  private playIdle(): void {
    this.playAnim('Idle');
  }

  private initScene(): void {
    const T = this.T;
    const el = this.canvasRef.nativeElement;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;

    this.scene = new T.Scene();
    const isMobile = w < 768;
    this.camera = new T.PerspectiveCamera(isMobile ? 40 : 35, w / h, 0.1, 100);
    // Frame robot toward right-center like fuch-style companion
    this.camera.position.set(isMobile ? 0 : 0.35, isMobile ? 1.15 : 1.35, isMobile ? 4.2 : 4.6);

    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.55;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.domElement.style.pointerEvents = this.stageOnly ? 'none' : 'auto';
    el.appendChild(this.renderer.domElement);
  }

  private initControls(OrbitControls: any): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 7;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.enablePan = false;
    this.controls.target.set(0, 0.9, 0);
    this.controls.update();
    this.controls.addEventListener('start', () => { this.isDragging = true; });
    this.controls.addEventListener('end', () => { this.isDragging = false; });
  }

  private async loadRobot(GLTFLoader: any): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/models/robot.glb');
    this.robot = gltf.scene;

    const box = new this.T.Box3().setFromObject(this.robot);
    const size = new this.T.Vector3();
    box.getSize(size);
    const targetHeight = 2.15;
    const scale = size.y > 0 ? targetHeight / size.y : 0.55;
    this.robot.scale.setScalar(scale);

    box.setFromObject(this.robot);
    const center = new this.T.Vector3();
    box.getCenter(center);
    this.robot.position.x -= center.x;
    this.robot.position.z -= center.z;
    this.robot.position.y -= box.min.y;
    this.robotBaseY = this.robot.position.y;

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
    if (gltf.animations?.length) {
      this.hasClipAnims = true;
      gltf.animations.forEach((clip: any) => {
        const action = this.mixer.clipAction(clip);
        // Emotes loop once
        if (['Wave', 'ThumbsUp', 'Yes', 'No', 'Jump', 'Punch', 'Dance'].includes(clip.name)) {
          action.clampWhenFinished = true;
          action.loop = this.T.LoopOnce;
        }
        this.actions.set(clip.name, action);
      });
    }
  }

  private buildEnvironment(T: any): void {
    const ground = new T.Mesh(
      new T.CircleGeometry(3.2, 64),
      new T.MeshStandardMaterial({
        color: 0x0c0c14,
        roughness: 0.95,
        metalness: 0.02,
        transparent: true,
        opacity: 0.45,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const count = 220;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 7 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    this.particles = new T.Points(
      geo,
      new T.PointsMaterial({
        color: 0xa1a1aa,
        size: 0.025,
        transparent: true,
        opacity: 0.28,
        sizeAttenuation: true,
      })
    );
    this.scene.add(this.particles);

    this.scene.add(new T.AmbientLight(0xc8cdd8, 0.6));
    const key = new T.DirectionalLight(0xfff4e8, 2.2);
    key.position.set(4, 9, 6);
    key.castShadow = true;
    this.scene.add(key);
    const fill = new T.DirectionalLight(0xb0becf, 0.9);
    fill.position.set(-5, 3, 2);
    this.scene.add(fill);
    const rim = new T.DirectionalLight(0x90a4b8, 0.5);
    rim.position.set(1, 2, -6);
    this.scene.add(rim);
  }

  private animate = (): void => {
    if (this.destroyed) return;
    this.animId = requestAnimationFrame(this.animate);
    this.time += 0.016;

    if (this.mixer) this.mixer.update(0.016);
    if (this.robot) {
      this.robot.position.y = this.robotBaseY + Math.sin(this.time * 0.85) * 0.028;
    }
    if (this.headBone && !this.isDragging) {
      this.headBone.rotation.y += (this.mouseX * 0.28 - this.headBone.rotation.y) * 0.04;
      this.headBone.rotation.x += (this.mouseY * 0.12 - this.headBone.rotation.x) * 0.04;
    }
    if (this.particles) this.particles.rotation.y += 0.0002;
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = (): void => {
    const el = this.canvasRef?.nativeElement;
    if (!el || !this.camera || !this.renderer) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
