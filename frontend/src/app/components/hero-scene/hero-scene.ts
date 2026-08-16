import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  HostListener, Input, Output, EventEmitter, inject, effect
} from '@angular/core';
import { BudEventsService } from '../../services/bud-events.service';

export interface StagePose {
  camX?: number;
  camY?: number;
  camZ?: number;
  lookY?: number;
  robotYaw?: number;
}

type RandomBeat = { clip: string; holdMs: number; yaw: number; speed: number };

@Component({
  selector: 'app-hero-scene',
  standalone: true,
  imports: [],
  templateUrl: './hero-scene.html',
  styleUrl: './hero-scene.scss'
})
export class HeroSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sceneEl') canvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('speechEl') speechRef?: ElementRef<HTMLDivElement>;

  @Input() stageOnly = false;
  @Input() playIntro = false;

  @Output() loadingChange = new EventEmitter<boolean>();
  @Output() ready = new EventEmitter<void>();

  speechText = '';
  showSpeech = false;

  private budEvents = inject(BudEventsService);
  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private mixer: any = null;
  private robot: any = null;
  private robotBaseY = 0;
  private robotHomeZ = 0;
  private headBone: any = null;
  private headTopBone: any = null;
  private humanHeadBone: any = null;
  private humanHeadTopBone: any = null;
  private speechWorld: any = null;
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
  private idleTimer: any = null;
  private controls: any = null;
  private isDragging = false;
  private hasClipAnims = false;
  private lastNarration = '';
  private isSleeping = false;
  private introActive = false;
  private wavedOnce = false;
  private lastActivity = Date.now();
  private gsap: any = null;
  private lookTarget = { y: 0.72 };
  private targetYaw = 0;
  private currentYaw = 0;
  private celebrateSeen = 0;
  private playMode = false;
  private randomMode = false;
  private randomTimer: any = null;
  private playlistIndex = 0;
  private randomDeck: RandomBeat[] = [];
  private lastRandomClip = '';
  private human: any = null;
  private humanMixer: any = null;
  private humanActions: Map<string, any> = new Map();
  private humanCurrent: any = null;
  private humanBaseY = 0;
  private humanReady = false;
  private humanLoading: Promise<void> | null = null;
  private aboutMode = false;
  private showingHuman = false;
  private swapBusy = false;
  private aboutSwapTimer: any = null;
  private aboutRepeatTimer: any = null;
  private gltfLoaderCtor: any = null;
  private randomPausedForAbout = false;
  private lastFrameMs = 0;
  private budHandoffPromise: Promise<void> | null = null;
  private paused = false;

  constructor() {
    effect(() => {
      const tick = this.budEvents.celebrateTick();
      if (tick > this.celebrateSeen) {
        this.celebrateSeen = tick;
        this.celebrate();
      }
    });
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    this.bumpActivity();
    // Only track head when pointer is over the 3D stage — not when browsing UI
    const stage = this.canvasRef?.nativeElement;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const overStage =
      e.clientX >= r.left + r.width * 0.35 &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom;
    if (overStage) this.onPointerMove(e.clientX, e.clientY);
    else {
      this.mouseX *= 0.9;
      this.mouseY *= 0.9;
    }
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(e: TouchEvent): void {
    this.bumpActivity();
    const t = e.touches[0];
    if (t) this.onPointerMove(t.clientX, t.clientY);
  }

  @HostListener('document:visibilitychange')
  onVisibility(): void {
    if (this.introActive) return;
    if (document.hidden) this.sleep('brb — tab me back when you\'re ready.');
    else this.wake();
  }

  private bumpActivity(): void {
    this.lastActivity = Date.now();
    if (this.isSleeping && !document.hidden) this.wake();
  }

  private onPointerMove(cx: number, cy: number): void {
    if (this.isDragging || !this.canvasRef?.nativeElement) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    if (!rect.width) return;
    this.mouseX = ((cx - rect.left) / rect.width) * 2 - 1;
    this.mouseY = -((cy - rect.top) / rect.height) * 2 + 1;
  }

  async ngAfterViewInit(): Promise<void> {
    this.loadingChange.emit(true);
    try {
      const T = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const gsapMod = await import('gsap');
      this.gsap = gsapMod.gsap || gsapMod.default;
      this.T = T;
      this.gltfLoaderCtor = GLTFLoader;
      this.initScene();
      this.initControls(OrbitControls);
      this.setOrbitEnabled(false);
      const { fromCache } = await this.loadRobot(GLTFLoader);
      this.buildEnvironment(T);
      this.animate();
      window.addEventListener('resize', this.onResize);
      this.loadingChange.emit(false);
      // Unlock UI as soon as the model is ready — don't hold the page for the walk.
      this.ready.emit();

      // Walk-in only on cold load (Cache API miss). Warm visits skip straight to idle.
      const shouldWalk = this.playIntro && !fromCache;
      if (shouldWalk) {
        await this.runIntro();
      } else {
        this.playIdle();
      }

      this.idleTimer = setInterval(() => this.checkBoredom(), 2000);

      // Warm the About human in the background so the glitch isn't hitchy
      void this.preloadHumanInBackground();
    } catch (e) {
      console.error('3D scene failed to load:', e);
      this.loadingChange.emit(false);
      this.ready.emit();
    }
  }

  /** Decode + GPU-warm human off the critical path. */
  private async preloadHumanInBackground(): Promise<void> {
    // Let first paint / intro settle first
    await this.wait(1200);
    if (this.destroyed) return;
    await this.ensureHumanLoaded();
    if (this.destroyed || !this.humanReady) return;
    this.warmHumanGpu();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.paused = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
    if (this.speechTimer) clearTimeout(this.speechTimer);
    if (this.waveTimer) clearInterval(this.waveTimer);
    if (this.idleTimer) clearInterval(this.idleTimer);
    if (this.randomTimer) clearTimeout(this.randomTimer);
    if (this.aboutSwapTimer) clearTimeout(this.aboutSwapTimer);
    if (this.aboutRepeatTimer) clearTimeout(this.aboutRepeatTimer);
    if (this.controls) this.controls.dispose();
    if (this.mixer) this.mixer.stopAllAction();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }

  private runIntro(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.robot || !this.gsap) {
        resolve();
        return;
      }
      this.introActive = true;
      this.wavedOnce = false;
      this.robot.position.z = this.robotHomeZ + 4.2;
      this.playAnim('Walking');

      this.gsap.to(this.robot.position, {
        z: this.robotHomeZ,
        duration: 2.0,
        ease: 'power1.inOut',
        onComplete: () => {
          if (this.destroyed) return;
          // Greeting wave ×2 (hello), then idle — setMood/wake/chat never add more waves
          this.waveHello(1).then(() => {
            if (this.destroyed) return;
            this.introActive = false;
            this.playIdle();
            this.lastActivity = Date.now();
            resolve();
          });
        },
      });
    });
  }

  /** Greeting: wave the hand `times` times (hello should feel multi-wave). */
  private waveHello(times = 2): Promise<void> {
    return new Promise((resolve) => {
      this.wavedOnce = true;
      this.speechText = "hi — i'm bud.";
      this.showSpeech = true;
      if (this.speechTimer) clearTimeout(this.speechTimer);
      this.speechTimer = setTimeout(() => { this.showSpeech = false; }, 3200);

      let n = 0;
      const next = () => {
        if (this.destroyed || n >= times) {
          resolve();
          return;
        }
        n += 1;
        this.playAnim('Wave');
        const clip = this.resolveClip('Wave');
        const dur = ((clip?.getClip?.()?.duration || 1.2) * 1000) / (clip?.getEffectiveTimeScale?.() || 1);
        setTimeout(next, Math.max(900, dur * 0.85));
      };
      next();
    });
  }

  /** Pause render loop (phone non-home) — saves GPU while stage is hidden. */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      cancelAnimationFrame(this.animId);
      this.animId = 0;
      this.showSpeech = false;
    } else if (!this.destroyed) {
      this.lastFrameMs = 0;
      this.animId = requestAnimationFrame(this.animate);
    }
  }

  setMood(view: 'home' | 'work' | 'about' | 'contact'): void {
    if (this.introActive) return;
    // Phone non-home: no stage presence / speech — UI is content-only
    const phone =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    if (phone && view !== 'home') {
      this.showSpeech = false;
      this.leaveAboutPresence();
      return;
    }
    // Pose + speech only — never re-triggers Wave (that stacked with the intro)
    const poses: Record<string, StagePose> = {
      home: { camX: 0.45, camY: 1.28, camZ: 4.35, lookY: 0.72, robotYaw: 0.12 },
      work: { camX: 0.65, camY: 1.22, camZ: 4.7, lookY: 0.7, robotYaw: -0.25 },
      about: { camX: 0.3, camY: 1.22, camZ: 4.15, lookY: 0.72, robotYaw: 0.2 },
      contact: { camX: 0.55, camY: 1.18, camZ: 4.35, lookY: 0.7, robotYaw: 0.08 },
    };
    const lines: Record<string, string> = {
      home: "ask me anything about pratyush.",
      work: "here's what he's shipped.",
      about: 'he builds backends and leads teams.',
      contact: 'leave a note — he replies fast.',
    };
    this.applyPose(poses[view]);
    // Quiet mood lines — don't re-greet every view switch
    const text = lines[view];
    if (text && text !== this.lastNarration && !this.playMode && !this.randomMode && !this.showingHuman) {
      this.lastNarration = text;
      this.speechText = text;
      this.showSpeech = true;
      if (this.speechTimer) clearTimeout(this.speechTimer);
      this.speechTimer = setTimeout(() => { this.showSpeech = false; }, 3200);
    }

    if (view === 'about') this.enterAboutPresence();
    else this.leaveAboutPresence();
  }

  /** About: preload human, swap once soon, then rare soft swaps while you stay. */
  private enterAboutPresence(): void {
    if (this.aboutMode) return; // already armed
    this.aboutMode = true;
    if (this.aboutSwapTimer) clearTimeout(this.aboutSwapTimer);
    if (this.aboutRepeatTimer) clearTimeout(this.aboutRepeatTimer);

    // Wait until human is decoded+warmed, then start the beat (avoids walk hitch)
    void (async () => {
      await this.ensureHumanLoaded();
      if (this.destroyed || !this.aboutMode) return;
      if (this.humanReady) this.warmHumanGpu();
      this.aboutSwapTimer = setTimeout(() => {
        if (this.destroyed || !this.aboutMode) return;
        void this.runIdentitySwap();
        this.scheduleAboutRepeat();
      }, this.humanReady ? 900 : 400);
    })();
  }

  private leaveAboutPresence(): void {
    this.aboutMode = false;
    if (this.aboutSwapTimer) clearTimeout(this.aboutSwapTimer);
    if (this.aboutRepeatTimer) clearTimeout(this.aboutRepeatTimer);
    this.aboutSwapTimer = null;
    this.aboutRepeatTimer = null;
    if (this.showingHuman || this.swapBusy) {
      void this.restoreBud(true);
    }
  }

  private scheduleAboutRepeat(): void {
    if (!this.aboutMode || this.destroyed) return;
    if (this.aboutRepeatTimer) clearTimeout(this.aboutRepeatTimer);
    const wait = 55000 + Math.random() * 35000; // ~55–90s
    this.aboutRepeatTimer = setTimeout(() => {
      if (this.destroyed || !this.aboutMode) return;
      void this.runIdentitySwap().then(() => this.scheduleAboutRepeat());
    }, wait);
  }

  private async ensureHumanLoaded(): Promise<void> {
    if (this.humanReady) return;
    if (this.humanLoading) return this.humanLoading;
    this.humanLoading = this.loadHuman().catch(err => {
      console.warn('Human model failed to load', err);
      this.humanLoading = null;
    });
    return this.humanLoading;
  }

  private async loadHuman(): Promise<void> {
    if (!this.gltfLoaderCtor || !this.T || !this.scene) return;
    const url = '/models/human.glb';
    const loader = new this.gltfLoaderCtor();

    // human.glb uses Draco (not meshopt)
    try {
      const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      loader.setDRACOLoader(draco);
    } catch (e) {
      console.warn('DRACOLoader unavailable', e);
    }
    try {
      const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
      if (MeshoptDecoder.ready) await MeshoptDecoder.ready;
      loader.setMeshoptDecoder(MeshoptDecoder);
    } catch { /* optional */ }

    let buffer: ArrayBuffer | null = null;
    try {
      const cache = await caches.open('bud-models-v1');
      const hit = await cache.match(url);
      if (hit) buffer = await hit.arrayBuffer();
      else {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buffer = await res.arrayBuffer();
        await cache.put(url, new Response(buffer.slice(0), {
          headers: { 'Content-Type': 'model/gltf-binary' }
        }));
      }
    } catch {
      buffer = null;
    }

    const gltf = buffer
      ? await new Promise<any>((resolve, reject) => loader.parse(buffer!, url, resolve, reject))
      : await loader.loadAsync(url);

    this.human = gltf.scene;
    const box = new this.T.Box3().setFromObject(this.human);
    const size = new this.T.Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? 1.5 / size.y : 1;
    this.human.userData.fitScale = scale;
    this.human.scale.setScalar(scale);
    box.setFromObject(this.human);
    const center = new this.T.Vector3();
    box.getCenter(center);
    this.human.position.x -= center.x;
    this.human.position.z -= center.z;
    this.human.position.y -= box.min.y;
    this.humanBaseY = this.human.position.y - 0.12;
    this.human.position.y = this.humanBaseY;
    this.human.rotation.y = 0.12;
    this.humanHeadBone = null;
    this.humanHeadTopBone = null;
    this.human.traverse((node: any) => {
      if (node.isBone) this.captureHeadBones(node, 'human');
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          const cloned = mats.map((m: any) => {
            const c = m.clone();
            if (c.map) c.map.colorSpace = this.T.SRGBColorSpace;
            c.transparent = true;
            c.opacity = 1;
            c.needsUpdate = true;
            return c;
          });
          node.material = cloned.length === 1 ? cloned[0] : cloned;
        }
      }
    });
    this.human.visible = false;
    this.scene.add(this.human);
    this.humanMixer = new this.T.AnimationMixer(this.human);
    this.humanActions.clear();
    this.humanCurrent = null;
    (gltf.animations || []).forEach((raw: any) => {
      // Keep Hips planted — this Mixamo spin clip translates ~433 units on Z
      const clip = this.makeClipInPlace(raw);
      const action = this.humanMixer.clipAction(clip);
      action.clampWhenFinished = true;
      action.enabled = false;
      this.humanActions.set(raw.name, action);
    });
    this.humanReady = true;
  }

  /** Lock Hips translation to the first keyframe (kill root motion). */
  private makeClipInPlace(clip: any): any {
    const c = clip.clone();
    for (const track of c.tracks) {
      const name = String(track.name || '');
      if (!/(^|\/)Hips\.position$/.test(name)) continue;
      const values = track.values;
      if (!values || values.length < 3) continue;
      const x0 = values[0];
      const y0 = values[1];
      const z0 = values[2];
      for (let i = 0; i < values.length; i += 3) {
        values[i] = x0;
        values[i + 1] = y0;
        values[i + 2] = z0;
      }
    }
    return c;
  }

  /** Force shader compile + GPU buffer upload while off-camera. */
  private warmHumanGpu(): void {
    if (!this.human || !this.renderer || !this.camera || this.destroyed) return;
    if (this.human.userData.gpuWarmed) return;
    const fit = this.human.userData.fitScale || 1.5;
    this.human.visible = true;
    this.human.scale.setScalar(fit);
    this.human.position.set(80, 80, 80);
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch { /* ignore */ }
    if (this.humanMixer) {
      this.playHumanExclusive('idle', true);
      this.humanMixer.update(0.05);
      this.playHumanExclusive('walk', true);
      this.humanMixer.update(0.05);
      this.playHumanExclusive('spin', false);
      this.humanMixer.update(0.05);
      this.humanMixer.stopAllAction();
      this.humanActions.forEach(a => { a.enabled = false; a.setEffectiveWeight(0); });
      this.humanCurrent = null;
    }
    this.renderer.render(this.scene, this.camera);
    this.human.visible = false;
    this.human.position.set(0, this.humanBaseY, this.robotHomeZ);
    this.human.rotation.y = 0.12;
    this.human.userData.gpuWarmed = true;
  }

  private async runIdentitySwap(): Promise<void> {
    if (this.destroyed || !this.aboutMode || this.swapBusy || this.playMode) return;
    await this.ensureHumanLoaded();
    if (!this.humanReady || !this.human || !this.robot || !this.gsap) {
      console.warn('About glitch skipped — human not ready');
      return;
    }
    this.warmHumanGpu();

    this.swapBusy = true;
    this.showSpeech = false;

    if (this.randomMode) {
      this.randomPausedForAbout = true;
      if (this.randomTimer) {
        clearTimeout(this.randomTimer);
        this.randomTimer = null;
      }
    }

    // 1) Person: walk in → slow to idle → stunt
    // 2) During stunt slowdown → Bud appears and does the same
    // 3) During Bud's stunt slowdown → person again
    // 4) Settle back on Bud
    const ok = await this.playHumanBeat({ approach: true, handoffDuringStunt: true });
    if (!ok || this.destroyed || !this.aboutMode) {
      await this.restoreBud(true);
      return;
    }
    if (this.budHandoffPromise) await this.budHandoffPromise;

    const okBud = await this.playBudBeat({ approach: true });
    if (!okBud || this.destroyed || !this.aboutMode) {
      await this.restoreBud(true);
      return;
    }

    // Person reprise, hand off to Bud again during stunt slowdown, then stay on Bud
    const ok2 = await this.playHumanBeat({ approach: true, short: true, handoffDuringStunt: true });
    if (!ok2 || this.destroyed || !this.aboutMode) {
      await this.restoreBud(true);
      return;
    }
    if (this.budHandoffPromise) await this.budHandoffPromise;
    await this.settleBudAfterShow();
  }

  /**
   * Human: walk in (eases to a stop) → idle → spin stunt.
   * If handoffDuringStunt, Bud starts fading in while the spin slows down.
   */
  private async playHumanBeat(opts: {
    approach?: boolean;
    short?: boolean;
    handoffDuringStunt?: boolean;
  }): Promise<boolean> {
    if (!this.human || !this.gsap || !this.robot) return false;
    const fit = this.human.userData.fitScale || 1.5;
    const walkDur = this.humanActions.get('walk')?.getClip?.()?.duration || 1.07;
    const spinDur = this.humanActions.get('spin')?.getClip?.()?.duration || 3.1;

    // Hide Bud if he's still on stage (person's turn)
    if (this.robot.visible) {
      await this.fadeModel(this.robot, 1, 0, 0.35);
      if (this.destroyed || !this.aboutMode) return false;
      this.robot.visible = false;
      if (this.mixer) this.mixer.stopAllAction();
    }

    this.human.scale.setScalar(fit);
    this.human.rotation.y = 0.12;
    this.setModelOpacity(this.human, 1);
    this.showingHuman = true;

    if (opts.approach) {
      const fromZ = this.robotHomeZ + (opts.short ? 0.35 : 0.55);
      this.human.position.set(0, this.humanBaseY, fromZ);
      this.playHumanExclusive('walk', true);
      this.human.visible = true;

      let settled = false;
      await new Promise<void>(resolve => {
        const tween = this.gsap.to(this.human.position, {
          z: this.robotHomeZ,
          duration: walkDur * (opts.short ? 1.35 : 2.15),
          ease: 'power3.out', // slows and stops
          onUpdate: () => {
            if (!settled && tween.progress() >= 0.72) {
              settled = true;
              this.playHumanExclusive('idle', true);
            }
          },
          onComplete: () => resolve(),
        });
      });
      if (!settled) this.playHumanExclusive('idle', true);
    } else {
      this.human.position.set(0, this.humanBaseY, this.robotHomeZ);
      this.playHumanExclusive('idle', true);
      this.human.visible = true;
    }

    if (this.destroyed || !this.aboutMode) return false;
    await this.wait(opts.short ? 900 : 1400);
    if (this.destroyed || !this.aboutMode) return false;

    // Hard-cut into spin — crossfades were dropping weight to 0 (PT / bind pose)
    const spinAction = this.humanActions.get('spin');
    if (!spinAction) {
      console.warn('Human spin clip missing');
      return false;
    }
    this.playHumanExclusive('spin', false);
    spinAction.setEffectiveTimeScale(1);

    // First ~55% at full speed
    await this.wait(spinDur * 0.55 * 1000);
    if (this.destroyed || !this.aboutMode) return false;

    // Slowdown + optional Bud handoff overlap
    const pace = { s: 1 };
    this.gsap.to(pace, {
      s: 0.28,
      duration: spinDur * 0.4,
      ease: 'power1.in',
      onUpdate: () => {
        if (this.humanCurrent === spinAction) spinAction.setEffectiveTimeScale(pace.s);
      },
    });

    if (opts.handoffDuringStunt) {
      this.budHandoffPromise = this.beginBudEntranceDuringHandoff();
    }

    await this.wait(spinDur * 0.42 * 1000);
    if (this.destroyed || !this.aboutMode) return false;

    // Hold finished stunt pose (clampWhenFinished) before handoff
    await this.wait(350);
    if (this.destroyed || !this.aboutMode) return false;

    if (opts.handoffDuringStunt) {
      await this.fadeModel(this.human, 1, 0, 0.45);
      this.human.visible = false;
      if (this.humanMixer) this.humanMixer.stopAllAction();
      this.humanCurrent = null;
      this.showingHuman = false;
      this.setModelOpacity(this.human, 1);
      if (this.budHandoffPromise) await this.budHandoffPromise;
    } else {
      this.playHumanExclusive('idle', true);
    }
    return true;
  }

  /** Bud sneaks on while the human stunt is still slowing down. */
  private async beginBudEntranceDuringHandoff(): Promise<void> {
    if (!this.robot || !this.gsap) return;
    this.robot.visible = true;
    this.robot.position.z = this.robotHomeZ + 0.4;
    this.robot.position.y = this.robotBaseY;
    this.setModelOpacity(this.robot, 0);
    this.playAnim('Walking');
    await this.fadeModel(this.robot, 0, 1, 0.55);
  }

  /**
   * Bud mirrors the person: walk in → idle → flourish stunt → (optional handoff cue).
   */
  private async playBudBeat(opts: {
    approach?: boolean;
  }): Promise<boolean> {
    if (!this.robot || !this.gsap) return false;

    // Ensure human is gone
    if (this.human?.visible) {
      this.human.visible = false;
      if (this.humanMixer) this.humanMixer.stopAllAction();
      this.humanCurrent = null;
      this.showingHuman = false;
    }

    this.robot.visible = true;
    if (opts.approach) {
      // May already be fading in from handoff — finish approach
      if (this.robot.position.z < this.robotHomeZ + 0.05) {
        this.robot.position.z = this.robotHomeZ + 0.4;
      }
      this.setModelOpacity(this.robot, Math.max(0.01, this.getModelOpacity(this.robot)));
      this.playAnim('Walking');
      if (this.getModelOpacity(this.robot) < 0.9) {
        await this.fadeModel(this.robot, this.getModelOpacity(this.robot), 1, 0.35);
      }
      await new Promise<void>(resolve => {
        this.gsap.to(this.robot.position, {
          z: this.robotHomeZ,
          duration: 1.35,
          ease: 'power3.out',
          onComplete: () => resolve(),
        });
      });
    }

    if (this.destroyed || !this.aboutMode) return false;
    this.playAnim('Idle');
    await this.wait(1100);
    if (this.destroyed || !this.aboutMode) return false;

    // Bud's stunt — dance / flair / spin from mascot set
    this.playAnim('Dance');
    const stunt = this.resolveClip('Dance');
    const stuntDur = stunt?.getClip?.()?.duration || 2.2;
    if (stunt) stunt.setEffectiveTimeScale(1);

    await this.wait(stuntDur * 0.55 * 1000);
    if (this.destroyed || !this.aboutMode) return false;

    if (stunt) {
      const pace = { s: 1 };
      this.gsap.to(pace, {
        s: 0.3,
        duration: Math.max(0.5, stuntDur * 0.4),
        ease: 'power1.in',
        onUpdate: () => stunt.setEffectiveTimeScale(pace.s),
      });
    }

    await this.wait(Math.max(600, stuntDur * 0.4 * 1000));
    if (this.destroyed || !this.aboutMode) return false;

    this.playAnim('Idle');
    await this.wait(700);
    return true;
  }

  private async settleBudAfterShow(): Promise<void> {
    if (!this.robot) {
      this.swapBusy = false;
      return;
    }
    if (this.human?.visible) {
      await this.fadeModel(this.human, 1, 0, 0.4);
      this.human.visible = false;
      if (this.humanMixer) this.humanMixer.stopAllAction();
      this.humanCurrent = null;
    }
    this.showingHuman = false;
    this.robot.visible = true;
    this.robot.position.z = this.robotHomeZ;
    this.setModelOpacity(this.robot, 1);
    this.playAnim('Idle');
    this.swapBusy = false;

    if (this.randomPausedForAbout && this.randomMode && !this.aboutMode) {
      this.randomPausedForAbout = false;
      this.advancePlaylist();
    } else if (!this.aboutMode) {
      this.randomPausedForAbout = false;
    }
  }

  private getModelOpacity(root: any): number {
    let opacity = 1;
    root?.traverse((node: any) => {
      if (!node.isMesh || !node.material) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      if (mats[0]?.opacity != null) opacity = mats[0].opacity;
    });
    return opacity;
  }

  private async restoreBud(instant: boolean): Promise<void> {
    if (!this.robot) {
      this.swapBusy = false;
      this.showingHuman = false;
      return;
    }
    if (this.gsap && this.human) {
      this.gsap.killTweensOf?.(this.human.position);
      this.gsap.killTweensOf?.(this.human.rotation);
      this.gsap.killTweensOf?.(this.human.scale);
    }
    if (this.human && (this.showingHuman || this.human.visible)) {
      if (instant || !this.gsap) {
        this.human.visible = false;
        if (this.humanMixer) this.humanMixer.stopAllAction();
        this.humanCurrent = null;
      } else {
        const fit = this.human.userData.fitScale || 1.5;
        await this.fadeModel(this.human, 1, 0, 0.35);
        this.human.visible = false;
        this.human.scale.setScalar(fit);
        if (this.humanMixer) this.humanMixer.stopAllAction();
        this.humanCurrent = null;
      }
    }
    this.showingHuman = false;
    this.robot.visible = true;
    this.robot.position.z = this.robotHomeZ;
    if (instant || !this.gsap) {
      this.setModelOpacity(this.robot, 1);
    } else {
      this.setModelOpacity(this.robot, Math.min(1, this.getModelOpacity(this.robot)));
      await this.fadeModel(this.robot, this.getModelOpacity(this.robot), 1, 0.45);
    }
    this.playAnim('Idle');
    this.swapBusy = false;

    if (this.randomPausedForAbout && this.randomMode && !this.aboutMode) {
      this.randomPausedForAbout = false;
      this.advancePlaylist();
    } else if (!this.aboutMode) {
      this.randomPausedForAbout = false;
    }
  }

  /**
   * One clip only, full weight. Crossfades were fading the previous clip out
   * without bringing the next in → bind pose (PT arms) instead of the stunt.
   */
  private playHumanExclusive(name: string, loop: boolean): void {
    if (!this.humanMixer) return;
    const next = this.humanActions.get(name);
    if (!next) {
      console.warn('Missing human clip:', name);
      return;
    }

    this.humanMixer.stopAllAction();
    this.humanActions.forEach(a => {
      a.enabled = false;
      a.paused = false;
      a.setEffectiveWeight(0);
      a.setEffectiveTimeScale(1);
    });

    next.enabled = true;
    next.paused = false;
    next.setLoop(loop ? this.T.LoopRepeat : this.T.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = true;
    next.reset();
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    next.play();
    this.humanCurrent = next;
    this.humanMixer.update(0);
  }



  private setModelOpacity(root: any, opacity: number): void {
    if (!root) return;
    root.traverse((node: any) => {
      if (!node.isMesh || !node.material) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((m: any) => {
        m.transparent = true;
        m.opacity = opacity;
        m.depthWrite = opacity > 0.92;
        m.needsUpdate = true;
      });
    });
  }

  private fadeModel(root: any, from: number, to: number, duration: number): Promise<void> {
    return new Promise(resolve => {
      if (!this.gsap || !root) {
        this.setModelOpacity(root, to);
        resolve();
        return;
      }
      const state = { o: from };
      this.setModelOpacity(root, from);
      this.gsap.to(state, {
        o: to,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => this.setModelOpacity(root, state.o),
        onComplete: () => {
          this.setModelOpacity(root, to);
          resolve();
        },
      });
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  narrate(text: string, anim: string = 'Idle', pose?: StagePose): void {
    if (this.introActive) return;
    this.bumpActivity();
    if (text !== this.lastNarration) {
      this.lastNarration = text;
      this.speechText = text;
      this.showSpeech = true;
      if (this.speechTimer) clearTimeout(this.speechTimer);
      this.speechTimer = setTimeout(() => { this.showSpeech = false; }, 5200);
      this.playAnim(anim);
      setTimeout(() => { if (!this.isSleeping && !this.introActive) this.playIdle(); }, 1600);
    }
    if (pose) this.applyPose(pose);
  }

  celebrate(): void {
    if (this.introActive) return;
    this.bumpActivity();
    this.playAnim('ThumbsUp');
    // Silent acknowledgment — no speech spam
    setTimeout(() => { if (!this.isSleeping) this.playIdle(); }, 1400);
  }

  /** Play = orbit/rotate Bud with the mouse. No spam greetings. */
  setPlayMode(on: boolean): void {
    this.playMode = on;
    this.setOrbitEnabled(on);
    if (on) {
      this.bumpActivity();
      this.speechText = 'drag to rotate.';
      this.showSpeech = true;
      if (this.speechTimer) clearTimeout(this.speechTimer);
      this.speechTimer = setTimeout(() => { this.showSpeech = false; }, 2200);
    } else {
      this.showSpeech = false;
      this.resetCameraSoft();
    }
  }

  /** Autopilot: reshuffled varied deck — hard to spot a loop. */
  setRandomMode(on: boolean): void {
    this.randomMode = on;
    if (this.randomTimer) {
      clearTimeout(this.randomTimer);
      this.randomTimer = null;
    }
    if (on) {
      this.bumpActivity();
      this.playlistIndex = 0;
      this.lastRandomClip = '';
      this.rebuildRandomDeck();
      this.showSpeech = false;
      this.advancePlaylist();
    } else {
      this.playIdle();
    }
  }

  onStageClick(): void {
    // Orbit mode only — no click greetings
  }

  private setOrbitEnabled(on: boolean): void {
    if (this.renderer?.domElement) {
      this.renderer.domElement.style.pointerEvents = on ? 'auto' : (this.stageOnly ? 'none' : 'auto');
      this.renderer.domElement.style.cursor = on ? 'grab' : '';
    }
    if (!this.controls) return;
    this.controls.enabled = on;
    this.controls.enableRotate = on;
    this.controls.enableZoom = on;
    this.controls.enablePan = false;
  }

  private resetCameraSoft(): void {
    if (!this.camera || !this.gsap) return;
    const isMobile = (this.canvasRef?.nativeElement?.clientWidth || window.innerWidth) < 768;
    this.gsap.to(this.camera.position, {
      x: isMobile ? 0.15 : 0.45,
      y: isMobile ? 1.0 : 1.15,
      z: isMobile ? 3.8 : 4.2,
      duration: 0.9,
      ease: 'power2.out',
    });
    if (this.controls) {
      this.gsap.to(this.controls.target, {
        x: 0, y: 0.85, z: 0,
        duration: 0.9,
        ease: 'power2.out',
        onUpdate: () => this.controls?.update(),
      });
    }
  }

  /** Fresh shuffled deck each pass — varying speed, hold, yaw; no back-to-back duplicates. */
  private rebuildRandomDeck(): void {
    const expressive = ['lookaround', 'wave', 'wave_oh', 'bow', 'cheer_m'];
    const rests = ['idle', 'idle2'];
    const pool: RandomBeat[] = [];

    for (let i = 0; i < 90; i++) {
      const useRest = Math.random() < 0.35;
      const clip = useRest
        ? rests[Math.floor(Math.random() * rests.length)]
        : expressive[Math.floor(Math.random() * expressive.length)];
      const speed = 0.75 + Math.random() * 0.55;
      const baseHold = useRest ? 1400 + Math.random() * 2800 : 1600 + Math.random() * 2200;
      pool.push({
        clip,
        holdMs: Math.round(baseHold / speed),
        yaw: (Math.random() - 0.5) * 0.7,
        speed,
      });
    }

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    for (let i = 1; i < pool.length; i++) {
      if (pool[i].clip === pool[i - 1].clip) {
        const swap = pool.findIndex((b, idx) => idx > i && b.clip !== pool[i].clip);
        if (swap > 0) [pool[i], pool[swap]] = [pool[swap], pool[i]];
      }
    }

    this.randomDeck = pool;
    this.playlistIndex = 0;
  }

  private advancePlaylist(): void {
    if (this.destroyed || this.introActive || !this.randomMode) return;

    if (this.playlistIndex >= this.randomDeck.length) {
      this.rebuildRandomDeck();
    }

    let beat = this.randomDeck[this.playlistIndex++];
    if (beat.clip === this.lastRandomClip && this.playlistIndex < this.randomDeck.length) {
      beat = this.randomDeck[this.playlistIndex++] || beat;
    }
    this.lastRandomClip = beat.clip;

    if (!this.playMode) this.targetYaw = beat.yaw;
    this.playClipDirect(beat.clip, beat.speed);

    if (this.randomTimer) {
      clearTimeout(this.randomTimer);
      this.randomTimer = null;
    }
    this.randomTimer = setTimeout(() => {
      if (this.destroyed || !this.randomMode) return;
      this.advancePlaylist();
    }, beat.holdMs);
  }

  private playClipDirect(name: string, speed = 1): void {
    if (!this.hasClipAnims) return;
    const banned = new Set([
      'walking', 'running', 'sprint', 'turn_l', 'turn_r', 'run_turn_l', 'run_turn_r',
      'dance', 'spin', 'flair', 'backflip', 'handstand', 'happy_jump',
    ]);
    let clip = banned.has(name) ? null : this.actions.get(name);
    if (!clip) clip = this.actions.get('lookaround') || this.actions.get('idle');
    if (!clip) return;
    if (this.currentAction) this.currentAction.fadeOut(0.28);
    this.currentAction = clip;
    const once = new Set(['wave', 'wave_oh', 'cheer_m', 'bow']);
    const clipName = clip.getClip?.()?.name || name;
    if (once.has(clipName) || once.has(name)) {
      clip.setLoop(this.T.LoopOnce, 1);
      clip.clampWhenFinished = true;
    } else {
      clip.setLoop(this.T.LoopRepeat, Infinity);
    }
    clip.timeScale = speed;
    clip.reset().fadeIn(0.28).play();
  }

  applyPose(pose: StagePose): void {
    if (!this.camera || !this.gsap || this.playMode) return;
    const isMobile = (this.canvasRef?.nativeElement?.clientWidth || window.innerWidth) < 768;
    this.gsap.to(this.camera.position, {
      x: pose.camX ?? (isMobile ? 0 : 0.35),
      y: pose.camY ?? (isMobile ? 1.15 : 1.35),
      z: pose.camZ ?? (isMobile ? 4.2 : 4.6),
      duration: 1.15,
      ease: 'power2.out',
    });
    if (pose.lookY !== undefined) {
      this.gsap.to(this.lookTarget, { y: pose.lookY, duration: 1.15, ease: 'power2.out' });
    }
    if (pose.robotYaw !== undefined) this.targetYaw = pose.robotYaw;
  }

  private checkBoredom(): void {
    if (this.destroyed || document.hidden || this.introActive) return;
    if (this.playMode || this.randomMode) return;
    if (Date.now() - this.lastActivity > 12000 && !this.isSleeping) {
      this.sleep('still there? i can wait…');
    }
  }

  private sleep(msg: string): void {
    if (this.isSleeping || this.introActive) return;
    this.isSleeping = true;
    this.playAnim('Sitting');
    this.speechText = msg;
    this.showSpeech = true;
    if (this.speechTimer) clearTimeout(this.speechTimer);
  }

  private wake(): void {
    if (!this.isSleeping) return;
    this.isSleeping = false;
    this.lastActivity = Date.now();
    this.playIdle();
    this.showSpeech = false;
  }

  private resolveClip(logical: string): any | null {
    if (this.actions.has(logical)) return this.actions.get(logical);
    // mascot-anim clips are lowercase; keep RobotExpressive names as fallback
    const aliases: Record<string, string[]> = {
      Idle: ['idle', 'idle2', 'Idle', 'Standing'],
      Wave: ['wave', 'Wave'],
      Thinking: ['lookaround', 'idle2', 'idle', 'Sitting'],
      Dance: ['dance', 'flair', 'spin', 'Dance', 'happy_jump'],
      ThumbsUp: ['cheer_m', 'wave', 'wave_oh', 'ThumbsUp'],
      Sitting: ['bow', 'idle', 'Sitting'],
      Walking: ['walking', 'running', 'Walking'],
    };
    for (const n of aliases[logical] || [logical]) {
      if (this.actions.has(n)) return this.actions.get(n);
    }
    return this.actions.get('idle') || this.actions.get('Idle') || null;
  }

  private playAnim(name: string): void {
    if (!this.hasClipAnims) return;
    const clip = this.resolveClip(name);
    if (!clip) return;
    if (this.currentAction === clip && (name === 'Idle' || name === 'Sitting' || name === 'Walking')) return;
    if (this.currentAction) this.currentAction.fadeOut(0.25);
    this.currentAction = clip;
    const once = [
      'Wave', 'ThumbsUp', 'Yes', 'No', 'Jump', 'Punch', 'Dance',
      'wave', 'wave_oh', 'cheer_m', 'dance', 'flair', 'spin', 'happy_jump', 'bow', 'backflip', 'handstand',
    ];
    const clipName = clip.getClip?.()?.name || name;
    if (once.includes(name) || once.includes(clipName)) {
      clip.setLoop(this.T.LoopOnce, 1);
      clip.clampWhenFinished = true;
    } else {
      clip.setLoop(this.T.LoopRepeat, Infinity);
    }
    clip.reset().fadeIn(0.25).play();
  }

  private playIdle(): void {
    if (this.isSleeping || this.introActive) return;
    this.playAnim('Idle');
  }

  private initScene(): void {
    const T = this.T;
    const el = this.canvasRef.nativeElement;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    this.scene = new T.Scene();
    const isMobile = w < 768;
    this.camera = new T.PerspectiveCamera(isMobile ? 38 : 32, w / h, 0.1, 100);
    // Frame humanoid mascot slightly right-of-center, a bit lower in the viewport
    this.camera.position.set(isMobile ? 0.15 : 0.45, isMobile ? 1.15 : 1.28, isMobile ? 4.0 : 4.35);
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
    this.controls.enabled = false;
    this.controls.target.set(0, 0.7, 0);
    this.controls.update();
    this.controls.addEventListener('start', () => { this.isDragging = true; });
    this.controls.addEventListener('end', () => { this.isDragging = false; });
  }

  private async loadRobot(GLTFLoader: any): Promise<{ fromCache: boolean }> {
    const url = '/models/robot.glb';
    const loader = new GLTFLoader();

    // Meshopt is REQUIRED for this GLB (EXT_meshopt_compression)
    try {
      const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
      if (MeshoptDecoder.ready) await MeshoptDecoder.ready;
      loader.setMeshoptDecoder(MeshoptDecoder);
    } catch (e) {
      console.warn('MeshoptDecoder unavailable', e);
    }

    let fromCache = false;
    let buffer: ArrayBuffer | null = null;

    try {
      const cache = await caches.open('bud-models-v1');
      const hit = await cache.match(url);
      if (hit) {
        fromCache = true;
        buffer = await hit.arrayBuffer();
      } else {
        const res = await fetch(url);
        buffer = await res.arrayBuffer();
        // Store a clone for next visits — cold load walks, warm load skips
        await cache.put(url, new Response(buffer.slice(0), {
          headers: { 'Content-Type': 'model/gltf-binary' }
        }));
      }
    } catch {
      // Cache API unavailable — fall through to normal load
    }

    const gltf = buffer
      ? await new Promise<any>((resolve, reject) => {
          loader.parse(buffer!, url, resolve, reject);
        })
      : await loader.loadAsync(url);

    this.robot = gltf.scene;
    const box = new this.T.Box3().setFromObject(this.robot);
    const size = new this.T.Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? 1.55 / size.y : 1;
    this.robot.scale.setScalar(scale);
    box.setFromObject(this.robot);
    const center = new this.T.Vector3();
    box.getCenter(center);
    this.robot.position.x -= center.x;
    this.robot.position.z -= center.z;
    this.robot.position.y -= box.min.y;
    // Sit a touch lower in frame so speech has room above the head
    this.robotBaseY = this.robot.position.y - 0.12;
    this.robot.position.y = this.robotBaseY;
    this.robotHomeZ = this.robot.position.z;
    this.headBone = null;
    this.headTopBone = null;
    this.robot.traverse((node: any) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((m: any) => {
            if (m.map) m.map.colorSpace = this.T.SRGBColorSpace;
            // Mascot uses emissiveTexture — keep emission lit
            if (m.emissiveMap) {
              m.emissiveMap.colorSpace = this.T.SRGBColorSpace;
              if (m.emissiveIntensity === undefined || m.emissiveIntensity < 0.4) {
                m.emissiveIntensity = 0.85;
              }
              if (m.emissive && m.emissive.isColor) m.emissive.setHex(0xffffff);
            }
            m.transparent = true;
            m.opacity = 1;
            m.needsUpdate = true;
          });
        }
      }
      if (node.isBone) this.captureHeadBones(node, 'robot');
    });
    this.scene.add(this.robot);
    this.mixer = new this.T.AnimationMixer(this.robot);
    if (gltf.animations?.length) {
      this.hasClipAnims = true;
      gltf.animations.forEach((clip: any) => {
        const action = this.mixer.clipAction(clip);
        const once = [
          'wave', 'wave_oh', 'cheer_m', 'dance', 'flair', 'spin', 'happy_jump',
          'bow', 'backflip', 'handstand', 'turn_l', 'turn_r', 'run_turn_l', 'run_turn_r',
        ];
        if (once.includes(clip.name)) {
          action.clampWhenFinished = true;
          action.loop = this.T.LoopOnce;
        }
        this.actions.set(clip.name, action);
      });
    }
    return { fromCache };
  }

  private buildEnvironment(T: any): void {
    const ground = new T.Mesh(
      new T.CircleGeometry(3.2, 64),
      new T.MeshStandardMaterial({ color: 0x0c0c14, roughness: 0.95, metalness: 0.02, transparent: true, opacity: 0.45 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const count = 160;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 7 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    this.particles = new T.Points(geo, new T.PointsMaterial({ color: 0xa1a1aa, size: 0.022, transparent: true, opacity: 0.22, sizeAttenuation: true }));
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
    if (this.destroyed || this.paused) return;
    this.animId = requestAnimationFrame(this.animate);
    const now = performance.now();
    const dt = this.lastFrameMs ? Math.min(0.05, (now - this.lastFrameMs) / 1000) : 0.016;
    this.lastFrameMs = now;
    this.time += dt;
    if (this.mixer) this.mixer.update(dt);
    // Keep human mixer ticking whenever a clip is active (not only when visible)
    if (this.humanMixer && (this.showingHuman || this.swapBusy || this.humanCurrent)) {
      this.humanMixer.update(dt);
    }
    if (this.robot && this.robot.visible) {
      const bob = this.introActive ? 0 : (this.isSleeping ? 0.01 : 0.028);
      this.robot.position.y = this.robotBaseY + Math.sin(this.time * 0.85) * bob;
      // Don't fight the user while they're orbiting
      if (!this.playMode || !this.isDragging) {
        this.currentYaw += (this.targetYaw - this.currentYaw) * 0.04;
        this.robot.rotation.y = this.currentYaw;
      }
    }
    if (this.headBone && !this.isDragging && !this.isSleeping && !this.introActive && !this.playMode && !this.showingHuman) {
      this.headBone.rotation.y += (this.mouseX * 0.14 - this.headBone.rotation.y) * 0.025;
      this.headBone.rotation.x += (this.mouseY * 0.06 - this.headBone.rotation.x) * 0.025;
    }
    // lookAt fights OrbitControls — skip while play/orbit is active
    if (this.camera && !this.playMode) {
      this.camera.lookAt(0, this.lookTarget.y, 0);
    }
    if (this.particles) this.particles.rotation.y += 0.0002;
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateSpeechAnchor();
  };

  /** Prefer Head for tracking — HeadTop + CSS lift was pinning lines to the screen top. */
  private captureHeadBones(node: any, who: 'robot' | 'human'): void {
    const lower = node.name.toLowerCase();
    if (!lower.includes('head')) return;
    const isTop =
      lower.includes('headtop') ||
      lower.includes('head_top') ||
      (lower.includes('end') && !lower.includes('front'));
    const isHead =
      (lower === 'head' || lower.includes('head')) &&
      !lower.includes('end') &&
      !lower.includes('front') &&
      !lower.includes('top');

    if (who === 'robot') {
      if (isTop && !this.headTopBone) this.headTopBone = node;
      if (isHead && !this.headBone) this.headBone = node;
    } else {
      if (isTop && !this.humanHeadTopBone) this.humanHeadTopBone = node;
      if (isHead && !this.humanHeadBone) this.humanHeadBone = node;
    }
  }

  /** Project active character head into CSS % of the stage and pin the bubble. */
  private updateSpeechAnchor(): void {
    const el = this.speechRef?.nativeElement;
    if (!el || !this.camera || !this.T) return;

    const useHuman = this.showingHuman && this.human?.visible;
    // Prefer Head (not HeadTop) so the bubble sits near the face, not the screen ceiling
    const anchor =
      (useHuman
        ? (this.humanHeadBone || this.humanHeadTopBone || this.human)
        : (this.headBone || this.headTopBone || this.robot)) || null;
    if (!anchor || (useHuman ? !this.human?.visible : !this.robot?.visible)) {
      return;
    }

    if (!this.speechWorld) this.speechWorld = new this.T.Vector3();
    if (typeof anchor.getWorldPosition === 'function') {
      anchor.getWorldPosition(this.speechWorld);
    } else {
      this.speechWorld.setFromMatrixPosition(anchor.matrixWorld);
    }

    // Lift well above the crown so the bubble clears the head
    this.speechWorld.y += 0.52;

    this.speechWorld.project(this.camera);
    if (this.speechWorld.z > 1) return;

    const x = (this.speechWorld.x * 0.5 + 0.5) * 100;
    const y = (-this.speechWorld.y * 0.5 + 0.5) * 100;
    const stageW = this.canvasRef?.nativeElement?.clientWidth || window.innerWidth;
    const mobile = stageW < 768;
    const clampedX = mobile
      ? Math.min(86, Math.max(14, x))
      : Math.min(90, Math.max(10, x));
    const clampedY = mobile
      ? Math.min(58, Math.max(16, y))
      : Math.min(68, Math.max(10, y));
    el.style.left = `${clampedX}%`;
    el.style.top = `${clampedY}%`;
  }

  private onResize = (): void => {
    const el = this.canvasRef?.nativeElement;
    if (!el || !this.camera || !this.renderer) return;
    this.camera.aspect = el.clientWidth / el.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
  };
}
