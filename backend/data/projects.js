const projects = [
  {
    title: 'Platform — Internal PaaS with Multi-SDK',
    shortDescription:
      'Self-hosted PaaS on Kubernetes with SDKs for Node, Python, Angular, and React — git push to preview URL with GitOps, SSO, and observability built in.',
    fullDescription: `Platform is an internal PaaS I architected so new services go from idea to deployed without reinventing auth, databases, logging, or monitoring.

Four first-party SDKs (Node.js, Python, Angular, React) abstract Postgres / Mongo / Redis pools, Loki log forwarding, and Prometheus heartbeats. An Angular portal and Next.js-style API sit on Kubernetes with OAuth2 SSO, ArgoCD GitOps, and Docker Compose for local parity.

Target: take a service from git push to a live preview URL in about five minutes, with a four-tier config hierarchy (Global → Project → Environment → Instance) and zero-restart rollouts.`,
    features: [
      'SDKs for Node.js, Python, Angular, React',
      'Kubernetes + ArgoCD GitOps',
      'OAuth2 SSO across internal tools',
      'Docker Compose local parity',
      'Prometheus / Grafana / Loki observability',
      'One-command cluster bootstrap'
    ],
    tags: ['TypeScript', 'Kubernetes', 'Docker', 'OAuth2', 'SDK', 'DevOps'],
    repo: 'https://github.com/Mpratyush54/server-automation',
    category: 'DevOps',
    source: 'github',
    sourceUrl: 'https://github.com/Mpratyush54/server-automation',
    featured: true,
    languageStats: [
      { name: 'TypeScript', percent: 52, color: '#3178C6' },
      { name: 'Python', percent: 16, color: '#3776AB' },
      { name: 'HTML', percent: 13, color: '#E34C26' },
      { name: 'Shell', percent: 10, color: '#89e051' },
      { name: 'CSS', percent: 5, color: '#563D7C' },
      { name: 'JavaScript', percent: 4, color: '#F7DF1E' }
    ],
    deployment: {
      type: 'Internal PaaS + SDK Packages',
      platform: 'Kubernetes (on-prem) + Docker Compose',
      url: '',
      details:
        'On-prem Kubernetes with OAuth2 proxy SSO. Docker Compose for local Postgres, Mongo, Redis, MinIO, Loki, Prometheus, and Grafana. SDKs published via CI.',
      ciCd: 'GitHub Actions — lint, test, build, and publish SDKs on conventional commits.'
    },
    architecture: {
      title: 'How Platform Works',
      steps: [
        {
          icon: '📦',
          label: 'SDK abstracts infrastructure',
          description:
            'Services import the SDK and get managed DB pools, heartbeats, and log forwarding without raw driver wiring.'
        },
        {
          icon: '🔐',
          label: 'OAuth2 SSO',
          description: 'Internal tools sit behind an OAuth2 proxy — one institutional login, no per-service secrets.'
        },
        {
          icon: '☸️',
          label: 'GitOps deploy',
          description: 'ArgoCD + Helm take git push to a preview URL with rolling updates and health checks.'
        },
        {
          icon: '📊',
          label: 'Observability by default',
          description: 'Prometheus metrics, Grafana dashboards, and Loki logs ship from every onboarded service.'
        }
      ]
    },
    techDetails: [
      {
        title: 'Multi-language SDK contract',
        description:
          'Shared API contract with idiomatic clients — injectables in Angular, hooks in React, middleware in Node, decorators in Python.',
        category: 'Architecture',
        tags: ['SDK', 'API Design']
      },
      {
        title: 'Four-tier config hierarchy',
        description:
          'Global → Project → Environment → Instance with timed refresh so config rolls without restarts.',
        category: 'Architecture',
        tags: ['Config', 'Ops']
      }
    ],
    status: { phase: 'Development', since: '2026-06', ciStatus: 'Passing', deploymentType: 'Manual' },
    timeline: {
      start: 'Jun 2026',
      end: 'Active',
      history: [
        { phase: 'SDK architecture', date: 'Jun 2026', completed: true },
        { phase: 'Node & Python SDKs', date: 'Jun 2026', completed: true },
        { phase: 'Angular & React SDKs', date: 'Jul 2026', completed: true },
        { phase: 'K8s + OAuth2 hardening', date: 'Present', completed: false }
      ]
    }
  },

  {
    title: 'ClassStream — Live Education Platform',
    shortDescription:
      'Production LMS with DRM-protected DASH video, RTMP live ingest, Socket.IO chat, and an Angular PWA — live at school.pratyushes.dev.',
    fullDescription: `ClassStream is a solo-built school platform: content delivery, live classes, notes, notifications, and admin workflows in one product.

The hard part is the secure streaming path — FFmpeg transcodes to 1080p/720p/480p, Bento4 packages MPEG-DASH with CENC ClearKey, and a two-step key API (/issue-key then /get-key) blocks offline key extraction. Node.js + Express (~45 REST endpoints) over MySQL + MongoDB; Angular PWA on the front; RTMP ingest via node-media-server for live sessions.`,
    features: [
      'DASH + ClearKey DRM',
      'RTMP live ingest',
      'Socket.IO chat',
      'Cross-device notes',
      'Role-based access',
      'PWA / offline shell'
    ],
    tags: ['Angular', 'Node.js', 'TypeScript', 'DRM', 'Socket.io', 'MySQL', 'MongoDB'],
    link: 'https://school.pratyushes.dev/',
    frontendRepo: 'https://github.com/Mpratyush54/classstream-frontend',
    backendRepo: 'https://github.com/Mpratyush54/classstream-backend',
    category: 'Web',
    source: 'github',
    sourceUrl: 'https://github.com/Mpratyush54/classstream-frontend',
    featured: true,
    languageStats: [
      { name: 'JavaScript', percent: 48, color: '#F7DF1E' },
      { name: 'CSS', percent: 22, color: '#563D7C' },
      { name: 'TypeScript', percent: 8, color: '#3178C6' },
      { name: 'HTML', percent: 8, color: '#E34C26' },
      { name: 'Python', percent: 5, color: '#3776AB' },
      { name: 'SCSS', percent: 4, color: '#C6538C' }
    ],
    deployment: {
      type: 'Web Application',
      platform: 'Vercel (frontend) + self-hosted VPS (backend)',
      url: 'https://school.pratyushes.dev/',
      details:
        'Angular PWA on Vercel. Node/Express on VPS with PM2. MySQL + MongoDB. Media pipeline with FFmpeg and Bento4.',
      ciCd: 'GitHub Actions for build and deploy on main.'
    },
    architecture: {
      title: 'How ClassStream Works',
      steps: [
        {
          icon: '🎬',
          label: 'Ingest & package',
          description: 'Uploads and RTMP live feeds are transcoded and packaged as encrypted DASH.'
        },
        {
          icon: '🔑',
          label: 'Two-step DRM keys',
          description: 'Short-lived dummy keys first; real ClearKey material only after session validation.'
        },
        {
          icon: '📡',
          label: 'Live interaction',
          description: 'Socket.IO carries chat and class events while students watch adaptive streams.'
        },
        {
          icon: '💾',
          label: 'Dual datastore',
          description: 'MySQL for relational school data; MongoDB for audits and streaming key logs.'
        }
      ]
    },
    techDetails: [
      {
        title: 'DASH + ClearKey DRM',
        description: 'Adaptive bitrate with per-session keys issued only to authenticated viewers.',
        category: 'Security',
        tags: ['DRM', 'DASH']
      },
      {
        title: 'Angular PWA',
        description: 'Standalone components, Signals, service worker caching for notes and shell.',
        category: 'UX',
        tags: ['PWA', 'Angular']
      }
    ],
    status: { phase: 'Production', since: '2023', ciStatus: 'Passing', deploymentType: 'Vercel' },
    timeline: {
      start: 'Dec 2022',
      end: 'Active',
      history: [
        { phase: 'Backend', date: 'Dec 2022', completed: true },
        { phase: 'Frontend', date: 'Dec 2023', completed: true },
        { phase: 'DRM streaming', date: '2024', completed: true },
        { phase: 'Ongoing improvements', date: 'Present', completed: false }
      ]
    }
  },

  {
    title: 'DayFlow — HRMS',
    shortDescription:
      'Full-stack HRMS with JWT RBAC, attendance (offline PWA queue + SSE live presence), leave, payroll, and Swagger — React 19 + Node/Express + MongoDB.',
    fullDescription: `DayFlow is a human resource management system covering auth, employee profiles, attendance, leave, and payroll visibility.

Employees check in/out with an offline-capable PWA queue that flushes on reconnect. Admins see live "still in" counts over SSE with polling fallback. Role middleware separates Employee vs HR/Admin. Seeded demo data makes the stack easy to explore locally.`,
    features: [
      'JWT + role-based access',
      'Offline attendance queue (PWA)',
      'SSE live presence for HR',
      'Leave + payroll workflows',
      'Swagger / OpenAPI docs',
      'Demo seed accounts'
    ],
    tags: ['React', 'TypeScript', 'Node.js', 'MongoDB', 'PWA', 'SSE'],
    repo: 'https://github.com/Mpratyush54/dayflow',
    category: 'Web',
    source: 'github',
    sourceUrl: 'https://github.com/Mpratyush54/dayflow',
    featured: true,
    languageStats: [
      { name: 'TypeScript', percent: 70, color: '#3178C6' },
      { name: 'JavaScript', percent: 25, color: '#F7DF1E' },
      { name: 'CSS', percent: 5, color: '#563D7C' }
    ],
    deployment: {
      type: 'Web Application',
      platform: 'Local / self-hosted',
      url: '',
      details: 'Vite frontend + Express API on MongoDB. Designed for self-host or container deploy.',
      ciCd: 'Not configured yet.'
    },
    architecture: {
      title: 'How DayFlow Works',
      steps: [
        {
          icon: '👤',
          label: 'Authenticate',
          description: 'JWT access + refresh tokens; role claims gate employee vs HR/admin routes.'
        },
        {
          icon: '⏱️',
          label: 'Attendance',
          description: 'Check-in/out with localStorage offline queue and service-worker-friendly sync.'
        },
        {
          icon: '📡',
          label: 'Live HR view',
          description: 'SSE stream pushes still-in counts; falls back to polling if the stream drops.'
        },
        {
          icon: '📄',
          label: 'Leave & payroll',
          description: 'Employees apply for leave and view payslips; HR approves and manages payroll.'
        }
      ]
    },
    techDetails: [
      {
        title: 'Offline-first attendance',
        description: 'Queued check-in/out survives offline; flush preserves order on reconnect.',
        category: 'UX',
        tags: ['PWA', 'Offline']
      },
      {
        title: 'SSE for live presence',
        description: 'HR dashboards get sub-second still-in updates without hammering REST.',
        category: 'Performance',
        tags: ['SSE', 'Realtime']
      }
    ],
    status: { phase: 'Development', since: '2026-08', ciStatus: 'Not Configured' },
    timeline: {
      start: 'Aug 2026',
      end: 'Active',
      history: [
        { phase: 'API + auth', date: 'Aug 2026', completed: true },
        { phase: 'PWA offline queue', date: 'Aug 2026', completed: true },
        { phase: 'SSE presence', date: 'Aug 2026', completed: true },
        { phase: 'Production deploy', date: 'Present', completed: false }
      ]
    }
  },

  {
    title: 'CAPS Automation — Operations Portal',
    shortDescription:
      'Official CAPS Kengeri operations PWA — events, QR attendance, certificates, reports, notifications, and 5-tier RBAC. Live at worklog.capskengeri.com.',
    fullDescription: `CAPS Automation is the daily operations portal for Centre for Academic and Professional Support at CHRIST University, Kengeri.

It covers event registration, QR attendance, bulk certificates, feedback analytics, PDF/Excel reports, push notifications, meeting minutes, and team workflows. Five access tiers from volunteer to super admin. Offline-capable PWA with queued writes when the network drops.`,
    features: [
      'Event registration',
      'QR attendance',
      'Bulk certificates',
      'PDF & Excel reports',
      'PWA push notifications',
      '5-tier RBAC'
    ],
    tags: ['React', 'Node.js', 'PWA', 'PostgreSQL', 'RBAC'],
    link: 'https://worklog.capskengeri.com/',
    repo: 'https://gitlab.com/techtank.capskengeri/CAPS-Automation',
    category: 'Web',
    source: 'gitlab',
    sourceUrl: 'https://gitlab.com/techtank.capskengeri/CAPS-Automation',
    featured: true,
    languageStats: [
      { name: 'JavaScript', percent: 84, color: '#F7DF1E' },
      { name: 'CSS', percent: 16, color: '#563D7C' }
    ],
    deployment: {
      type: 'Progressive Web Application',
      platform: 'Cloudflare / VPS (worklog.capskengeri.com)',
      url: 'https://worklog.capskengeri.com/',
      details: 'React PWA + Node/Express + PostgreSQL behind Cloudflare.',
      ciCd: 'GitLab CI on merge to main.'
    },
    architecture: {
      title: 'How CAPS Automation Works',
      steps: [
        {
          icon: '📅',
          label: 'Create events',
          description: 'Admins configure forms, capacity, and certificate templates.'
        },
        {
          icon: '✅',
          label: 'QR check-in',
          description: 'Attendees scan at the door; attendance syncs to the dashboard live.'
        },
        {
          icon: '📜',
          label: 'Certificates & reports',
          description: 'Bulk PDFs after attendance finalization; Excel/PDF analytics for leadership.'
        },
        {
          icon: '👥',
          label: 'Team workflows',
          description: 'Tasks, minutes, and permissions across five role tiers.'
        }
      ]
    },
    techDetails: [
      {
        title: 'Offline PWA queue',
        description: 'Attendance and forms queue locally and sync when connectivity returns.',
        category: 'UX',
        tags: ['PWA', 'Offline']
      },
      {
        title: 'Five-tier RBAC',
        description: 'Granular permissions from volunteer to super admin with audited actions.',
        category: 'Security',
        tags: ['RBAC', 'Audit']
      }
    ],
    status: { phase: 'Production', since: '2025', ciStatus: 'Passing', deploymentType: 'Vercel' },
    timeline: {
      start: '2025',
      end: 'Active',
      history: [
        { phase: 'MVP', date: '2025', completed: true },
        { phase: 'Events & attendance', date: 'Early 2026', completed: true },
        { phase: 'Certificates & reports', date: 'Mid 2026', completed: true },
        { phase: 'PWA hardening', date: 'Present', completed: false }
      ]
    }
  },

  {
    title: 'Phone Proctor — AI Exam Integrity',
    shortDescription:
      'Distributed proctoring stack: React Native mobile client streams camera + sensors over WebSocket to a Python CV backend for real-time anomaly detection.',
    fullDescription: `Phone Proctor turns a phone into the exam sensor — no dedicated webcam lab required.

exam-protector-mobile streams camera frames and motion/audio telemetry. The Python backend fuses signals, runs OpenCV-based vision (face presence, gaze, motion), and emits structured supervision events for human review. Designed for horizontal workers behind a WebSocket gateway.`,
    features: [
      'Multi-modal sensor fusion',
      'OpenCV vision pipeline',
      'WebSocket low-latency alerts',
      'Rule-based decision engine',
      'Mobile kiosk companion app'
    ],
    tags: ['Python', 'OpenCV', 'WebSocket', 'React Native', 'Computer Vision'],
    repo: 'https://github.com/Mpratyush54/Phone-Proctor',
    frontendRepo: 'https://github.com/Mpratyush54/exam-protector-mobile',
    backendRepo: 'https://github.com/Mpratyush54/Phone-Proctor',
    category: 'Backend',
    source: 'github',
    sourceUrl: 'https://github.com/Mpratyush54/Phone-Proctor',
    featured: true,
    languageStats: [
      { name: 'Python', percent: 88, color: '#3776AB' },
      { name: 'HTML', percent: 9, color: '#E34C26' },
      { name: 'Roff', percent: 2, color: '#ecdebe' }
    ],
    deployment: {
      type: 'Backend + Mobile',
      platform: 'Docker (staging) + private APK',
      url: '',
      details: 'Python workers in Docker; mobile APK for enrolled institutions.',
      ciCd: 'Manual while the pipeline stabilizes.'
    },
    architecture: {
      title: 'How Phone Proctor Works',
      steps: [
        {
          icon: '📱',
          label: 'Mobile ingest',
          description: 'Device streams video + accelerometer/gyro (and related signals) over WebSocket.'
        },
        {
          icon: '🧠',
          label: 'Vision + fusion',
          description: 'OpenCV analyzes frames; fusion correlates motion spikes with visual anomalies.'
        },
        {
          icon: '⚡',
          label: 'Alerts',
          description: 'Rule engine emits timed events with evidence for the proctor dashboard.'
        },
        {
          icon: '📈',
          label: 'Scale out',
          description: 'Workers consume frames from a queue so sessions scale horizontally.'
        }
      ]
    },
    techDetails: [
      {
        title: 'Sensor fusion over single-signal flags',
        description: 'Requires multi-signal agreement to cut false positives from noisy phone cameras.',
        category: 'Architecture',
        tags: ['Fusion', 'CV']
      },
      {
        title: 'Human-in-the-loop',
        description: 'Flags incidents for review — does not auto-fail candidates.',
        category: 'Security',
        tags: ['Proctoring', 'Ethics']
      }
    ],
    status: { phase: 'Development', since: '2026-02', ciStatus: 'Not Configured' },
    timeline: {
      start: 'Feb 2026',
      end: 'Active',
      history: [
        { phase: 'CV pipeline', date: 'Mar 2026', completed: true },
        { phase: 'WebSocket integration', date: 'Apr 2026', completed: true },
        { phase: 'Mobile companion', date: '2026', completed: true },
        { phase: 'Beta testing', date: 'Present', completed: false }
      ]
    }
  },

  {
    title: 'Ambue — Pharma Reporting Platform',
    shortDescription:
      'Angular + Node/Express + MySQL pharmaceutical reporting with JWT RBAC (MR / Manager / Admin) — ran ~1 year in production on AWS EC2.',
    fullDescription: `Ambue is an industry client project: field reporting and inventory-oriented workflows for pharmaceutical teams.

Role-based REST APIs on Node.js + Express + MySQL with JWT auth, Angular client, and AWS EC2 deployment. Related scanner/backend work lives in the Ambue monorepo for barcode-oriented flows.`,
    features: [
      'JWT RBAC (MR / Manager / Admin)',
      'Reporting APIs',
      'Angular client',
      'AWS EC2 production deploy',
      'Barcode / inventory extensions'
    ],
    tags: ['Angular', 'Node.js', 'MySQL', 'AWS', 'JWT'],
    repo: 'https://github.com/Mpratyush54/Ambue-pharmacutical-scanner-android-web-backend',
    category: 'Web',
    source: 'github',
    sourceUrl: 'https://github.com/Mpratyush54/Ambue-pharmacutical-scanner-android-web-backend',
    featured: true,
    languageStats: [
      { name: 'JavaScript', percent: 67, color: '#F7DF1E' },
      { name: 'CSS', percent: 18, color: '#563D7C' },
      { name: 'HTML', percent: 9, color: '#E34C26' },
      { name: 'TypeScript', percent: 4, color: '#3178C6' }
    ],
    deployment: {
      type: 'Web + Android companion',
      platform: 'AWS EC2 + APK',
      url: '',
      details: 'Production EC2 deploy for ~1 year; scanner APK for field flows.',
      ciCd: 'Manual releases.'
    },
    architecture: {
      title: 'How Ambue Works',
      steps: [
        {
          icon: '🔐',
          label: 'Role login',
          description: 'JWT carries MR / Manager / Admin claims into API middleware.'
        },
        {
          icon: '📝',
          label: 'Field reports',
          description: 'Reps submit structured reports; managers review and escalate.'
        },
        {
          icon: '📷',
          label: 'Optional scan path',
          description: 'Barcode flows verify product batches and update inventory counts.'
        },
        {
          icon: '☁️',
          label: 'AWS hosting',
          description: 'Node API and static Angular assets on EC2 behind Nginx.'
        }
      ]
    },
    techDetails: [
      {
        title: 'RBAC-first API design',
        description: 'Every reporting route is gated by role — field vs management surfaces stay separated.',
        category: 'Security',
        tags: ['JWT', 'RBAC']
      }
    ],
    status: { phase: 'Production', since: '2023-12', ciStatus: 'Not Configured' },
    timeline: {
      start: 'Dec 2023',
      end: '2024',
      history: [
        { phase: 'API + Angular', date: '2023–2024', completed: true },
        { phase: 'EC2 production', date: '2024', completed: true },
        { phase: 'Scanner extensions', date: '2024–2025', completed: true }
      ]
    }
  },

  {
    title: 'Vision-You — AI Career Guidance',
    shortDescription:
      'Three GPT-4o-mini engines (Vision, Ikigai, task-match) with strict JSON schemas on React/TypeScript + Node + Supabase.',
    fullDescription: `Vision-You helps students explore careers through three structured LLM pipelines: a Vision identity summary, an Ikigai analysis, and task-based career matching (including India vs abroad scope).

Each Express route enforces schema-shaped JSON, strips markdown, and falls back gracefully on parse failure. Frontend is React + TypeScript + Tailwind; persistence on Supabase.`,
    features: [
      'Vision summary engine',
      'Ikigai assessment',
      'Task-based career match',
      'Strict JSON output validation',
      'Supabase persistence'
    ],
    tags: ['React', 'TypeScript', 'OpenAI', 'Supabase', 'TailwindCSS'],
    link: 'https://path-finder-ten-xi.vercel.app',
    repo: 'https://github.com/Mpratyush54/Vision-You',
    category: 'Web',
    source: 'github',
    sourceUrl: 'https://github.com/Mpratyush54/Vision-You',
    featured: true,
    languageStats: [
      { name: 'TypeScript', percent: 85, color: '#3178C6' },
      { name: 'JavaScript', percent: 10, color: '#F7DF1E' },
      { name: 'CSS', percent: 5, color: '#563D7C' }
    ],
    deployment: {
      type: 'Web Application',
      platform: 'Vercel + Node API',
      url: 'https://path-finder-ten-xi.vercel.app',
      details: 'Vite frontend with Express AI routes and Supabase storage.',
      ciCd: 'Vercel on push.'
    },
    architecture: {
      title: 'How Vision-You Works',
      steps: [
        {
          icon: '📝',
          label: 'Assessment input',
          description: 'Users complete values, skills, lifestyle, and task preference forms.'
        },
        {
          icon: '🤖',
          label: 'Engine routing',
          description: 'Dedicated GPT-4o-mini routes with temperature and token budgets per engine.'
        },
        {
          icon: '📊',
          label: 'Validated JSON',
          description: 'Schema checks and markdown stripping before UI render.'
        },
        {
          icon: '💾',
          label: 'Save & revisit',
          description: 'Results land in Supabase for cross-session comparison.'
        }
      ]
    },
    techDetails: [
      {
        title: 'Strict JSON enforcement',
        description: 'Prompts include explicit schemas; failed parses never crash the UI.',
        category: 'Reliability',
        tags: ['JSON', 'LLM']
      }
    ],
    status: { phase: 'Development', since: '2026-05', ciStatus: 'Not Configured', deploymentType: 'Vercel' },
    timeline: {
      start: 'May 2026',
      end: 'Active',
      history: [
        { phase: 'Vision engine', date: 'May 2026', completed: true },
        { phase: 'Ikigai engine', date: 'Jun 2026', completed: true },
        { phase: 'Task matching', date: 'Jul 2026', completed: true },
        { phase: 'Supabase polish', date: 'Present', completed: false }
      ]
    }
  },

  {
    title: 'CAPS Kengeri — Club Website',
    shortDescription:
      'Official CAPS club site with SEO, 3-tier publishing RBAC, and content moderation — live at capskengeri.com.',
    fullDescription: `Public face of CAPS at CHRIST University, Kengeri: events, team, and club information with an admin publishing workflow.

React + TypeScript, JSON-LD / sitemap SEO work, and moderated content workflows (admin / editor / moderator) with blocked-words filtering.`,
    features: [
      'SEO + structured data',
      '3-tier content RBAC',
      'Blocked-words moderation',
      'Event & team pages',
      'Responsive UI'
    ],
    tags: ['React', 'TypeScript', 'SEO', 'RBAC'],
    link: 'https://capskengeri.com/',
    repo: 'https://gitlab.com/techtank.capskengeri-group/caps-kengeri',
    category: 'Web',
    source: 'gitlab',
    sourceUrl: 'https://gitlab.com/techtank.capskengeri-group/caps-kengeri',
    featured: false,
    languageStats: [
      { name: 'TSX', percent: 91, color: '#3178C6' },
      { name: 'CSS', percent: 5, color: '#563D7C' },
      { name: 'JavaScript', percent: 2, color: '#F7DF1E' },
      { name: 'TypeScript', percent: 1, color: '#3178C6' }
    ],
    deployment: {
      type: 'Web Application',
      platform: 'Vercel (capskengeri.com)',
      url: 'https://capskengeri.com/',
      details: 'React frontend with Node API and PostgreSQL.',
      ciCd: 'GitLab CI with SEO checks.'
    },
    architecture: {
      title: 'How CAPS Kengeri Works',
      steps: [
        {
          icon: '🌐',
          label: 'Public site',
          description: 'Visitors browse events, team, and club info on SEO-tuned pages.'
        },
        {
          icon: '🔐',
          label: 'Admin roles',
          description: 'Editors draft; moderators approve; admins publish.'
        },
        {
          icon: '🚫',
          label: 'Moderation',
          description: 'Blocked words flag or reject unsafe content before it goes live.'
        }
      ]
    },
    techDetails: [
      {
        title: 'SEO-first public surface',
        description: 'JSON-LD, sitemaps, and Core Web Vitals tuning for discoverability.',
        category: 'Performance',
        tags: ['SEO', 'JSON-LD']
      }
    ],
    status: { phase: 'Production', since: '2025', ciStatus: 'Passing', deploymentType: 'Vercel' },
    timeline: {
      start: '2025',
      end: 'Active',
      history: [
        { phase: 'Launch', date: '2025', completed: true },
        { phase: 'Admin panel', date: 'Early 2026', completed: true },
        { phase: 'Moderation', date: '2026', completed: true }
      ]
    }
  },

  {
    title: 'Recalibrate Forum — Student Support',
    shortDescription:
      'Student Q&A forum for Recalibrating You (CAPS × Psynergy) with 3-tier moderation and blocked words — recalibrating.capskengeri.com.',
    fullDescription: `Official discussion platform for the Recalibrating You initiative: students ask; specialists answer; moderators keep threads safe.

React + TypeScript frontend, Node backend, PostgreSQL, and SEO metadata for social previews.`,
    features: [
      'Student ↔ specialist Q&A',
      'Admin / moderator / specialist RBAC',
      'Blocked-words filtering',
      'Thread workflows',
      'Open Graph / Twitter cards'
    ],
    tags: ['React', 'TypeScript', 'Forum', 'Moderation'],
    link: 'https://recalibrating.capskengeri.com/',
    repo: 'https://github.com/dauntless-arcane/Forum',
    category: 'Web',
    source: 'github',
    sourceUrl: 'https://github.com/dauntless-arcane/Forum',
    featured: false,
    languageStats: [
      { name: 'TypeScript', percent: 97, color: '#3178C6' },
      { name: 'HTML', percent: 1, color: '#E34C26' },
      { name: 'CSS', percent: 1, color: '#563D7C' }
    ],
    deployment: {
      type: 'Web Application',
      platform: 'Vercel (recalibrating.capskengeri.com)',
      url: 'https://recalibrating.capskengeri.com/',
      details: 'React on Vercel with Express API and PostgreSQL.',
      ciCd: 'Vercel auto-deploy on push.'
    },
    architecture: {
      title: 'How Recalibrate Forum Works',
      steps: [
        {
          icon: '❓',
          label: 'Ask',
          description: 'Students post; blocked words screen content before publish.'
        },
        {
          icon: '👁️',
          label: 'Moderate',
          description: 'Moderators approve or reject; specialists claim and answer.'
        },
        {
          icon: '✅',
          label: 'Oversee',
          description: 'Admins manage roles, word lists, and audit visibility.'
        }
      ]
    },
    techDetails: [
      {
        title: '3-tier moderation RBAC',
        description: 'Clear separation between platform config, content review, and specialist answers.',
        category: 'Security',
        tags: ['RBAC', 'Moderation']
      }
    ],
    status: { phase: 'Production', since: '2026', ciStatus: 'Passing', deploymentType: 'Vercel' },
    timeline: {
      start: '2026',
      end: 'Active',
      history: [
        { phase: 'Launch', date: '2026', completed: true },
        { phase: 'Moderation system', date: '2026', completed: true }
      ]
    }
  },

  {
    title: 'Battery Aadhar — Battery Health Monitor',
    shortDescription:
      'Rust edge collector + Go analytics API for battery telemetry — memory-safe ingest with concurrent REST serving.',
    fullDescription: `Dual-language IoT-style stack: Rust collects voltage, current, temperature, and cycle data at the edge; Go exposes REST analytics for dashboards and alerts. Dockerized for edge + cloud split deployments.`,
    features: [
      'Rust telemetry collector',
      'Go REST analytics API',
      'Edge + cloud split',
      'Dockerized deploy'
    ],
    tags: ['Rust', 'Go', 'Docker', 'IoT'],
    repo: 'https://github.com/Mpratyush54/Battery-AAdhar',
    category: 'Backend',
    source: 'github',
    sourceUrl: 'https://github.com/Mpratyush54/Battery-AAdhar',
    featured: false,
    languageStats: [
      { name: 'Rust', percent: 55, color: '#dea584' },
      { name: 'Go', percent: 42, color: '#00ADD8' },
      { name: 'Shell', percent: 1, color: '#89e051' },
      { name: 'JavaScript', percent: 1, color: '#F7DF1E' }
    ],
    deployment: {
      type: 'IoT + Cloud',
      platform: 'Edge gateways + VPS',
      url: '',
      details: 'Rust daemon on edge hardware; Go API via Docker Compose in the cloud.',
      ciCd: 'Manual cross-compile during development.'
    },
    architecture: {
      title: 'How Battery Aadhar Works',
      steps: [
        {
          icon: '🔋',
          label: 'Collect',
          description: 'Rust reads BMS telemetry on a fixed cadence with no GC pauses.'
        },
        {
          icon: '📡',
          label: 'Ship',
          description: 'Aggregates move from edge storage to the cloud API.'
        },
        {
          icon: '📊',
          label: 'Serve',
          description: 'Go exposes REST for dashboards, alerts, and life estimates.'
        }
      ]
    },
    techDetails: [
      {
        title: 'Rust at the edge',
        description: 'Deterministic latency for hardware-adjacent collection.',
        category: 'Performance',
        tags: ['Rust', 'Embedded']
      }
    ],
    status: { phase: 'Development', since: '2026-03', ciStatus: 'Not Configured' },
    timeline: {
      start: 'Mar 2026',
      end: 'Active',
      history: [
        { phase: 'Rust collector', date: 'Mar 2026', completed: true },
        { phase: 'Go API', date: 'Apr 2026', completed: true },
        { phase: 'Field testing', date: 'Present', completed: false }
      ]
    }
  }
];

module.exports = projects;
