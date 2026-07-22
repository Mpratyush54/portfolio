import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

interface QAPair {
  question: string;
  answer: string;
}

interface ChatMessage {
  type: 'question' | 'answer';
  text: string;
}

@Component({
  selector: 'app-robot-buddy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './robot-buddy.html',
  styleUrl: './robot-buddy.scss'
})
export class RobotBuddyComponent implements AfterViewInit, OnDestroy {
  @ViewChild('robotCanvas') canvasRef!: ElementRef<HTMLDivElement>;

  open = false;
  messages: ChatMessage[] = [];
  selectedQuestion: string | null = null;

  qaPairs: QAPair[] = [
    {
      question: 'What projects have you built?',
      answer: 'I\'ve built 6+ projects including <b>ClassStream</b> (live education with DRM/WebRTC), <b>CAPS Automation</b> (cross-platform ops hub), <b>Phone Proctor</b> (AI exam integrity), <b>Ambue</b> (pharma scanner), and more. Check them out under <span class="cmd">/projects</span>.'
    },
    {
      question: 'What\'s your tech stack?',
      answer: '<b>Backend:</b> Node.js, Express, Python, Go, Rust<br><b>Frontend:</b> Angular, React, TypeScript<br><b>DevOps:</b> Docker, Kubernetes, ArgoCD, Nginx, GitHub Actions<br><b>Database:</b> MongoDB, MySQL, PostgreSQL<br><b>Other:</b> WebRTC, OpenCV, Three.js, WebSockets'
    },
    {
      question: 'Are you open to work?',
      answer: 'Yes! I\'m actively looking for opportunities as a <b>Backend Engineer</b> or <b>Full Stack Developer</b>. I thrive on building production systems at scale. Check my <span class="cmd">/resume</span> or head to <span class="cmd">/contact</span>.'
    },
    {
      question: 'What\'s your experience?',
      answer: 'I started coding in <b>2022</b> and have been building ever since. At <b>CHRIST University</b>, I lead the CAPS club\'s tech initiatives — building platforms used by the campus community. I\'ve shipped everything from DRM-protected video streaming to AI-powered exam proctoring, deployed on Kubernetes with full CI/CD.'
    },
    {
      question: 'How can I contact you?',
      answer: 'Email me at <a href="mailto:mpratyush54@gmail.com">mpratyush54@gmail.com</a> or connect on <a href="https://www.linkedin.com/in/pratyushm07" target="_blank">LinkedIn</a>. The contact form also works — I reply within 24 hours.'
    },
    {
      question: 'Tell me about yourself',
      answer: 'I\'m Pratyush Mishra — a <b>Backend Engineer</b> and <b>Full Stack Developer</b> passionate about building systems that scale. I believe in clean architecture, automated deployments, and developer experience. When I\'m not coding, I\'m exploring distributed systems, contributing to open source, or planning the next project.'
    }
  ];

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
  private mouseX = 0;
  private mouseY = 0;
  private animId = 0;
  private destroyed = false;
  private T: any = null;
  private time = 0;

  async ngAfterViewInit(): Promise<void> {
    try {
      this.T = await import('three');
      this.initScene();
      this.animate();
      window.addEventListener('resize', this.onResize);
    } catch {}
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); }
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open && this.messages.length === 0) {
      this.messages.push({ type: 'answer', text: 'Hi! I\'m Bud — your portfolio guide. Ask me anything about Pratyush.' });
    }
  }

  ask(qa: QAPair): void {
    this.messages.push({ type: 'question', text: qa.question });
    setTimeout(() => {
      this.messages.push({ type: 'answer', text: qa.answer });
      this.selectedQuestion = null;
    }, 400);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (!this.robot) return;
    const rect = this.canvasRef?.nativeElement?.getBoundingClientRect();
    if (!rect) return;
    this.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private initScene(): void {
    const T = this.T;
    const el = this.canvasRef.nativeElement;
    const w = el.clientWidth;
    const h = el.clientHeight;

    this.scene = new T.Scene();

    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0.5, 5);

    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(this.renderer.domElement);

    this.buildRobot(T);

    const ambient = new T.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const dir = new T.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 8, 6);
    this.scene.add(dir);
    const fill = new T.DirectionalLight(0x818cf8, 0.4);
    fill.position.set(-3, 1, 4);
    this.scene.add(fill);
  }

  private buildRobot(T: any): void {
    this.robot = new T.Group();

    const bodyGeo = new T.BoxGeometry(1.2, 1.4, 0.8);
    const bodyMat = new T.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4, metalness: 0.3 });
    const body = new T.Mesh(bodyGeo, bodyMat);
    body.position.y = -0.3;
    this.robot.add(body);

    const headGeo = new T.SphereGeometry(0.55, 20, 20);
    const headMat = new T.MeshStandardMaterial({ color: 0x312e81, roughness: 0.3, metalness: 0.4 });
    this.head = new T.Mesh(headGeo, headMat);
    this.head.position.y = 0.8;
    this.robot.add(this.head);

    const eyeMat = new T.MeshStandardMaterial({ color: 0x818cf8, emissive: 0x818cf8, emissiveIntensity: 0.5 });
    const eyeGeo = new T.SphereGeometry(0.12, 12, 12);
    this.leftEye = new T.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.2, 0.9, 0.5);
    this.robot.add(this.leftEye);
    this.rightEye = new T.Mesh(eyeGeo.clone(), eyeMat);
    this.rightEye.position.set(0.2, 0.9, 0.5);
    this.robot.add(this.rightEye);

    const antennaMat = new T.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.2, metalness: 0.6 });
    const antenna = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.4, 6), antennaMat);
    antenna.position.set(0, 1.3, 0);
    this.robot.add(antenna);
    this.antennaBall = new T.Mesh(
      new T.SphereGeometry(0.08, 10, 10),
      new T.MeshStandardMaterial({ color: 0x818cf8, emissive: 0x818cf8, emissiveIntensity: 0.8 })
    );
    this.antennaBall.position.set(0, 1.5, 0);
    this.robot.add(this.antennaBall);

    const armMat = new T.MeshStandardMaterial({ color: 0x312e81, roughness: 0.4, metalness: 0.3 });
    const armGeo = new T.CylinderGeometry(0.08, 0.1, 0.7, 8);
    this.leftArm = new T.Mesh(armGeo, armMat);
    this.leftArm.position.set(-0.75, 0.1, 0);
    this.leftArm.rotation.z = 0.2;
    this.leftArm.rotation.x = -0.3;
    this.robot.add(this.leftArm);
    this.rightArm = new T.Mesh(armGeo.clone(), armMat);
    this.rightArm.position.set(0.75, 0.1, 0);
    this.rightArm.rotation.z = -0.2;
    this.rightArm.rotation.x = 0.3;
    this.robot.add(this.rightArm);

    this.scene.add(this.robot);
  }

  private animate = (): void => {
    if (this.destroyed || !this.robot) return;
    this.animId = requestAnimationFrame(this.animate);
    this.time += 0.02;

    const floatY = Math.sin(this.time * 1.2) * 0.08;
    this.robot.position.y = floatY;

    const headTiltX = this.mouseY * 0.15;
    const headTiltY = this.mouseX * 0.2;
    this.head.rotation.x = headTiltX;
    this.head.rotation.y = headTiltY;
    this.leftEye.position.x = -0.2 + this.mouseX * 0.03;
    this.leftEye.position.y = 0.9 - this.mouseY * 0.03;
    this.rightEye.position.x = 0.2 + this.mouseX * 0.03;
    this.rightEye.position.y = 0.9 - this.mouseY * 0.03;

    this.antennaBall.material.emissiveIntensity = 0.5 + Math.sin(this.time * 2) * 0.3;

    const armSwing = Math.sin(this.time * 0.8) * 0.1;
    this.leftArm.rotation.z = 0.2 + armSwing;
    this.rightArm.rotation.z = -0.2 - armSwing;

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
