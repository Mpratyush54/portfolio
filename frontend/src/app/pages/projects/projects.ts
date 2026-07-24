import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/project.model';
import { ProjectCardComponent } from '../../components/project-card/project-card';

@Component({
    selector: 'app-projects',
    standalone: true,
    imports: [CommonModule, ProjectCardComponent],
    templateUrl: './projects.html',
    styleUrl: './projects.scss'
})
export class ProjectsComponent implements OnInit {
    apiService = inject(ApiService);
    router = inject(Router);
    isLoading = true;
    pageTitle = 'Application Development';
    subtitleText = '';
    contextCategories: string[] = ['Web', 'Mobile'];
    categories: string[] = ['All'];
    selectedCategory = 'All';
    sourceFilters = [
        { value: 'all', label: 'All Sources' },
        { value: 'github', label: 'GitHub' },
        { value: 'gitlab', label: 'GitLab' }
    ];
    selectedSource = 'all';
    filteredProjects: Project[] = [];
    allProjects: Project[] = [];
    private apiProjects: Project[] = [];

    private fallbackProjects: Project[] = [
        {
            _id: 'classstream',
            title: 'ClassStream — Live Education Platform',
            shortDescription: 'Live education platform with DRM video streaming, WebRTC live classes, and real-time quizzes for 500+ concurrent users.',
            fullDescription: 'A full-stack school management platform with DRM-protected video streaming, live classes, real-time chat, and collaborative tools for teachers and students. Built for CHRIST University.',
            features: ['DRM video streaming', 'WebRTC live classes', 'Real-time quizzes', 'Attendance tracking', 'Analytics dashboard'],
            tags: ['Angular', 'Node.js', 'WebRTC', 'MongoDB', 'Docker', 'Kubernetes'],
            category: 'Web',
            source: 'github',
            status: { phase: 'Production', ciStatus: 'Passing' },
            timeline: { start: '2024-01', history: [{ phase: 'Launch', date: '2024-06', completed: true }] },
            link: 'https://classstream.christuniversity.in',
            frontendRepo: 'https://github.com/Mpratyush54/classstream-frontend',
            backendRepo: 'https://github.com/Mpratyush54/classstream-backend',
        },
        {
            _id: 'platform-paas',
            title: 'Platform — Internal PaaS with Multi-SDK',
            shortDescription: 'Internal PaaS with four SDK packages (Angular, React, Node, Python), Kubernetes OAuth2 ingress, and automated CI/CD.',
            fullDescription: 'An internal platform-as-a-service providing reusable SDK packages in Angular, React, Node.js, and Python. Runs on Kubernetes with OAuth2 proxy SSO, Docker Compose local dev parity, and GitHub Actions CI/CD.',
            features: ['Multi-language SDKs', 'Kubernetes + OAuth2 SSO', 'Docker Compose dev parity', 'Automated CI/CD', 'Platform bootstrap script'],
            tags: ['TypeScript', 'Python', 'Kubernetes', 'Docker', 'OAuth2', 'SDK', 'DevOps'],
            category: 'DevOps',
            source: 'github',
            status: { phase: 'Development', ciStatus: 'Passing' },
            timeline: { start: '2026-06', history: [{ phase: 'SDK Architecture', date: '2026-06', completed: true }, { phase: 'K8s + OAuth2', date: 'Present', completed: false }] },
            repo: 'https://github.com/Mpratyush54/server-automation',
        },
        {
            _id: 'exam-protector',
            title: 'Exam Protector — Mobile Exam Security',
            shortDescription: 'Distributed AI proctoring with real-time computer vision anomaly detection and automated anti-cheating supervision.',
            fullDescription: 'A full exam security system: the Android app monitors device activity (app switches, screenshots, multi-face detection) while the Python backend runs distributed CV pipelines with OpenCV for real-time anomaly detection via WebSocket.',
            features: ['Computer vision anomaly detection', 'Real-time WebSocket alerts', 'App-switch detection & lock', 'Distributed worker architecture', 'Desktop Python anti-cheating engine'],
            tags: ['Python', 'OpenCV', 'JavaScript', 'Kotlin', 'WebSocket', 'RabbitMQ', 'Android'],
            category: 'Mobile',
            source: 'github',
            status: { phase: 'Development', ciStatus: 'Passing' },
            timeline: { start: '2026-02', history: [{ phase: 'Backend Launch', date: '2026-02', completed: true }, { phase: 'Mobile App', date: '2026-02', completed: true }] },
            frontendRepo: 'https://github.com/Mpratyush54/exam-protector-mobile',
            backendRepo: 'https://github.com/Mpratyush54/Phone-Proctor',
        },
        {
            _id: 'ambue',
            title: 'Ambue — Pharma Scanner & Inventory',
            shortDescription: 'Android + web pharmaceutical management — scan drug barcodes to authenticate medicines and track inventory in real-time.',
            fullDescription: 'An Android barcode scanner app with a Node.js/TypeScript backend. Pharmacists scan drug barcodes to verify authenticity and track inventory with low-stock alerts, expiry tracking, and multi-location management.',
            features: ['Android barcode scanning', 'Drug authentication', 'Real-time inventory', 'Multi-location management', 'Expiry tracking'],
            tags: ['JavaScript', 'Node.js', 'TypeScript', 'Android', 'Pharmaceutical'],
            category: 'Mobile',
            source: 'github',
            status: { phase: 'Production', ciStatus: 'Passing' },
            timeline: { start: '2024-02', history: [{ phase: 'Launch', date: '2024-07', completed: true }] },
            repo: 'https://github.com/Mpratyush54/Ambue-pharmacutical-scanner-android-web-backend',
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
            repo: 'https://github.com/Mpratyush54/portfolio',
        },
    ];

    ngOnInit() {
        const url = this.router.url;
        if (url.includes('systems')) {
            this.pageTitle = 'Systems & Infrastructure';
            this.contextCategories = ['DevOps', 'Backend'];
        }
        this.categories = ['All', ...this.contextCategories];
        this.subtitleText = `Showcasing my work in ${this.contextCategories.join(' & ')}`;

        this.applyContextFilter();
        this.isLoading = false;

        this.apiService.getProjects().subscribe({
            next: (data) => {
                if (data && data.length > 0) {
                    this.apiProjects = data;
                    this.applyContextFilter();
                }
            },
            error: () => {}
        });
    }

    private applyContextFilter() {
        const source = this.apiProjects.length > 0 ? this.apiProjects : this.fallbackProjects;
        if (this.contextCategories.length > 0) {
            this.allProjects = source.filter(p => this.contextCategories.includes(p.category));
        } else {
            this.allProjects = [...source];
        }
        this.applyFilters();
    }

    setCategory(c: string) { this.selectedCategory = c; this.applyFilters(); }
    setSource(s: string) { this.selectedSource = s; this.applyFilters(); }

    applyFilters() {
        let f = this.allProjects;
        if (this.selectedCategory !== 'All') f = f.filter(p => p.category === this.selectedCategory);
        if (this.selectedSource !== 'all') f = f.filter(p => p.source === this.selectedSource);
        this.filteredProjects = f;
    }

    switchContext(context: 'apps' | 'systems' | 'all') {
        if (context === 'all') {
            this.pageTitle = 'All Projects';
            this.contextCategories = [];
            this.subtitleText = 'Every project across every domain';
            this.categories = ['All'];
            this.applyContextFilter();
            return;
        }
        const targetUrl = context === 'apps' ? '/projects' : '/projects/systems';
        if (this.router.url === targetUrl) {
            this.pageTitle = context === 'apps' ? 'Application Development' : 'Systems & Infrastructure';
            this.contextCategories = context === 'apps' ? ['Web', 'Mobile'] : ['DevOps', 'Backend'];
            this.subtitleText = `Showcasing my work in ${this.contextCategories.join(' & ')}`;
            this.categories = ['All', ...this.contextCategories];
            this.selectedCategory = 'All';
            this.applyContextFilter();
            return;
        }
        this.router.navigate([targetUrl]);
    }
}
