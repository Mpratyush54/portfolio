import { Project } from '../models/project.model';

export type WorkKind = 'all' | 'development' | 'cloud';

export function workKind(project: Project): Exclude<WorkKind, 'all'> {
  return project.category === 'DevOps' ? 'cloud' : 'development';
}

export function workKindLabel(project: Project): string {
  return workKind(project) === 'cloud' ? 'Cloud' : 'Development';
}

export function filterWork(projects: Project[], kind: WorkKind): Project[] {
  if (kind === 'all') return projects;
  return projects.filter((project) => workKind(project) === kind);
}

export const FALLBACK_PROJECTS: Project[] = [
  {
    _id: '1',
    title: 'Platform — Internal PaaS with Multi-SDK',
    shortDescription:
      'Self-hosted PaaS on Kubernetes with SDKs for Node, Python, Angular and React.',
    fullDescription:
      'An internal platform so new services go from git push to a preview URL without reinventing auth, data stores or monitoring.',
    features: ['Multi-language SDKs', 'Kubernetes + GitOps', 'OAuth2 SSO'],
    tags: ['TypeScript', 'Kubernetes', 'Docker', 'OAuth2'],
    category: 'DevOps',
    source: 'github',
    status: { phase: 'Development' },
  },
  {
    _id: '2',
    title: 'ClassStream — Live Education Platform',
    shortDescription:
      'Live classes, DRM video and real-time quizzes for hundreds of concurrent students.',
    fullDescription:
      'A school platform with protected streaming, live sessions and teacher tools, built for CHRIST University.',
    features: ['DRM video', 'WebRTC classes', 'Live quizzes'],
    tags: ['Angular', 'Node.js', 'WebRTC', 'MongoDB'],
    category: 'Web',
    source: 'github',
    status: { phase: 'Production' },
  },
  {
    _id: '3',
    title: 'DayFlow — HRMS',
    shortDescription: 'Attendance, presence and HR workflows for campus teams.',
    fullDescription: 'An HR system with offline-first attendance and live presence.',
    features: ['Attendance', 'Presence', 'HR workflows'],
    tags: ['Angular', 'Node.js'],
    category: 'Web',
    source: 'github',
    status: { phase: 'Production' },
  },
  {
    _id: '4',
    title: 'CAPS Automation — Operations Portal',
    shortDescription:
      'Official CAPS ops stack: events, certificates, RAG reports, worklogs, Google sync, Kubernetes, and remote MCP.',
    fullDescription:
      'Operations system for CAPS Kengeri covering events, certificates, reports, worklogs, Google sync and a role-aware MCP server.',
    features: [
      'Events and registration workers',
      'Certificate templates and verify',
      'RAG reports and worklogs',
      'Remote MCP with OAuth PKCE',
    ],
    tags: ['React', 'Node.js', 'MongoDB', 'Redis', 'MCP', 'Kubernetes'],
    category: 'Web',
    source: 'github',
    status: { phase: 'Production' },
  },
  {
    _id: '5',
    title: 'Phone Proctor — AI Exam Integrity',
    shortDescription: 'Distributed exam integrity with device signals and computer vision.',
    fullDescription: 'A proctoring stack that watches device activity and flags anomalies in real time.',
    features: ['Sensor fusion', 'Human review', 'Realtime alerts'],
    tags: ['Python', 'OpenCV', 'WebSocket'],
    category: 'Backend',
    source: 'github',
    status: { phase: 'Development' },
  },
  {
    _id: '6',
    title: 'Ambue — Pharma Reporting Platform',
    shortDescription: 'Medicine verification and inventory reporting for pharmacies.',
    fullDescription: 'Scan and report pharmaceutical stock with authenticity checks.',
    features: ['Inventory', 'Verification', 'Reporting'],
    tags: ['TypeScript', 'Node.js'],
    category: 'Web',
    source: 'github',
    status: { phase: 'Production' },
  },
  {
    _id: '7',
    title: 'Vision-You — AI Career Guidance',
    shortDescription: 'Structured career guidance with constrained model output.',
    fullDescription: 'A guidance product that keeps AI answers in a strict, reviewable format.',
    features: ['Structured output', 'Guidance flows'],
    tags: ['TypeScript', 'AI'],
    category: 'Web',
    source: 'github',
    status: { phase: 'Production' },
  },
  {
    _id: '8',
    title: 'CAPS Kengeri — Club Website',
    shortDescription: 'Public club site with events, membership and SEO-first pages.',
    fullDescription: 'The public face of CAPS Kengeri.',
    features: ['Events', 'SEO', 'Public pages'],
    tags: ['Angular'],
    category: 'Web',
    source: 'github',
    status: { phase: 'Production' },
  },
  {
    _id: '9',
    title: 'Recalibrate Forum — Student Support',
    shortDescription: 'Moderated student support forum with role-based access.',
    fullDescription: 'A support forum with three-tier moderation.',
    features: ['Moderation', 'RBAC', 'Support threads'],
    tags: ['TypeScript'],
    category: 'Web',
    source: 'github',
    status: { phase: 'Production' },
  },
  {
    _id: '10',
    title: 'Battery Aadhar — Battery Health Monitor',
    shortDescription: 'Edge battery-health monitoring with a Rust collector.',
    fullDescription: 'Track battery health from the edge into a reporting backend.',
    features: ['Edge collection', 'Health reports'],
    tags: ['Rust', 'Backend'],
    category: 'Backend',
    source: 'github',
    status: { phase: 'Development' },
  },
];
