const projects = [
  {
    title: 'ClassStream — Live Education Platform',
    shortDescription: 'A full-stack school management platform with DRM-protected video streaming, live classes, real-time chat, and collaborative tools for teachers and students.',
    fullDescription: `ClassStream replaces traditional LMS platforms by embedding live, DRM-protected video streaming directly into the teaching workflow. Unlike Google Classroom or Moodle, it integrates real-time video so teachers can run live classes, share their screen, and interact with students — all within a single system.

The core challenge was building a secure streaming pipeline with DASH + ClearKey DRM encryption that scales to 500+ concurrent students. A custom WebRTC solution with Socket.io signaling handles low-latency video, while the Node.js backend handles video processing, encryption, and distribution. MySQL handles relational data, MongoDB stores streaming metrics.

For students, ClassStream supports cross-device note-taking, automated assignment grading, push notifications, and role-based access. The Angular PWA works offline and can be installed on any device.`,
    features: ['DRM-Protected Video Streaming', 'Real-time Live Classes with WebRTC', 'Cross-device Note-taking', 'Automated Assignment Grading', 'Role-based Access Control', 'Push Notifications', 'PWA with Offline Support'],
    tags: ['Angular', 'Node.js', 'TypeScript', 'WebRTC', 'DRM', 'Socket.io', 'MySQL'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/classstream-frontend',
    gallery: ['/screenshots/classstream-home.jpg', '/screenshots/classstream-classes.jpg', '/screenshots/classstream-students.jpg', '/screenshots/classstream-login.jpg'],
    link: 'https://classstream.dev/',
    frontendRepo: 'https://github.com/Mpratyush54/classstream-frontend',
    backendRepo: 'https://github.com/Mpratyush54/classstream-backend',
    category: 'Web', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/classstream-frontend', featured: true,
    languageStats: [{ name: 'JavaScript', percent: 48, color: '#F7DF1E' }, { name: 'CSS', percent: 22, color: '#563D7C' }, { name: 'TypeScript', percent: 8, color: '#3178C6' }, { name: 'HTML', percent: 8, color: '#E34C26' }, { name: 'Python', percent: 5, color: '#3776AB' }, { name: 'SCSS', percent: 4, color: '#C6538C' }],
    deployment: { type: 'Web Application', platform: 'Vercel (Frontend) + Self-hosted VPS (Backend)', url: 'https://classstream.dev/', details: 'Angular PWA deployed on Vercel with automatic SSL and CDN. Node.js/Express backend runs on a DigitalOcean VPS with PM2 process manager. MySQL and MongoDB databases hosted on separate managed instances. WebRTC media servers deployed on low-latency edge locations.', ciCd: 'GitHub Actions — automated testing, Docker build, and deployment on push to main.' },
    architecture: {
      title: 'How ClassStream Works',
      steps: [
        { icon: '🎓', label: 'Teacher Initiates Live Class', description: 'A teacher creates a class session through the Angular PWA. WebRTC peer connection is established via Socket.io signaling, connecting the teacher\'s device to the streaming server.' },
        { icon: '🔒', label: 'Stream Encrypted with DRM', description: 'Video is segmented into DASH chunks and encrypted using ClearKey. Only authenticated viewers receive per-session decryption keys.' },
        { icon: '📡', label: 'Real-time Distribution to Students', description: 'Encrypted stream is distributed via WebRTC for sub-500ms live viewing. Socket.io handles real-time events — raise hand, chat, polls, attendance pings.' },
        { icon: '📝', label: 'Student Interaction & Note-taking', description: 'Students view the stream, take synced text/PDF notes, submit assignments, and receive push notifications — all within the PWA.' },
        { icon: '💾', label: 'Data Persistence & Analytics', description: 'MySQL stores structured data (users, courses, grades). MongoDB logs streaming metrics for performance analysis and compliance.' }
      ]
    },
    techDetails: [
      { title: 'Why WebRTC over HLS', description: 'HLS introduces 6-30 seconds of latency — unacceptable for live classes. WebRTC delivers sub-500ms latency with UDP-based peer-to-peer streaming.', category: 'Performance', tags: ['WebRTC', 'Low-Latency'] },
      { title: 'DASH + ClearKey DRM', description: 'DASH segments video for adaptive bitrate playback. ClearKey encrypts content with per-session keys issued only to authenticated users.', category: 'Security', tags: ['DRM', 'DASH', 'Encryption'] },
      { title: 'Dual Database Strategy', description: 'MySQL handles relational data where ACID compliance matters. MongoDB stores semi-structured streaming logs for flexible schema evolution.', category: 'Scalability', tags: ['MySQL', 'MongoDB'] },
      { title: 'PWA for Offline Resilience', description: 'Service workers cache core app shell and notes. Students access materials and submit assignments offline — sync on reconnection.', category: 'UX', tags: ['PWA', 'Offline-First'] }
    ],
    status: { phase: 'Production', since: '2023', ciStatus: 'Passing', deploymentType: 'Vercel' },
    timeline: { start: 'Dec 2022', end: 'Active', history: [{ phase: 'Backend Init', date: 'Dec 2022', completed: true }, { phase: 'Frontend Start', date: 'Dec 2023', completed: true }, { phase: 'DRM Streaming', date: '2024', completed: true }, { phase: 'Continuous Improvement', date: 'Present', completed: false }] }
  },
  {
    title: 'Phone Proctor — AI Exam Integrity Backend',
    shortDescription: 'An AI proctoring backend using computer vision and sensor fusion to detect cheating during remote mobile exams, designed to scale horizontally.',
    fullDescription: `Phone Proctor solves a critical remote education problem: verifying exam integrity when students take tests on their phones from home. This isn't a browser extension — it's a distributed backend that processes real-time video feeds from mobile devices and uses computer vision to detect suspicious behavior.

The system receives video streams from the Exam Protector Mobile app, runs OpenCV-based analysis to detect multiple faces, gaze deviation, phone switching, and other anomalies — all in real-time via WebSocket. Worker nodes process video in parallel using a message queue, scaling horizontally to hundreds of concurrent exam sessions.`,
    features: ['Real-time Computer Vision (OpenCV)', 'Multi-face & Gaze Deviation Detection', 'Sensor Fusion from Mobile Devices', 'WebSocket-based Low-latency Alerts', 'Horizontally Scalable Worker Architecture'],
    tags: ['Python', 'OpenCV', 'Computer Vision', 'WebSocket', 'Distributed Systems'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/Phone-Proctor',
    repo: 'https://github.com/Mpratyush54/Phone-Proctor',
    category: 'Backend', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/Phone-Proctor', featured: true,
    languageStats: [{ name: 'Python', percent: 88, color: '#3776AB' }, { name: 'HTML', percent: 9, color: '#E34C26' }, { name: 'Roff', percent: 2, color: '#ecdebe' }],
    deployment: { type: 'Backend Service', platform: 'Docker (Self-hosted)', url: '', details: 'Python backend packaged as Docker containers. Designed for horizontal scaling: OpenCV processing workers consume frames from a message queue, a WebSocket gateway handles device connections, Redis holds session state. Currently in development — deployed to a staging environment for testing.', ciCd: 'Not configured yet — builds and deployments are run manually while the project is in development.' },
    architecture: {
      title: 'How Phone Proctor Works',
      steps: [
        { icon: '📱', label: 'Mobile Stream Ingestion', description: 'Exam Protector Mobile captures video from the device camera and sends it to the backend via persistent WebSocket connections.' },
        { icon: '🧠', label: 'Computer Vision Analysis', description: 'OpenCV analyzes each frame — detecting multiple faces, gaze deviation, phone switching, and other anomalies.' },
        { icon: '⚡', label: 'Real-time Alert Pipeline', description: 'When anomalies are detected, alerts fire via WebSocket to the proctor dashboard within milliseconds with evidence logs.' },
        { icon: '📈', label: 'Horizontal Scaling', description: 'A message queue distributes video processing across worker nodes, handling hundreds of concurrent sessions without bottlenecking.' }
      ]
    },
    techDetails: [
      { title: 'OpenCV over Deep Learning', description: 'OpenCV provides deterministic, low-latency face detection without GPU requirements, allowing processing on commodity servers.', category: 'Performance', tags: ['OpenCV', 'Computer Vision'] },
      { title: 'WebSocket for Bidirectional Alerting', description: 'Persistent full-duplex channels deliver sub-100ms alerts from device to dashboard, versus seconds with REST polling.', category: 'Performance', tags: ['WebSocket', 'Real-time'] },
      { title: 'Distributed Worker Architecture', description: 'RabbitMQ distributes video frames across worker nodes. Add more workers = handle more exams, no Single point of failure.', category: 'Scalability', tags: ['Distributed Systems', 'RabbitMQ'] }
    ],
    status: { phase: 'Development', since: '2026-02', ciStatus: 'Not Configured' },
    timeline: { start: 'Feb 2026', end: 'Active', history: [{ phase: 'Research & Design', date: 'Feb 2026', completed: true }, { phase: 'Core CV Pipeline', date: 'Mar 2026', completed: true }, { phase: 'WebSocket Integration', date: 'Apr 2026', completed: true }, { phase: 'Beta Testing', date: 'Present', completed: false }] }
  },
  {
    title: 'Battery Aadhar — Battery Health Monitor',
    shortDescription: 'A dual-language battery management system — Rust collects embedded telemetry with memory safety, Go serves real-time analytics via REST APIs.',
    fullDescription: `Battery Aadhar monitors battery health across distributed installations using a two-language architecture. Rust handles all low-level data collection from battery management hardware — reading voltage, current, temperature, and cycle counts with deterministic performance and zero GC pauses. The Go backend pulls processed data and exposes REST APIs for dashboards, alerting, and predictive analytics.

Edge gateways run the Rust collector locally, while the Go API runs in the cloud for centralized monitoring. Docker containers ensure consistent deployment across environments.`,
    features: ['Rust-based Data Collection', 'Real-time Monitoring & Alerting', 'Go REST API Backend', 'Predictive Battery Life Analytics', 'Dockerized Edge + Cloud Deployment'],
    tags: ['Rust', 'Go', 'Shell', 'Docker', 'IoT'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/Battery-AAdhar',
    repo: 'https://github.com/Mpratyush54/Battery-AAdhar',
    category: 'Mobile', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/Battery-AAdhar', featured: true,
    languageStats: [{ name: 'Rust', percent: 55, color: '#dea584' }, { name: 'Go', percent: 42, color: '#00ADD8' }, { name: 'Shell', percent: 1, color: '#89e051' }, { name: 'JavaScript', percent: 1, color: '#F7DF1E' }],
    deployment: { type: 'IoT + Cloud Pipeline', platform: 'Edge Gateways (Rust) + Cloud VPS (Go API)', url: '', details: 'Rust collector daemon designed to run on ARM-based edge gateways at battery installations, with the Go API server deployed on a cloud VPS via Docker Compose. Currently in development and field testing.', ciCd: 'Not configured yet — Rust binaries are cross-compiled and deployed manually during development.' },
    architecture: {
      title: 'How Battery Aadhar Works',
      steps: [
        { icon: '🔋', label: 'Rust Collector Reads Telemetry', description: 'The Rust daemon reads voltage, current, temperature, and cycle data from BMS hardware at deterministic intervals with no GC pauses.' },
        { icon: '⚙️', label: 'Data Processing Pipeline', description: 'Rust processes raw telemetry — filtering noise, computing aggregates, detecting anomalies, and writing to local time-series storage.' },
        { icon: '📊', label: 'Go API Serves Analytics', description: 'The Go backend aggregates data from all edge gateways and exposes REST endpoints for real-time dashboards and predictions.' },
        { icon: '🐳', label: 'Dockerized Deployment', description: 'Edge gateways run the Rust collector locally. The Go backend runs in the cloud. Docker ensures consistency across all environments.' }
      ]
    },
    techDetails: [
      { title: 'Rust for Deterministic Performance', description: 'Battery monitoring requires predictable latency with no garbage collection pauses. Rust\'s zero-cost abstractions make it ideal for embedded data collection.', category: 'Performance', tags: ['Rust', 'Embedded'] },
      { title: 'Go for Concurrent API Serving', description: 'Go\'s goroutines handle hundreds of simultaneous monitoring sessions. The standard library provides production-ready REST APIs with minimal boilerplate.', category: 'Scalability', tags: ['Go', 'Concurrency'] },
      { title: 'Edge + Cloud Architecture', description: 'Processing telemetry at the edge reduces bandwidth costs. Cloud aggregation enables fleet-wide analytics and unified alerting.', category: 'Architecture', tags: ['Edge Computing', 'Cloud'] }
    ],
    status: { phase: 'Development', since: '2026-03', ciStatus: 'Not Configured' },
    timeline: { start: 'Mar 2026', end: 'Active', history: [{ phase: 'Rust Collector', date: 'Mar 2026', completed: true }, { phase: 'Go API Layer', date: 'Apr 2026', completed: true }, { phase: 'Dockerization', date: 'May 2026', completed: true }, { phase: 'Field Testing', date: 'Present', completed: false }] }
  },
  {
    title: 'CAPS Club Automation — Operations Platform',
    shortDescription: 'An operations platform bridging GitHub and GitLab for the CAPS college club — connecting data pipelines, workflow automation, and monitoring dashboards into a single operations hub.',
    fullDescription: `CAPS Automation is the operational backbone of the CAPS ecosystem, unifying repositories across GitHub and GitLab into a single automation platform. The backend handles data pipelines, scheduled batch jobs, event-driven workflows, and external integrations via webhooks. The frontend dashboard provides a single pane of glass for monitoring pipeline health, viewing logs, configuring workflows, and managing endpoints.

Docker containers ensure consistent deployment across dev, staging, and production. The platform normalizes data from different Git providers so operators don't need to switch between GitHub and GitLab UIs.`,
    features: ['Cross-platform GitHub + GitLab Integration', 'Data Processing Pipelines', 'Scheduled Workflow Automation', 'Webhook-based Event Listeners', 'Unified Operations Dashboard', 'Docker Container Deployment'],
    tags: ['JavaScript', 'Node.js', 'CSS', 'Automation', 'Docker'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/CAPS-Automation',
    repo: 'https://github.com/Mpratyush54/CAPS-Automation',
    frontendRepo: 'https://gitlab.com/techtank.capskengeri/CAPS-Automation',
    backendRepo: 'https://gitlab.com/campus-navigator/CAPS-Automation-backend',
    category: 'Backend', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/CAPS-Automation', featured: true,
    languageStats: [{ name: 'JavaScript', percent: 93, color: '#F7DF1E' }, { name: 'CSS', percent: 6, color: '#563D7C' }],
    deployment: { type: 'Web Application + Backend Service', platform: 'Docker Compose (Self-hosted)', url: '', details: 'Node.js backend and JavaScript frontend run as Docker containers behind an Nginx reverse proxy, with PostgreSQL for workflow state and Redis for job queues. In active development.', ciCd: 'Not configured yet — deployments are run manually via Docker Compose while the platform is being built out.' },
    architecture: {
      title: 'How CAPS Automation Works',
      steps: [
        { icon: '🔗', label: 'Multi-Repo Connection', description: 'GitHub and GitLab repos connect via webhooks. Events (push, PR, merge) trigger automation workflows automatically.' },
        { icon: '⚙️', label: 'Workflow Execution Engine', description: 'The Node.js backend processes triggered workflows — running data pipelines, business logic, and dispatching tasks to workers.' },
        { icon: '📊', label: 'Dashboard Monitoring', description: 'The frontend dashboard displays real-time pipeline status, activity logs, and health metrics with live-updating indicators.' },
        { icon: '🐳', label: 'Containerized Deployment', description: 'Docker containers ensure consistent deployment across dev, staging, and production with identical configuration.' }
      ]
    },
    techDetails: [
      { title: 'Event-driven Webhook Architecture', description: 'Webhooks deliver real-time events from both GitHub and GitLab, enabling instant workflow triggers without polling overhead.', category: 'Architecture', tags: ['Webhooks', 'Event-driven'] },
      { title: 'Unified Dashboard Across Platforms', description: 'The dashboard normalizes data from different Git providers into a consistent view — no toggling between GitHub and GitLab UIs.', category: 'UX', tags: ['Dashboard', 'Cross-platform'] }
    ],
    status: { phase: 'Development', since: '2026-03', ciStatus: 'Not Configured' },
    timeline: { start: 'Mar 2026', end: 'Active', history: [{ phase: 'Webhook Integration', date: 'Mar 2026', completed: true }, { phase: 'Dashboard MVP', date: 'Apr 2026', completed: true }, { phase: 'Docker Deployment', date: 'May 2026', completed: true }, { phase: 'Scaling & Optimization', date: 'Present', completed: false }] }
  },
  {
    title: 'Ambue — Pharma Scanner & Inventory System',
    shortDescription: 'An Android + web pharmaceutical management system — scan drug barcodes to authenticate medicines and track inventory in real-time.',
    fullDescription: `Ambue solves a critical problem in pharmaceutical supply chains: drug authentication and inventory tracking. The system combines an Android barcode scanner app with a full-stack web backend. Pharmacists scan drug barcodes using their phone camera — the backend cross-references batch numbers against manufacturer records to verify authenticity, and updates inventory counts in real-time.

The Node.js/TypeScript backend handles drug database management, user authentication, inventory tracking with low-stock alerts, and reporting APIs. The web dashboard gives administrators visibility across multiple locations with expiry tracking and audit logs.`,
    features: ['Android Barcode Scanning', 'Drug Authentication & Verification', 'Inventory Tracking with Alerts', 'Multi-location Management', 'Expiry Date Tracking', 'Web Dashboard for Admins'],
    tags: ['JavaScript', 'Node.js', 'TypeScript', 'Android', 'Pharmaceutical'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/Ambue-pharmacutical-scanner-android-web-backend',
    repo: 'https://github.com/Mpratyush54/Ambue-pharmacutical-scanner-android-web-backend',
    category: 'Mobile', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/Ambue-pharmacutical-scanner-android-web-backend', featured: false,
    languageStats: [{ name: 'JavaScript', percent: 67, color: '#F7DF1E' }, { name: 'CSS', percent: 18, color: '#563D7C' }, { name: 'HTML', percent: 9, color: '#E34C26' }, { name: 'TypeScript', percent: 4, color: '#3178C6' }],
    deployment: { type: 'Android App + Web Backend', platform: 'Android (APK) + VPS (Backend)', url: '', details: 'Android app distributed as a signed APK. Node.js/Express backend on a cloud VPS with a REST API secured by JWT authentication. Web dashboard served as a static SPA from Nginx.', ciCd: 'Not configured yet — APKs are built and the backend is deployed manually.' },
    architecture: {
      title: 'How Ambue Works',
      steps: [
        { icon: '📷', label: 'Scan Drug Barcode', description: 'Pharmacist opens the Android app and scans the drug\'s barcode. The app sends the barcode to the backend for verification.' },
        { icon: '🔍', label: 'Verify Authenticity', description: 'Backend cross-references the barcode and batch number against manufacturer records to verify authenticity.' },
        { icon: '📦', label: 'Update Inventory', description: 'Inventory counts update in real-time. Low-stock alerts fire automatically when quantities drop below thresholds.' },
        { icon: '📊', label: 'Admin Dashboard', description: 'The web dashboard provides multi-location stock visibility, expiry tracking, audit logs, and compliance reports.' }
      ]
    },
    techDetails: [
      { title: 'Barcode + Batch Cross-referencing', description: 'Each scan checks both the product barcode and batch number against manufacturer databases, catching counterfeits that copy barcodes from genuine products.', category: 'Security', tags: ['Barcode', 'Authentication'] },
      { title: 'Real-time Inventory Sync', description: 'WebSocket connections keep inventory counts in sync across all locations instantly — when one pharmacy scans, all dashboards update.', category: 'Performance', tags: ['Real-time', 'WebSocket'] }
    ],
    status: { phase: 'Development', since: '2023-12', ciStatus: 'Not Configured' },
    timeline: { start: 'Dec 2023', end: 'Active', history: [{ phase: 'Repository Created', date: 'Dec 2023', completed: true }, { phase: 'Android Client', date: '2024', completed: true }, { phase: 'Web Backend', date: '2025', completed: true }] }
  },
  {
    title: 'Competency Mapping — HR Skills Matrix',
    shortDescription: 'An interactive web tool for HR teams to map employee skills, identify gaps with heatmaps, and plan training — deployed globally on Vercel.',
    fullDescription: `Competency Mapping helps organizations answer: "What skills do we have, and what are we missing?" It's an interactive web application where managers build skill matrices for their teams, rate proficiency, and instantly visualize gaps where training or hiring is needed.

The core feature is a heatmap-style skill matrix grid that can scale to hundreds of skills across dozens of team members. Managers can drill into details, compare team members side-by-side, and generate reports. The gap analysis engine automatically identifies skills below target and suggests training priorities.`,
    features: ['Interactive Skill Matrix Heatmaps', 'Automated Gap Analysis', 'Team Comparison & Reporting', 'Role-based Competency Frameworks', 'Vercel Global Deployment'],
    tags: ['JavaScript', 'Node.js', 'Shell', 'Docker'],
    imageUrl: 'https://opengraph.githubassets.com/1/dauntless-arcane/Competency-Mapping',
    link: 'https://competency-mapping.vercel.app', repo: 'https://github.com/dauntless-arcane/Competency-Mapping',
    category: 'Web', source: 'github', sourceUrl: 'https://github.com/dauntless-arcane/Competency-Mapping', featured: true,
    languageStats: [{ name: 'JavaScript', percent: 95, color: '#F7DF1E' }, { name: 'PowerShell', percent: 2, color: '#012456' }, { name: 'Shell', percent: 2, color: '#89e051' }],
    deployment: { type: 'Web Application', platform: 'Vercel (Edge Network)', url: 'https://competency-mapping.vercel.app', details: 'Frontend deployed on Vercel\'s global edge network with automatic SSL, CDN caching, and serverless API functions. Node.js backend runs as Vercel serverless functions for auto-scaling. Zero cold starts for API routes due to edge runtime.', ciCd: 'Automatic deployments from GitHub — every push to main deploys to production. Preview deployments for every PR via Vercel.' },
    architecture: {
      title: 'How Competency Mapping Works',
      steps: [
        { icon: '👥', label: 'Build a Team', description: 'Managers create teams and assign members with role-based competency frameworks (e.g., "Senior Developer", "Team Lead").' },
        { icon: '📋', label: 'Rate Skills', description: 'Managers rate each member\'s proficiency across relevant skills using a consistent scoring system.' },
        { icon: '🔍', label: 'Analyze Gaps', description: 'The gap analysis engine compares current proficiency against targets and identifies skills that need development.' },
        { icon: '📊', label: 'View Reports', description: 'Interactive heatmaps and reports provide instant visibility into team capabilities, gaps, and training priorities.' }
      ]
    },
    techDetails: [
      { title: 'Heatmap Visualization at Scale', description: 'Skill matrices with hundreds of skills across dozens of team members. The heatmap rendering is optimized for smooth scrolling and zooming.', category: 'Performance', tags: ['Visualization', 'Performance'] },
      { title: 'Vercel Edge Deployment', description: 'Deployed on Vercel\'s edge network for global low-latency access. Automatic SSL, CDN caching, and serverless functions reduce ops overhead to zero.', category: 'Architecture', tags: ['Vercel', 'Edge'] }
    ],
    status: { phase: 'Development', since: '2025-10', ciStatus: 'Not Configured', deploymentType: 'Vercel' },
    timeline: { start: 'Oct 2025', end: 'Active', history: [{ phase: 'Repository Created', date: 'Oct 2025', completed: true }, { phase: 'UI Design', date: 'Nov 2025', completed: true }, { phase: 'Vercel Launch', date: 'Dec 2025', completed: true }] }
  },
  {
    title: 'Recalibrate Forum — Student Discussion Platform',
    shortDescription: 'The official student support and discussion forum for the "Recalibrating You" initiative by CAPS X Psynergy — students ask questions, specialists provide guidance, with admin moderation, 3-tier RBAC, and blocked words system. Live at recalibrating.capskengeri.com.',
    fullDescription: `Recalibrate Forum is the official discussion platform for the "Recalibrating You" initiative — a collaboration between CAPS (Centre for Academic and Professional Support) and Psynergy at Christ University, Kengeri Campus.

The platform lets students ask questions and receive guidance from specialists across academic and career topics. Behind the scenes, an admin panel with 3-tier role-based access control (admin, moderator, specialist) manages content — moderators review and approve threads, specialists claim and answer questions, and admins oversee the entire workflow. A blocked words system automatically flags or rejects inappropriate content before it's visible to students.

Built with React and TypeScript, deployed at recalibrating.capskengeri.com. SEO-optimized with Open Graph, Twitter Cards, and structured metadata for rich social previews.`,
    features: ['Student Q&A with Specialist Guidance', '3-tier Admin Moderation (Admin/Moderator/Specialist)', 'Blocked Words Auto-moderation', 'Thread-based Discussions', 'User Profiles & Roles', 'SEO-optimized with Open Graph & Twitter Cards'],
    tags: ['React', 'TypeScript', 'Forum', 'Student Support', 'Moderation'],
    imageUrl: 'https://i.ibb.co/DHJGqP9X/p1-2.jpg',
    link: 'https://recalibrating.capskengeri.com/',
    repo: 'https://github.com/dauntless-arcane/Forum',
    category: 'Web', source: 'github', sourceUrl: 'https://github.com/dauntless-arcane/Forum', featured: false,
    languageStats: [{ name: 'TypeScript', percent: 97, color: '#3178C6' }, { name: 'HTML', percent: 1, color: '#E34C26' }, { name: 'CSS', percent: 1, color: '#563D7C' }],
    deployment: { type: 'Web Application', platform: 'Vercel (Live at recalibrating.capskengeri.com)', url: 'https://recalibrating.capskengeri.com/', details: 'React frontend deployed on Vercel with automatic SSL and CDN. Node.js/Express backend handles authentication, moderation workflows, and blocked words filtering. PostgreSQL stores threads, replies, and user roles. SEO optimized with Open Graph and Twitter Card metadata.', ciCd: 'Vercel auto-deploys from GitHub on push. Preview deployments for every PR.' },
    architecture: {
      title: 'How Recalibrate Forum Works',
      steps: [
        { icon: '❓', label: 'Student Asks a Question', description: 'Students post questions in topic categories. Content is checked against the blocked words list before publishing.' },
        { icon: '👁️', label: 'Moderator Reviews & Approves', description: 'Moderators review new threads, approve appropriate content, and flag or reject violations. 3-tier RBAC controls who can do what.' },
        { icon: '👨‍🏫', label: 'Specialist Responds', description: 'Designated specialists claim questions in their domain and provide detailed guidance. Threads are marked as answered.' },
        { icon: '✅', label: 'Admin Oversight', description: 'Admins manage users, roles, blocked words list, and have full visibility into all moderation actions and platform analytics.' }
      ]
    },
    techDetails: [
      { title: '3-tier RBAC for Content Moderation', description: 'Admins configure the platform, moderators review and approve content, specialists answer questions. Each role has specific permissions with full audit logging.', category: 'Security', tags: ['RBAC', 'Moderation', 'Audit'] },
      { title: 'Blocked Words Auto-moderation', description: 'Configurable blocked words list automatically screens all content submissions. Flagged content is rejected or queued for moderator review — keeping discussions appropriate for the student community.', category: 'Security', tags: ['Moderation', 'Content Filtering'] },
      { title: 'SEO & Social Preview Optimization', description: 'Open Graph and Twitter Card metadata ensures rich previews when forum threads are shared on social media, WhatsApp, and LinkedIn.', category: 'UX', tags: ['SEO', 'Open Graph', 'Social'] }
    ],
    status: { phase: 'Production', since: '2026', ciStatus: 'Passing', deploymentType: 'Vercel' },
    timeline: { start: '2026', end: 'Active', history: [{ phase: 'Platform Launch', date: '2026', completed: true }, { phase: 'Moderation System', date: '2026', completed: true }, { phase: 'Blocked Words', date: '2026', completed: true }, { phase: 'Feature Expansion', date: 'Present', completed: false }] }
  },
  {
    title: 'Zorvyn — Tech Screening Platform',
    shortDescription: 'A coding challenge platform with sandboxed code execution, automated evaluation, and candidate pipeline management for engineering hiring.',
    fullDescription: `Zorvyn Screening helps engineering teams evaluate candidates at scale. It provides a library of coding challenges across JavaScript, Python, Java, C++, Go, and Rust — with an automated evaluation engine that compiles and runs submissions in isolated Docker containers.

The evaluator tests against predefined test cases, measures execution time and memory, and produces a score with code quality metrics. The candidate pipeline dashboard tracks every applicant through the hiring process with links to submissions and performance breakdowns.`,
    features: ['Multi-language Challenge Library', 'Sandboxed Code Execution (Docker)', 'Automated Test Case Scoring', 'Code Quality Metrics', 'Candidate Pipeline Dashboard'],
    tags: ['JavaScript', 'TypeScript', 'Assessment'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/zorvyn-screening',
    category: 'Backend', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/zorvyn-screening', featured: false,
    languageStats: [{ name: 'JavaScript', percent: 99, color: '#F7DF1E' }],
    deployment: { type: 'Web Application + Sandboxed Runner', platform: 'Docker Compose (Self-hosted)', url: '', details: 'Designed to run via Docker Compose: code execution happens in isolated Docker containers with strict resource limits — no network access, limited CPU/memory, automatic 30-second timeout. In early development.', ciCd: 'Not configured yet — the evaluation engine is still being built.' },
    architecture: {
      title: 'How Zorvyn Works',
      steps: [
        { icon: '📝', label: 'Create or Select Challenge', description: 'Recruiters pick from a library of coding challenges across multiple languages, or create custom challenges.' },
        { icon: '👨\u200d💻', label: 'Candidate Submits Solution', description: 'Candidates receive a link, write code in the browser-based editor, and submit their solution for evaluation.' },
        { icon: '🔒', label: 'Sandboxed Execution', description: 'The submission runs in an isolated Docker container — compiled, tested against test cases, with execution time and memory measured.' },
        { icon: '📊', label: 'Score & Pipeline Update', description: 'Results flow into the dashboard with scores, code quality metrics, and links to the submission for manual review.' }
      ]
    },
    techDetails: [
      { title: 'Sandboxed Code Execution', description: 'Each submission runs in an isolated Docker container with no network access, limited CPU/memory, and automatic timeout — preventing abuse.', category: 'Security', tags: ['Docker', 'Sandbox'] },
      { title: 'Multi-language Support', description: 'The engine supports JavaScript, Python, Java, C++, Go, and Rust. Each language has its own container with appropriate test harnesses.', category: 'Scalability', tags: ['Multi-language'] }
    ],
    status: { phase: 'Development', since: '2026-04', ciStatus: 'Not Configured' },
    timeline: { start: 'Apr 2026', end: 'Active', history: [{ phase: 'Repository Created', date: 'Apr 2026', completed: true }, { phase: 'Evaluation Engine', date: 'Present', completed: false }] }
  },
  {
    title: 'Exam Protector — Mobile Exam Security',
    shortDescription: 'The Android app companion to Phone Proctor — monitors device activity during exams, detects suspicious behavior, and alerts the backend in real-time.',
    fullDescription: `Exam Protector Mobile is the Android frontend of the Phone Proctor ecosystem. While Phone Proctor handles server-side video analysis, this app runs on the student's device monitoring local activity — detecting when users switch away from the exam app, attempt screenshots, or when multiple faces appear in the camera frame.

Built with JavaScript for the UI and Kotlin for native Android features, the app communicates with the Phone Proctor backend via WebSocket for real-time alerting. Suspicious behavior triggers automatic screen locking, timestamped logs, and proctor dashboard notifications within milliseconds.`,
    features: ['Real-time Device Monitoring', 'Kotlin Native Integration', 'Screenshot Prevention', 'App-switch Detection & Lock', 'WebSocket Backend Connection', 'Suspicious Activity Logging'],
    tags: ['JavaScript', 'Kotlin', 'Mobile', 'Android'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/exam-protector-mobile',
    repo: 'https://github.com/Mpratyush54/exam-protector-mobile',
    category: 'Mobile', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/exam-protector-mobile', featured: false,
    languageStats: [{ name: 'JavaScript', percent: 91, color: '#F7DF1E' }, { name: 'Kotlin', percent: 7, color: '#A97BFF' }, { name: 'CSS', percent: 2, color: '#563D7C' }],
    deployment: { type: 'Android Mobile App', platform: 'Android (Private APK Distribution)', url: '', details: 'Android app distributed as a signed APK to enrolled institutions. Kotlin native layer handles device-level security features. JavaScript bridge communicates with the native module for screenshot blocking and app-switch monitoring. Connects to the Phone Proctor backend via secure WebSocket.', ciCd: 'Not configured yet — APKs are built and signed manually during development.' },
    architecture: {
      title: 'How Exam Protector Works',
      steps: [
        { icon: '📱', label: 'App Launches in Kiosk Mode', description: 'The exam app launches in locked-down kiosk mode, preventing access to other apps or system functions.' },
        { icon: '👁️', label: 'Monitor Device Activity', description: 'The app monitors foreground/background switches, screenshot attempts, and camera feed for multiple faces.' },
        { icon: '⚡', label: 'Real-time Alert via WebSocket', description: 'Suspicious activity is sent to the Phone Proctor backend via WebSocket within milliseconds with evidence logs.' },
        { icon: '🔒', label: 'Automatic Lockdown', description: 'Severe violations (leaving the app, multiple faces) trigger automatic screen locking and proctor notification.' }
      ]
    },
    techDetails: [
      { title: 'Kotlin for Deep OS Access', description: 'Kotlin provides access to Android system APIs unavailable from cross-platform frameworks — monitoring app switches, disabling screenshots, enforcing kiosk mode.', category: 'Architecture', tags: ['Kotlin', 'Android'] },
      { title: 'WebSocket for Sub-second Alerts', description: 'Persistent WebSocket connections deliver alerts in under 100ms. Auto-reconnects if connectivity drops during the exam.', category: 'Performance', tags: ['WebSocket', 'Real-time'] }
    ],
    status: { phase: 'Development', since: '2026-02', ciStatus: 'Not Configured' },
    timeline: { start: 'Feb 2026', end: 'Active', history: [{ phase: 'Repository Created', date: 'Feb 2026', completed: true }, { phase: 'Kiosk Mode', date: 'Mar 2026', completed: true }, { phase: 'WebSocket Integration', date: 'Apr 2026', completed: true }] }
  },
  {
    title: 'Recommender Engine — ML Recommendation System',
    shortDescription: 'A hybrid recommendation engine combining collaborative filtering and content-based ML algorithms with an interactive Flask dashboard for training and evaluation.',
    fullDescription: `This recommendation system combines collaborative filtering ("users who liked X also liked Y") with content-based filtering ("this item is similar to what you've viewed"). The Python backend handles matrix factorization (SVD) for collaborative filtering and similarity computations for content-based recommendations.

The Flask web dashboard lets you load datasets, train models, visualize precision/recall/F1 metrics, and test recommendations interactively. Interactive charts compare algorithm outputs on the same data — designed as both a learning tool and a production-adaptable engine.`,
    features: ['Collaborative Filtering (SVD)', 'Content-based Recommendations', 'Hybrid Model Ensemble', 'Flask Web Dashboard', 'Model Evaluation Metrics', 'Interactive Visualization Charts'],
    tags: ['Python', 'JavaScript', 'Machine Learning', 'Flask'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/recommendation-_system',
    repo: 'https://github.com/Mpratyush54/recommendation-_system',
    category: 'Backend', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/recommendation-_system', featured: false,
    languageStats: [{ name: 'Python', percent: 55, color: '#3776AB' }, { name: 'JavaScript', percent: 24, color: '#F7DF1E' }, { name: 'CSS', percent: 20, color: '#563D7C' }, { name: 'HTML', percent: 1, color: '#E34C26' }],
    deployment: { type: 'Web Application', platform: 'Flask (Self-hosted)', url: '', details: 'Flask web application designed to run behind Gunicorn + Nginx on a VPS. Python ML models run in-process for low-latency predictions. SQLite for dataset storage during development. JavaScript frontend served as static files from Flask.', ciCd: 'Not configured yet — run locally via the Flask dev server during experimentation.' },
    architecture: {
      title: 'How the Recommender Works',
      steps: [
        { icon: '📊', label: 'Load & Preprocess Data', description: 'Load user-item interaction data (ratings, views, purchases). Preprocess into matrix format for collaborative filtering.' },
        { icon: '🧮', label: 'Matrix Factorization', description: 'SVD factorizes the user-item matrix into latent features, discovering hidden patterns in user preferences.' },
        { icon: '📏', label: 'Compute Similarities', description: 'Content-based filtering computes item similarity using feature vectors. Combined with collaborative results for hybrid recommendations.' },
        { icon: '📈', label: 'Evaluate & Visualize', description: 'The Flask dashboard shows precision, recall, and F1 scores. Interactive charts compare algorithm outputs on the same data.' }
      ]
    },
    techDetails: [
      { title: 'Hybrid Filtering Approach', description: 'Combining collaborative and content-based filtering overcomes the cold-start problem — new items get recommended based on features even without interaction history.', category: 'Architecture', tags: ['Hybrid', 'Cold Start'] },
      { title: 'Matrix Factorization for Scale', description: 'SVD reduces sparse user-item matrices into dense latent factors, enabling recommendations even with millions of users and items.', category: 'Performance', tags: ['SVD', 'Matrix Factorization'] }
    ],
    status: { phase: 'Development', since: '2026-02', ciStatus: 'Not Configured' },
    timeline: { start: 'Feb 2026', end: 'Active', history: [{ phase: 'Repository Created', date: 'Feb 2026', completed: true }, { phase: 'Collaborative Filtering', date: 'Mar 2026', completed: true }, { phase: 'Flask Dashboard', date: 'Apr 2026', completed: true }] }
  },
  {
    title: 'RTMP Server — Custom Live Streaming Server',
    shortDescription: 'A low-latency RTMP streaming server written in C for video ingestion, transcoding, and live broadcast — built from scratch for millisecond-level control.',
    fullDescription: `A custom implementation of an RTMP streaming server written from scratch in C — replacing off-the-shelf solutions like NGINX-RTMP with a purpose-built server optimized for millisecond-level latency. Handles three stages: ingestion (receiving streams from OBS/FFmpeg), transcoding between formats, and distribution to viewers.

Built for scenarios where every millisecond matters — live auctions, real-time broadcasting, or interactive streaming where buffering is unacceptable. The C implementation provides full control over packet handling, buffer sizes, and memory management.`,
    features: ['Custom RTMP Protocol Implementation', 'Video Ingestion from OBS/FFmpeg', 'Format Transcoding Pipeline', 'Low-latency Viewer Distribution', 'C for Maximum Performance'],
    tags: ['C', 'Makefile', 'Streaming'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/RTMP-Server',
    repo: 'https://github.com/Mpratyush54/RTMP-Server',
    category: 'DevOps', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/RTMP-Server', featured: false,
    languageStats: [{ name: 'Makefile', percent: 78, color: '#427819' }, { name: 'C', percent: 22, color: '#555555' }],
    deployment: { type: 'Native Server Application', platform: 'Linux (Bare Metal / VPS)', url: '', details: 'Compiled C binary that runs directly on Linux servers for maximum performance — no container overhead. Makefile build system with minimal dependencies: only pthreads and system socket libraries. Stream distribution is still in development.', ciCd: 'Not configured yet — built locally via Makefile.' },
    architecture: {
      title: 'How the RTMP Server Works',
      steps: [
        { icon: '📹', label: 'Ingest Video Stream', description: 'Broadcasting software (OBS, FFmpeg) pushes an RTMP stream. The server parses RTMP protocol packets in real-time.' },
        { icon: '🔄', label: 'Transcode (Optional)', description: 'If needed, the stream is transcoded — converting codecs, adjusting resolution, or changing bitrate for different viewers.' },
        { icon: '📡', label: 'Distribute to Viewers', description: 'Viewers connect and receive the video stream. The server handles multiple viewers per stream with efficient packet replication.' }
      ]
    },
    techDetails: [
      { title: 'C for Maximum Performance', description: 'C was chosen because existing RTMP/media libraries (FFmpeg, x264) are C-based. Direct integration avoids FFI overhead.', category: 'Performance', tags: ['C', 'Native'] },
      { title: 'Custom Protocol Implementation', description: 'Implementing RTMP from scratch provides full control over buffer sizes, handshake timing, and chunk sizes for latency tuning.', category: 'Architecture', tags: ['RTMP', 'Protocol'] }
    ],
    status: { phase: 'Development', since: '2025-10', ciStatus: 'Not Configured' },
    timeline: { start: 'Oct 2025', end: 'Active', history: [{ phase: 'Repository Created', date: 'Oct 2025', completed: true }, { phase: 'Protocol Parsing', date: 'Nov 2025', completed: true }, { phase: 'Stream Distribution', date: 'Present', completed: false }] }
  },
  {
    title: 'n8n Setup — Workflow Automation Blueprints',
    shortDescription: 'Preconfigured n8n workflow templates and Docker deployment scripts for automating API integrations, data sync, and business processes.',
    fullDescription: 'A ready-to-deploy n8n setup with workflow templates for common automation patterns — webhook-triggered data sync, scheduled report generation, CRM integration, and notification pipelines. Includes Docker Compose configuration for one-command deployment with PostgreSQL and Redis, credential encryption setup, and environment variable management. Instead of writing code for every integration, n8n lets you visually connect 300+ services — this repo provides the production-ready blueprints to get started immediately.',
    features: ['Prebuilt Workflow Templates', 'Webhook & API Integrations', 'Credential Management', 'Docker Compose Deployment', 'Visual Workflow Editor (n8n)'],
    tags: ['n8n', 'Automation', 'Workflow'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/n8n-setup',
    repo: 'https://github.com/Mpratyush54/n8n-setup',
    category: 'DevOps', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/n8n-setup', featured: false,
    languageStats: [],
    deployment: { type: 'Docker Compose Stack', platform: 'Any Docker Host (VPS / NAS / Local)', url: '', details: 'Single docker-compose.yml spins up n8n with PostgreSQL for workflow state, Redis for job queue management, and credential encryption with a user-provided key. Nginx reverse proxy with Let\'s Encrypt SSL included. Designed to run on any Docker host — VPS, Synology NAS, or local development machine.', ciCd: 'Docker Compose stack updates via git pull on the server. Watchtower container auto-updates images. Backup scripts for PostgreSQL and .n8n config exports.' },
    architecture: {
      title: 'How n8n Setup Works',
      steps: [
        { icon: '🐳', label: 'Deploy with Docker', description: 'Run a single docker-compose command to spin up n8n with PostgreSQL, Redis, and credential encryption.' },
        { icon: '🔌', label: 'Connect Services', description: 'Use the visual editor to connect 300+ integrations — HTTP, databases, email, Slack, and more.' },
        { icon: '⚡', label: 'Automate Workflows', description: 'Trigger workflows via webhook, schedule (cron), or manual execution. Monitor logs in the dashboard.' }
      ]
    },
    techDetails: [
      { title: 'One-command Docker Compose', description: 'The compose file bundles n8n, PostgreSQL, and Redis with preconfigured networking, volumes, and environment variables.', category: 'UX', tags: ['Docker', 'DevOps'] },
      { title: 'Credential Encryption at Rest', description: 'API keys encrypted with a user-provided key using n8n\'s built-in encryption. Decryption only at execution time.', category: 'Security', tags: ['Encryption'] }
    ],
    status: { phase: 'Development', since: '2026-05', ciStatus: 'Not Configured' },
    timeline: { start: 'May 2026', end: 'Active', history: [{ phase: 'Repository Created', date: 'May 2026', completed: true }, { phase: 'Template Library', date: 'Present', completed: false }] }
  },
// --- GitLab projects ---
  {
    title: 'CAPS Kengeri — Official Club Website',
    shortDescription: 'The official CAPS (Computer and Programming Society) club website at Christ University, Kengeri Campus — SEO-optimized, ranking 3rd for key search terms. Features admin workflow blocking, 3-tier RBAC, and content moderation with blocked words. Live at capskengeri.com.',
    fullDescription: `CAPS Kengeri is the official website for the CAPS (Computer and Programming Society) club at Christ University, Kengeri Campus. Built with React and TypeScript (TSX), it's the public face of the club — showcasing events, team members, achievements, and providing information to prospective members.

The site is heavily SEO-optimized with structured data, meta tags, sitemaps, and performance optimization — achieving 3rd rank for key search terms. Behind the public pages, an admin panel provides workflow management with 3-tier role-based access control (admin, editor, moderator), content publishing workflows with approval chains, and a blocked words system that automatically flags or rejects inappropriate content before it goes live.

Built with React and deployed at capskengeri.com with a Node.js backend and PostgreSQL.`,
    features: ['SEO-optimized Public Website', '3-tier Role-based Access (Admin/Editor/Moderator)', 'Content Publishing with Approval Workflows', 'Blocked Words Auto-moderation System', 'Event Showcase & Club Information', 'Responsive Design'],
    tags: ['React', 'TypeScript', 'SEO', 'Club Website', 'RBAC'],
    imageUrl: 'https://image.thum.io/get/width/1200/crop/630/https://capskengeri.com',
    link: 'https://capskengeri.com/',
    repo: 'https://gitlab.com/techtank.capskengeri-group/caps-kengeri',
    category: 'Web', source: 'gitlab', sourceUrl: 'https://gitlab.com/techtank.capskengeri-group/caps-kengeri', featured: true,
    languageStats: [{ name: 'TSX', percent: 91, color: '#3178C6' }, { name: 'CSS', percent: 5, color: '#563D7C' }, { name: 'JavaScript', percent: 2, color: '#F7DF1E' }, { name: 'TypeScript', percent: 1, color: '#3178C6' }],
    deployment: { type: 'Web Application', platform: 'Vercel (Live at capskengeri.com)', url: 'https://capskengeri.com/', details: 'React frontend deployed with automatic SSL and CDN. Node.js/Express backend with PostgreSQL. SEO optimization with structured data (JSON-LD), automatic sitemap generation, meta tags, and performance optimization for Core Web Vitals.', ciCd: 'GitLab CI pipeline — automated SEO checks, tests, and deployment on merge to main.' },
    architecture: {
      title: 'How CAPS Kengeri Works',
      steps: [
        { icon: '🌐', label: 'Public Website', description: 'Visitors browse club information, events, team profiles, and achievements. SEO-optimized pages rank high for relevant search terms.' },
        { icon: '🔐', label: '3-tier Admin Panel', description: 'Admins, editors, and moderators each have different permissions for creating, publishing, and approving content.' },
        { icon: '🚫', label: 'Blocked Words Moderation', description: 'Content submissions are checked against a blocked words list. Flagged content is auto-rejected or sent for moderator review.' },
        { icon: '✅', label: 'Workflow Approval', description: 'Editors create content drafts. Moderators review. Admins publish. Every step is tracked with timestamps and audit logs.' }
      ]
    },
    techDetails: [
      { title: 'SEO Optimization for Top Rankings', description: 'Structured data (JSON-LD), automatic sitemap generation, meta tag management, performance optimization for Core Web Vitals, and semantic HTML — achieving 3rd rank for key search terms.', category: 'Performance', tags: ['SEO', 'JSON-LD', 'Core Web Vitals'] },
      { title: '3-tier RBAC with Audit Trail', description: 'Admins have full access, editors can create and edit content, moderators review and approve. Every action is logged with timestamps for accountability.', category: 'Security', tags: ['RBAC', 'Audit', 'Permissions'] },
      { title: 'Content Moderation with Blocked Words', description: 'Configurable blocked words list automatically flags inappropriate content. Flagged submissions are either rejected outright or queued for moderator review — keeping the public site clean.', category: 'Security', tags: ['Moderation', 'Blocked Words', 'Content Filtering'] }
    ],
    status: { phase: 'Production', since: '2025', ciStatus: 'Passing', deploymentType: 'Vercel' },
    timeline: { start: '2025', end: 'Active', history: [{ phase: 'Initial Design & SEO', date: '2025', completed: true }, { phase: 'Admin Panel Launch', date: 'Early 2026', completed: true }, { phase: 'Blocked Words Moderation', date: '2026', completed: true }, { phase: 'Continuous SEO Optimization', date: 'Present', completed: false }] }
  },
  {
    title: 'CAPS Club Backend — API Service',
    shortDescription: 'The Node.js API backend powering the CAPS college club — authentication, data processing, business logic, and third-party integrations, hosted on GitLab.',
    fullDescription: 'The backend API service for the CAPS college club. Built with Node.js and Express, it powers the RESTful APIs used by the club website and internal tools — user authentication with JWT, data processing pipelines for student records and attendance, business logic for scheduling and grading rules, and integrations with SMS gateways, email providers, and payment systems. Modular architecture with isolated domain services (students, attendance, scheduling) that can be extended without touching existing code.',
    features: ['RESTful API Architecture', 'JWT User Authentication', 'Modular Domain Services', 'SMS & Email Integration', 'Async Data Processing'],
    tags: ['Node.js', 'JavaScript', 'Backend', 'Automation'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/server-automation',
    repo: 'https://gitlab.com/campus-navigator/CAPS-Automation-backend',
    category: 'Backend', source: 'gitlab', sourceUrl: 'https://gitlab.com/campus-navigator/CAPS-Automation-backend', featured: false,
    languageStats: [{ name: 'JavaScript', percent: 89, color: '#F7DF1E' }, { name: 'HTML', percent: 11, color: '#E34C26' }],
    deployment: { type: 'Backend API Service', platform: 'Docker + Cloud VPS', url: '', details: 'Node.js/Express designed to run via Docker on a cloud VPS behind an Nginx reverse proxy, with PostgreSQL for relational data and Redis for session caching and job queues. In active development.', ciCd: 'Not configured yet — deployments are manual while the API surface stabilizes.' },
    architecture: {
      title: 'How the Backend Works',
      steps: [
        { icon: '🔐', label: 'Authentication Layer', description: 'JWT-based authentication validates requests. Role-based middleware restricts access to authorized endpoints.' },
        { icon: '⚙️', label: 'Domain Service Execution', description: 'Each domain (students, attendance, scheduling) has its own router and service layer. Business logic is isolated and testable.' },
        { icon: '🔗', label: 'External Integrations', description: 'SMS gateways, email providers, and payment systems integrate via adapter patterns — swappable without changing domain logic.' },
        { icon: '📊', label: 'Async Processing', description: 'Heavy operations (reports, exports) run asynchronously via job queues. Results delivered via webhook or polling.' }
      ]
    },
    techDetails: [
      { title: 'Modular Domain Architecture', description: 'Each domain is a self-contained module with routes, services, and data access. Adding a new domain doesn\'t touch existing code.', category: 'Architecture', tags: ['Modular', 'Node.js'] },
      { title: 'JWT + Role-based Access', description: 'JSON Web Tokens carry identity and role claims. Middleware checks permissions at the route level — no repeated DB lookups.', category: 'Security', tags: ['JWT', 'Authentication'] }
    ],
    status: { phase: 'Development', since: '2026-04', ciStatus: 'Not Configured' },
    timeline: { start: 'Apr 2026', end: 'Active', history: [{ phase: 'Repository Created', date: 'Apr 2026', completed: true }, { phase: 'API Development', date: 'Present', completed: false }] }
  },
  {
    title: 'CAPS Automation — Official CAPS Kengeri Portal',
    shortDescription: 'The official Centre for Academic and Professional Support portal at Christ University, Kengeri Campus — managing events, registrations, attendance, certificates, reports, notifications, meeting minutes, and team workflows with role-based access. Live at worklog.capskengeri.com.',
    fullDescription: `CAPS Automation is the official Centre for Academic and Professional Support portal for Christ University, Kengeri Campus. It's a full-featured PWA used daily by hundreds of CAPS members — from volunteers to super admins — to run the club's operations.

The platform handles the complete lifecycle of club activities: event creation with customizable registration forms, QR-coded attendance tracking that syncs in real-time, automated certificate generation after events, feedback collection with analytics dashboards, multi-format report generation (PDF and Excel), push notifications via the PWA, meeting minutes documentation, and team workflow coordination with task assignments and deadlines.

Access is controlled across five tiers — volunteers, team leads, admins, and super admins — each with appropriate permissions for their role. The PWA is installable on any device and queues data locally when offline, syncing automatically when connectivity returns.

Built with React and Node.js, deployed at worklog.capskengeri.com.`,
    features: ['Event Creation & Registration Management', 'QR-based Real-time Attendance Tracking', 'Automated Bulk Certificate Generation', 'Feedback Collection with Analytics', 'PDF & Excel Report Generation', 'Push Notifications via PWA', 'Meeting Minutes Documentation', 'Team Workflow & Task Management', '5-tier Role-based Access Control', 'Offline-capable Progressive Web App'],
    tags: ['React', 'Node.js', 'PWA', 'Event Management', 'Club Portal'],
    imageUrl: 'https://worklog.capskengeri.com/icons/pwa-512x512.png',
    link: 'https://worklog.capskengeri.com/',
    repo: 'https://gitlab.com/techtank.capskengeri/CAPS-Automation',
    category: 'Web', source: 'gitlab', sourceUrl: 'https://gitlab.com/techtank.capskengeri/CAPS-Automation', featured: true,
    languageStats: [{ name: 'JavaScript', percent: 84, color: '#F7DF1E' }, { name: 'CSS', percent: 16, color: '#563D7C' }],
    deployment: { type: 'Progressive Web Application', platform: 'Vercel / Cloudflare (Live at worklog.capskengeri.com)', url: 'https://worklog.capskengeri.com/', details: 'React PWA deployed with automatic SSL and CDN via Cloudflare. Node.js/Express backend on a cloud VPS with PostgreSQL. ImageKit for image optimization and CDN. Full PWA with service worker caching for offline support. Automatic sitemap generation for SEO. Structured data (JSON-LD) for rich search results.', ciCd: 'GitLab CI pipeline — automated testing, build, and deployment on merge to main. Preview deployments for feature branches via GitLab Review Apps.' },
    architecture: {
      title: 'How CAPS Automation Works',
      steps: [
        { icon: '📅', label: 'Create & Manage Events', description: 'Admins create events with registration forms, date/time, venue, capacity, and certificate templates. Members register through the portal or PWA.' },
        { icon: '✅', label: 'Track Attendance via QR', description: 'Attendees check in by scanning QR codes at the event entrance. Attendance data syncs to the dashboard in real-time.' },
        { icon: '📜', label: 'Auto-generate Certificates', description: 'After events, certificates are automatically generated for all attendees based on attendance records. Available as downloadable PDFs.' },
        { icon: '📊', label: 'Reports & Analytics', description: 'Generate PDF or Excel reports for any event or period. View engagement analytics, feedback trends, and team performance metrics.' },
        { icon: '🔔', label: 'Push Notifications', description: 'Send push notifications to members about upcoming events, deadline reminders, and announcements through the PWA.' },
        { icon: '👥', label: 'Team Workflows', description: 'Assign tasks, set deadlines, document meeting minutes, and manage workflows across 5 access tiers from volunteer to super admin.' }
      ]
    },
    techDetails: [
      { title: 'PWA with Offline Queue', description: 'Service workers cache the app shell and critical data. Attendance marking and form submissions queue locally when offline and sync automatically when connectivity returns.', category: 'UX', tags: ['PWA', 'Offline', 'Service Worker'] },
      { title: 'Five-tier Role-based Access', description: 'Volunteers, team leads, admins, and super admins each have granular permissions. All actions are audited and visible to super admins.', category: 'Security', tags: ['RBAC', 'Permissions', 'Audit'] },
      { title: 'Automated Certificate Engine', description: 'Certificate templates are configured per event type. After attendance is finalized, the engine generates personalized PDF certificates in bulk, available for individual download.', category: 'Performance', tags: ['PDF', 'Automation', 'Bulk'] },
      { title: 'Multi-format Reporting', description: 'Reports export as PDF for formal documentation or Excel for data analysis. Filters allow slicing by date range, event type, team, or attendance status.', category: 'UX', tags: ['PDF', 'Excel', 'Reporting'] }
    ],
    status: { phase: 'Production', since: '2026', ciStatus: 'Passing', deploymentType: 'Vercel' },
    timeline: { start: '2025', end: 'Active', history: [{ phase: 'Initial Development', date: '2025', completed: true }, { phase: 'Event Management Launch', date: 'Early 2026', completed: true }, { phase: 'Certificates & Reports', date: 'Mid 2026', completed: true }, { phase: 'PWA & Notifications', date: 'Present', completed: false }] }
  },
  {
    title: 'CAPS Platform — Internal PaaS with Multi-SDK',
    shortDescription: 'An internal platform-as-a-service for CAPS with four language SDKs (Angular, React, Node, Python), Kubernetes ingress with OAuth2 proxy, Docker Compose orchestration, and automated CI/CD — the operational backbone of the CAPS ecosystem.',
    fullDescription: `The CAPS Platform is an internal PaaS I architected to unify the CAPS club's infrastructure. Instead of each project reinventing deployment, authentication, and monitoring, the platform provides reusable SDK packages in four languages — Angular, React, Node.js, and Python — that any CAPS team can drop into their project and instantly get authenticated API access, event publishing, and observability.

At the infrastructure layer, the platform runs on Kubernetes with an OAuth2 proxy handling single sign-on across all internal tools. Docker Compose provides local development parity. A platform-bootstrap script automates the initial cluster setup, and CI/CD pipelines (GitHub Actions) build, test, and publish SDK packages automatically.

The result: new CAPS projects go from idea to deployed in hours instead of weeks. The platform has 96+ commits and is the most reused internal tool across the 8 concurrent projects I lead.`,
    features: ['Four SDK Packages (Angular, React, Node, Python)', 'Kubernetes Deployment with OAuth2 SSO', 'Docker Compose Local Development', 'Automated CI/CD for SDK Publishing', 'Platform Bootstrap Script', 'Reusable Auth & API Layer'],
    tags: ['TypeScript', 'Python', 'Kubernetes', 'Docker', 'OAuth2', 'SDK', 'DevOps'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/server-automation',
    repo: 'https://github.com/Mpratyush54/server-automation',
    category: 'DevOps', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/server-automation', featured: true,
    languageStats: [{ name: 'TypeScript', percent: 52, color: '#3178C6' }, { name: 'Python', percent: 16, color: '#3776AB' }, { name: 'HTML', percent: 13, color: '#E34C26' }, { name: 'Shell', percent: 10, color: '#89e051' }, { name: 'CSS', percent: 5, color: '#563D7C' }, { name: 'JavaScript', percent: 4, color: '#F7DF1E' }],
    deployment: { type: 'Internal PaaS + SDK Packages', platform: 'Kubernetes (On-premise) + Docker Compose', url: '', details: 'Kubernetes cluster with OAuth2 proxy for SSO across all CAPS tools. Docker Compose stack for local development parity. SDK packages published as npm/PyPI packages with automated versioning. Platform bootstrap script handles initial cluster setup, cert generation, and ingress configuration. GitHub Actions CI builds and tests all SDK packages on every push.', ciCd: 'GitHub Actions — multi-stage pipeline: lint → test → build → publish SDKs. Automated semantic versioning via conventional commits. Docker images built and pushed to registry on release tags.' },
    architecture: {
      title: 'How CAPS Platform Works',
      steps: [
        { icon: '📦', label: 'SDK Packages Abstract Infrastructure', description: 'Each CAPS project imports the appropriate SDK (Angular, React, Node, or Python) and gets instant access to authenticated API calls, event publishing, and configuration.' },
        { icon: '🔐', label: 'OAuth2 Proxy Handles SSO', description: 'All internal tools sit behind an OAuth2 proxy. Developers authenticate once via their institution credentials — no per-tool login or API key management.' },
        { icon: '🐳', label: 'Docker Compose for Local Dev', description: 'The platform Docker Compose stack mirrors production. Developers run the same containers locally that run in Kubernetes — no "works on my machine" issues.' },
        { icon: '☸️', label: 'Kubernetes for Production', description: 'SDK services deploy to the Kubernetes cluster with automatic scaling, health checks, and rolling updates. Platform bootstrap script automates initial provisioning.' },
        { icon: '🔄', label: 'CI/CD Publishes SDKs Automatically', description: 'GitHub Actions build, test, and publish SDK packages on every push. Version bumps follow conventional commits — teams always get compatible versions.' }
      ]
    },
    techDetails: [
      { title: 'Multi-Language SDK Architecture', description: 'Four SDKs share a common API contract but each follows its language\'s idioms — Angular with injectable services, React with hooks, Node with middleware, Python with decorators.', category: 'Architecture', tags: ['SDK', 'Multi-language', 'API Design'] },
      { title: 'OAuth2 SSO for Internal Tools', description: 'OAuth2 proxy sits in front of all CAPS internal services. Developers authenticate via Google Workspace SSO — no shared secrets, no per-service credentials.', category: 'Security', tags: ['OAuth2', 'SSO', 'Security'] },
      { title: 'Kubernetes + Docker Compose Parity', description: 'The Docker Compose config is a superset of production containers. What runs locally is what runs in K8s — eliminating environment-specific bugs.', category: 'Architecture', tags: ['Kubernetes', 'Docker', 'DevOps'] }
    ],
    status: { phase: 'Development', since: '2026-06', ciStatus: 'Passing', deploymentType: 'Manual' },
    timeline: { start: 'Jun 2026', end: 'Active', history: [{ phase: 'SDK Architecture Design', date: 'Jun 2026', completed: true }, { phase: 'Node & Python SDKs', date: 'Jun 2026', completed: true }, { phase: 'Angular & React SDKs', date: 'Jul 2026', completed: true }, { phase: 'K8s + OAuth2 Setup', date: 'Present', completed: false }] }
  },
  {
    title: 'Campus Navigator — Interactive Campus Map',
    shortDescription: 'An interactive campus navigation application for CHRIST University, Kengeri Campus — helping students, faculty, and visitors find buildings, departments, and facilities with turn-by-turn directions.',
    fullDescription: `Campus Navigator provides an interactive digital map of the CHRIST University, Kengeri Campus. Instead of relying on static PDF maps or asking for directions, users can search for any building, department, or facility and get turn-by-turn navigation within the campus.

The application integrates with the CAPS ecosystem, pulling real-time event locations and room availability. Built as part of the CAPS tool suite to improve the campus experience for new students, visitors, and event attendees.`,
    features: ['Interactive Campus Map', 'Search Buildings & Departments', 'Turn-by-turn Directions', 'Event Location Integration', 'Responsive Design'],
    tags: ['JavaScript', 'Campus', 'Navigation', 'Map'],
    imageUrl: 'https://opengraph.githubassets.com/1/Mpratyush54/Campus-Navigator',
    repo: 'https://github.com/Mpratyush54/Campus-Navigator',
    category: 'Web', source: 'github', sourceUrl: 'https://github.com/Mpratyush54/Campus-Navigator', featured: false,
    languageStats: [],
    deployment: { type: 'Web Application', platform: 'Web Browser', url: '', details: 'Web-based application accessible from any device on campus network.', ciCd: 'Not Configured' },
    architecture: {
      title: 'How Campus Navigator Works',
      steps: [
        { icon: '🗺️', label: 'User Selects Destination', description: 'Users search for a building, department, or facility on the interactive campus map.' },
        { icon: '📍', label: 'Route Calculation', description: 'The application calculates the optimal walking route from the user\'s current location to the destination.' },
        { icon: '📱', label: 'Turn-by-turn Guidance', description: 'Users receive turn-by-turn directions with visual cues and estimated walking time.' }
      ]
    },
    techDetails: [
      { title: 'Campus Map Integration', description: 'The interactive map layers building outlines, walkways, and points of interest on top of satellite imagery of the campus.', category: 'UX', tags: ['Mapping', 'Navigation'] }
    ],
    status: { phase: 'Development', since: '2026-05', ciStatus: 'Not Configured' },
    timeline: { start: 'May 2026', end: 'Active', history: [{ phase: 'Repository Created', date: 'May 2026', completed: true }, { phase: 'Map Rendering', date: 'Present', completed: false }] }
  },
  {
    title: 'Vision-You — AI Career Guidance Platform',
    shortDescription: 'An AI-powered career guidance platform combining multiple GPT-4o-mini assessment engines — career vision, Ikigai analysis, and task-based matching — with structured JSON output pipelines and Supabase backend.',
    fullDescription: `Vision-You is an AI career guidance platform that helps students and professionals discover their ideal career paths through three distinct AI assessment engines — all powered by GPT-4o-mini with structured JSON output pipelines.

The first engine generates a "Vision You" summary — distilling users' values, skills, lifestyle preferences, and aspirations into a cohesive career identity with personalized roadmaps. The second engine applies the Japanese Ikigai framework — finding the intersection of passion, strengths, market needs, and earning potential. The third engine maps user-selected tasks to specific career recommendations with India vs. abroad scope analysis.

Built with React/TypeScript and a Node.js/Express backend connected to Supabase, with Tailwind CSS for the UI. All three AI pipelines enforce strict JSON schema validation, markdown stripping, and graceful fallback on parsing failures.`,
    features: ['AI Vision Generation (GPT-4o-mini)', 'Ikigai Career Assessment Engine', 'Task-based Career Matching', 'Structured JSON Output Pipelines', 'Supabase Database Integration', 'React + TypeScript + Tailwind UI'],
    tags: ['React', 'TypeScript', 'OpenAI', 'GPT-4o-mini', 'Supabase', 'TailwindCSS', 'Career'],
    imageUrl: 'https://opengraph.githubassets.com/1/vision-you/Vision-You',
    repo: 'https://gitlab.com/vision-you/Vision-You',
    category: 'Web', source: 'gitlab', sourceUrl: 'https://gitlab.com/vision-you/Vision-You', featured: true,
    languageStats: [{ name: 'TypeScript', percent: 85, color: '#3178C6' }, { name: 'JavaScript', percent: 10, color: '#F7DF1E' }, { name: 'CSS', percent: 5, color: '#563D7C' }],
    deployment: { type: 'Web Application', platform: 'Vite + Node.js/Express', url: '', details: 'React/TypeScript frontend built with Vite, served alongside a Node.js/Express backend running on port 5000. Supabase for user data and assessment results storage. Tailwind CSS for responsive UI. Concurrently runs frontend and backend in development mode.', ciCd: 'Not Configured' },
    architecture: {
      title: 'How Vision-You Works',
      steps: [
        { icon: '📝', label: 'User Completes Assessment', description: 'Users fill out career assessment forms covering their values, skills, lifestyle preferences, and task preferences.' },
        { icon: '🤖', label: 'AI Engine Processes Input', description: 'GPT-4o-mini processes the user responses through structured prompts with strict JSON schema enforcement and markdown stripping.' },
        { icon: '📊', label: 'Structured Results Generated', description: 'Three engines produce typed JSON output: Vision Summary (identity + skills + lifestyle + roadmap), Ikigai Analysis (passion + strengths + market needs + earning), and Career Matching (task-aligned careers).' },
        { icon: '💾', label: 'Results Saved to Supabase', description: 'Assessment results are persisted to Supabase. Users can revisit their profile, compare different assessment modes, and track their career exploration journey.' }
      ]
    },
    techDetails: [
      { title: 'Multi-Engine AI Architecture', description: 'Three independent GPT-4o-mini pipelines each with specialized prompts and schema validation. Each engine is a separate Express route with its own temperature, token limits, and error handling.', category: 'Architecture', tags: ['AI', 'GPT-4o-mini', 'Multi-Engine'] },
      { title: 'Strict JSON Output Enforcement', description: 'Every AI prompt includes a TypeScript-style schema definition with explicit rules: no markdown, no text outside JSON, no key renames, non-empty arrays. Failed parses trigger graceful fallback responses.', category: 'Performance', tags: ['JSON', 'Schema Validation', 'Error Handling'] },
      { title: 'Supabase for Persistence', description: 'Users\' assessment data and results stored in Supabase with row-level security. Enables cross-session continuity and comparative analysis.', category: 'Architecture', tags: ['Supabase', 'Database'] }
    ],
    status: { phase: 'Development', since: '2026-05', ciStatus: 'Not Configured' },
    timeline: { start: 'May 2026', end: 'Active', history: [{ phase: 'Vision Engine', date: 'May 2026', completed: true }, { phase: 'Ikigai Engine', date: 'Jun 2026', completed: true }, { phase: 'Task Matching Engine', date: 'Jul 2026', completed: true }, { phase: 'Supabase Integration', date: 'Present', completed: false }] }
  }
];

module.exports = projects;
