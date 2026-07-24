import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/project.model';

@Component({
    selector: 'app-project-detail',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './project-detail.html',
    styleUrl: './project-detail.scss'
})
export class ProjectDetailComponent implements OnInit { 
    project: Project | undefined;
    isLoading = true;

    // Donut chart
    hoveredIndex: number | null = null;

    // Access modal
    isAccessModalOpen = false;

    get statusBadge(): { label: string, type: 'live' | 'code' | 'concept' } {
        if (!this.project) return { label: '', type: 'concept' };
        if (this.project.link) return { label: 'Live', type: 'live' };
        if (this.project.repo || this.project.frontendRepo) return { label: 'Open Source', type: 'code' };
        return { label: 'Concept', type: 'concept' };
    }

    get chartData() {
        if (!this.project?.languageStats) return [];
        let cumulativePercent = 0;
        return this.project.languageStats.map((lang, index) => {
            const startOffset = cumulativePercent;
            cumulativePercent += lang.percent;
            return { ...lang, index, dashArray: `${lang.percent} 100`, dashOffset: -startOffset };
        });
    }

    constructor(
        private route: ActivatedRoute,
        private apiService: ApiService,
        private router: Router
    ) {}

    private fallbackProjects: Project[] = [
        {
            _id: 'classstream',
            title: 'ClassStream',
            shortDescription: 'Live education platform with DRM video streaming, WebRTC, and real-time quizzes for 100+ concurrent users.',
            fullDescription: 'A comprehensive live education platform built for CHRIST University. Features DRM-protected video streaming, WebRTC-based live classes, real-time quizzes, attendance tracking, and analytics dashboard.',
            features: ['DRM video streaming', 'WebRTC live classes', 'Real-time quizzes', 'Attendance tracking', 'Analytics dashboard'],
            tags: ['Angular', 'Node.js', 'WebRTC', 'MongoDB', 'Docker', 'Kubernetes'],
            category: 'Web',
            source: 'github',
            status: { phase: 'Production', ciStatus: 'Passing' },
            timeline: { start: '2024-01', history: [{ phase: 'Launch', date: '2024-06', completed: true }] },
            link: 'https://classstream.christuniversity.in',
        },
        {
            _id: 'caps-automation',
            title: 'CAPS Automation',
            shortDescription: 'Club management automation platform — event management, member tracking, and automated workflows.',
            fullDescription: 'End-to-end automation for CHRIST University\'s CAPS club. Manages events, member registrations, feedback collection, and certificate generation with automated email workflows.',
            features: ['Event management', 'Member tracking', 'Automated certificates', 'Email workflows', 'Analytics'],
            tags: ['React', 'Python', 'PostgreSQL', 'Docker', 'GitHub Actions'],
            category: 'Web',
            source: 'github',
            status: { phase: 'Production', ciStatus: 'Passing' },
            timeline: { start: '2024-03', history: [{ phase: 'Launch', date: '2024-08', completed: true }] },
        },
        {
            _id: 'phone-proctor',
            title: 'Phone Proctor',
            shortDescription: 'AI-powered exam proctoring system using computer vision for integrity monitoring.',
            fullDescription: 'An AI proctoring solution that uses computer vision to monitor exam takers. Detects suspicious behavior, tracks gaze, and provides real-time alerts to proctors.',
            features: ['Face detection', 'Gaze tracking', 'Behavior analysis', 'Real-time alerts', 'Session recording'],
            tags: ['Python', 'TensorFlow', 'OpenCV', 'React', 'WebSocket'],
            category: 'Web',
            source: 'github',
            status: { phase: 'Production', ciStatus: 'Passing' },
            timeline: { start: '2024-05', history: [{ phase: 'Launch', date: '2024-10', completed: true }] },
        },
        {
            _id: 'ambue',
            title: 'Ambue',
            shortDescription: 'Pharmaceutical barcode scanning app with inventory management and expiry tracking.',
            fullDescription: 'A mobile-first pharmaceutical management app featuring barcode scanning, inventory tracking, expiry date monitoring, and automated reorder alerts.',
            features: ['Barcode scanning', 'Inventory tracking', 'Expiry monitoring', 'Reorder alerts', 'Analytics'],
            tags: ['Flutter', 'Node.js', 'MongoDB', 'AWS'],
            category: 'Mobile',
            source: 'github',
            status: { phase: 'Production', ciStatus: 'Passing' },
            timeline: { start: '2024-02', history: [{ phase: 'Launch', date: '2024-07', completed: true }] },
        },
        {
            _id: 'gitops-pipeline',
            title: 'Kubernetes GitOps Pipeline',
            shortDescription: 'Automated CI/CD pipeline with ArgoCD, GitHub Actions, and Helm for cloud-native deployments.',
            fullDescription: 'A production-grade GitOps pipeline using ArgoCD for declarative Kubernetes deployments, GitHub Actions for CI, and Helm for package management.',
            features: ['GitOps workflow', 'Automated rollbacks', 'Canary deployments', 'Helm charts', 'Monitoring'],
            tags: ['Kubernetes', 'ArgoCD', 'GitHub Actions', 'Helm', 'Docker'],
            category: 'DevOps',
            source: 'github',
            status: { phase: 'Production', ciStatus: 'Passing' },
            timeline: { start: '2024-04', history: [{ phase: 'Launch', date: '2024-09', completed: true }] },
        },
        {
            _id: 'portfolio-site',
            title: 'Portfolio Site',
            shortDescription: 'Personal portfolio with 3D interactive robot, chat, terminal, and project showcase.',
            fullDescription: 'A modern Angular portfolio featuring a Three.js 3D robot with speech bubbles, interactive chat widget, command-palette terminal, and full project showcase with filtering.',
            features: ['3D robot scene', 'Interactive chat', 'Command terminal', 'Project showcase', 'Dark/light theme'],
            tags: ['Angular', 'Three.js', 'TypeScript', 'SCSS', 'Vercel'],
            category: 'Web',
            source: 'github',
            status: { phase: 'Production', ciStatus: 'Passing', deploymentType: 'Vercel' },
            timeline: { start: '2025-06', history: [{ phase: 'Launch', date: '2025-07', completed: true }] },
        },
        {
            _id: 'ai-chat-assistant',
            title: 'AI Chat Assistant',
            shortDescription: 'Real-time AI chatbot with context-aware responses and streaming output.',
            fullDescription: 'A real-time AI chat assistant built with WebSocket streaming, context-aware conversation management, and markdown rendering for rich responses.',
            features: ['Streaming responses', 'Context management', 'Markdown rendering', 'Conversation history'],
            tags: ['React', 'Node.js', 'WebSocket', 'OpenAI', 'Redis'],
            category: 'Web',
            source: 'github',
            status: { phase: 'Development', ciStatus: 'Passing' },
            timeline: { start: '2025-03', history: [{ phase: 'Development', date: '2025-03', completed: false }] },
        },
        {
            _id: 'microservices-ecommerce',
            title: 'Microservices E-Commerce',
            shortDescription: 'Scalable e-commerce backend with microservices architecture, message queues, and event sourcing.',
            fullDescription: 'A distributed e-commerce system with separate services for orders, inventory, payments, and notifications. Uses RabbitMQ for async communication and event sourcing for audit trails.',
            features: ['Microservices', 'Event sourcing', 'Message queues', 'CQRS pattern', 'Distributed tracing'],
            tags: ['Go', 'PostgreSQL', 'RabbitMQ', 'Docker', 'gRPC'],
            category: 'Backend',
            source: 'github',
            status: { phase: 'Development', ciStatus: 'Not Configured' },
            timeline: { start: '2025-01', history: [{ phase: 'Architecture', date: '2025-02', completed: true }] },
        },
    ];

    ngOnInit() {
        this.isLoading = true;
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) { this.router.navigate(['/404']); return; }

        const fallback = this.fallbackProjects.find(p => p._id === id);
        if (fallback) {
            this.project = fallback;
            this.isLoading = false;
        }

        this.apiService.getProjectById(id).subscribe({
            next: (project) => {
                this.project = project;
                this.isLoading = false;
            },
            error: () => {
                if (!this.project) {
                    this.router.navigate(['/404']);
                }
            }
        });
    }

    setHover(index: number | null) { this.hoveredIndex = index; }

    openAccessModal() { this.isAccessModalOpen = true; document.body.style.overflow = 'hidden'; }
    closeAccessModal() { this.isAccessModalOpen = false; document.body.style.overflow = ''; }
    submitAccessRequst(event: Event) { event.preventDefault(); alert('Request Sent! We will get back to you shortly.'); this.closeAccessModal(); }

    getCategoryColor(cat: string): string {
        const colors: Record<string, string> = { 'Performance': '#10b981', 'Security': '#3b82f6', 'Scalability': '#8b5cf6', 'UX': '#f59e0b', 'Architecture': '#ec4899', 'Maintainability': '#14b8a6' };
        return colors[cat] || '#6b7280';
    }
}
