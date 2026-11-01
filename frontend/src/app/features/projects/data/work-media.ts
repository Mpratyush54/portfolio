import { Project } from '../models/project.model';

export type WorkMedia = {
  image?: string;
  gallery: string[];
  video?: string;
  poster?: string;
  mermaid: string;
  steps: { label: string; description: string }[];
};

function keyFor(project: Project): string {
  const title = project.title.toLowerCase();
  if (title.includes('classstream')) return 'classstream';
  if (title.includes('paas') || title.includes('multi-sdk') || title.startsWith('platform —') || title.startsWith('platform -')) {
    return 'platform';
  }
  if (title.includes('dayflow')) return 'dayflow';
  if (title.includes('caps automation')) return 'caps-automation';
  if (title.includes('phone proctor') || title.includes('exam')) return 'phone-proctor';
  if (title.includes('ambue')) return 'ambue';
  if (title.includes('vision') || title.includes('path')) return 'vision-you';
  if (title.includes('caps kengeri') || title.includes('club website')) return 'caps-kengeri';
  if (title.includes('recalibrate')) return 'recalibrate';
  if (title.includes('battery')) return 'battery';
  return '';
}

const DIAGRAMS: Record<string, string> = {
  platform: `flowchart TB
    subgraph sdks [Application SDKs]
      NodeSDK["Node SDK"]
      PySDK["Python SDK"]
      NgSDK["Angular SDK"]
      ReactSDK["React SDK"]
    end
    subgraph plane [Control plane]
      Portal["Angular portal"]
      API["Express API"]
      Docs["In-portal docs"]
    end
    subgraph identity [Identity]
      OAuth["OAuth2 proxy"]
      JWT["Passwordless JWT"]
    end
    subgraph gitops [GitOps on k3s]
      Git["Git push"]
      Argo["ArgoCD"]
      Helm["Helm"]
      Preview["Preview URL"]
    end
    subgraph data [Managed data]
      PG["Postgres"]
      Mongo["Mongo"]
      Redis["Redis"]
      MinIO["MinIO"]
    end
    subgraph obs [Observability]
      Prom["Prometheus"]
      Graf["Grafana"]
      Loki["Loki"]
    end
    NodeSDK --> API
    PySDK --> API
    NgSDK --> API
    ReactSDK --> API
    Portal --> API
    Docs --> Portal
    API --> OAuth --> JWT
    API --> PG
    API --> Mongo
    API --> Redis
    API --> MinIO
    Git --> Argo --> Helm --> Preview
    API --> Prom --> Graf
    API --> Loki`,
  classstream: `flowchart TB
    subgraph clients [Clients]
      PWA["Angular PWA"]
      Teacher["Teacher live UI"]
    end
    subgraph ingest [Ingest]
      Upload["VOD upload"]
      RTMP["RTMP live"]
    end
    subgraph media [Media pipeline]
      FF["FFmpeg 1080 720 480"]
      Dash["Bento4 DASH plus CENC"]
    end
    subgraph api [Node Express]
      REST["REST routes"]
      Keys["Two-step ClearKey"]
      Chat["Socket.IO chat"]
    end
    subgraph store [Datastores]
      MySQL["MySQL school data"]
      Audit["Mongo key audit"]
    end
    Upload --> FF
    RTMP --> FF
    FF --> Dash
    Dash --> Keys
    Keys --> PWA
    PWA --> REST
    Teacher --> Chat
    PWA --> Chat
    REST --> MySQL
    Keys --> Audit`,
  dayflow: `flowchart TB
    subgraph clients [Clients]
      Emp["Employee PWA"]
      HR["HR and Admin"]
    end
    subgraph auth [Auth]
      JWT["JWT access plus refresh"]
      RBAC["Employee vs HR roles"]
    end
    subgraph att [Attendance]
      Queue["Offline local queue"]
      Sync["Flush on reconnect"]
    end
    subgraph live [Live presence]
      SSE["SSE still-in stream"]
      Poll["Polling fallback"]
    end
    subgraph work [HR workflows]
      Leave["Leave requests"]
      Pay["Payroll and payslips"]
    end
    subgraph api [Express plus Mongo]
      API["REST plus Swagger"]
      DB["MongoDB"]
    end
    Emp --> JWT --> RBAC
    HR --> JWT
    Emp --> Queue --> Sync --> API
    HR --> SSE
    API --> SSE
    SSE -.-> Poll
    HR --> Leave
    HR --> Pay
    API --> DB`,
  'caps-automation': `flowchart TB
    subgraph surfaces [Surfaces]
      PWA["React PWA"]
      MCP["Remote MCP clients"]
      Verify["Public certificate verify"]
    end
    subgraph api [Express API]
      REST["REST routes"]
      AuthN["JWT Google and API keys"]
      RBAC["Volunteer to Super Admin"]
      IO["Socket.IO"]
      Mount["MCP Streamable HTTP"]
    end
    subgraph domain [Domain services]
      Events["Events registrations forms"]
      Cert["Certificate templates"]
      Reports["Weekly period session RAG"]
      Coord["Worklog MOMs inventory"]
      Mail["SMTP and email templates"]
    end
    subgraph jobs [Workers]
      RegW["Registration worker"]
      NotifW["Notification worker"]
      PhotoW["Photo sync"]
      ReportW["Report scheduler"]
      GoogleW["Google token renew"]
    end
    subgraph data [Data plane]
      Mongo["MongoDB"]
      Redis["Redis"]
      Drive["Google Drive and Sheets"]
      Files["Uploads and templates"]
    end
    subgraph cluster [Ops]
      K8s["Kubernetes"]
      Inf["Infisical"]
    end
    PWA --> REST
    PWA --> IO
    MCP --> Mount
    Verify --> REST
    REST --> AuthN --> RBAC
    REST --> Events
    REST --> Cert
    REST --> Reports
    REST --> Coord
    REST --> Mail
    Mount --> Events
    Mount --> Reports
    Events --> RegW
    Events --> NotifW
    Events --> PhotoW
    Reports --> ReportW
    Drive --> GoogleW
    REST --> Mongo
    IO --> Redis
    Cert --> Files
    PhotoW --> Drive
    K8s --> REST
    Inf --> K8s`,
  'phone-proctor': `flowchart TB
    subgraph device [Exam phone]
      Cam["Camera frames"]
      Motion["Accel and gyro"]
      Audio["Audio telemetry"]
    end
    subgraph ingest [Ingest]
      WS["WebSocket gateway"]
      Q["Worker queue"]
    end
    subgraph cv [Python workers]
      Vision["OpenCV face and gaze"]
      Fusion["Multi-signal fusion"]
      Rules["Rule engine"]
    end
    subgraph review [Human review]
      Alert["Timed incidents"]
      Dash["Proctor dashboard"]
    end
    Cam --> WS
    Motion --> WS
    Audio --> WS
    WS --> Q --> Vision
    Vision --> Fusion
    Motion --> Fusion
    Fusion --> Rules --> Alert --> Dash`,
  ambue: `flowchart TB
    subgraph field [Field]
      MR["Medical rep"]
      Scan["Barcode scanner APK"]
    end
    subgraph web [Angular client]
      Report["Field reports"]
      Review["Manager review"]
      Admin["Admin reporting"]
    end
    subgraph api [Node Express]
      JWT["JWT RBAC"]
      REST["Reporting APIs"]
    end
    subgraph host [AWS]
      EC2["EC2 plus Nginx"]
      MySQL["MySQL"]
    end
    MR --> Report
    Scan --> Report
    Report --> JWT --> REST
    Review --> JWT
    Admin --> JWT
    REST --> MySQL
    REST --> EC2`,
  'vision-you': `flowchart TB
    subgraph ui [React client]
      Form["Values skills lifestyle"]
      Pick["Engine picker"]
    end
    subgraph engines [GPT-4o-mini routes]
      Vision["Vision identity"]
      Ikigai["Ikigai analysis"]
      Match["Task career match"]
    end
    subgraph guard [Output guard]
      Schema["JSON schema"]
      Strip["Strip markdown"]
      Fallback["Parse fallback"]
    end
    subgraph persist [Persistence]
      SB["Supabase"]
    end
    Form --> Pick
    Pick --> Vision
    Pick --> Ikigai
    Pick --> Match
    Vision --> Schema
    Ikigai --> Schema
    Match --> Schema
    Schema --> Strip --> Fallback --> SB`,
  'caps-kengeri': `flowchart TB
    subgraph public [Public site]
      Pages["Events team club"]
      SEO["JSON-LD sitemap"]
    end
    subgraph publish [Publishing RBAC]
      Editor["Editor drafts"]
      Mod["Moderator review"]
      Admin["Admin publish"]
    end
    subgraph safety [Moderation]
      Words["Blocked words"]
      Flag["Flag or reject"]
    end
    subgraph stack [Stack]
      React["React TypeScript"]
      API["Node API"]
      PG["PostgreSQL"]
    end
    Editor --> Mod --> Admin --> Pages
    Pages --> SEO
    Editor --> Words --> Flag --> Mod
    React --> API --> PG`,
  recalibrate: `flowchart TB
    subgraph people [Roles]
      Student["Student"]
      Spec["Specialist"]
      Mod["Moderator"]
      Admin["Admin"]
    end
    subgraph thread [Thread flow]
      Ask["Ask a question"]
      Screen["Blocked-word screen"]
      Claim["Specialist claims"]
      Answer["Published answer"]
    end
    subgraph stack [Stack]
      UI["React TypeScript"]
      API["Node API"]
      PG["PostgreSQL"]
    end
    Student --> Ask --> Screen
    Screen --> Mod
    Mod --> Claim
    Spec --> Claim --> Answer
    Admin --> Mod
    UI --> API --> PG`,
  battery: `flowchart TB
    subgraph edge [Edge]
      BMS["BMS telemetry"]
      Rust["Rust collector"]
      Local["Local aggregate"]
    end
    subgraph cloud [Cloud]
      Go["Go REST API"]
      Dash["Health dashboards"]
      Alert["Life and alerts"]
    end
    subgraph ship [Split deploy]
      Docker["Docker Compose"]
    end
    BMS --> Rust --> Local --> Go
    Go --> Dash
    Go --> Alert
    Rust --> Docker
    Go --> Docker`,
};

const STEPS: Record<string, { label: string; description: string }[]> = {
  platform: [
    {
      label: 'SDKs sit in the app',
      description:
        'Node, Python, Angular and React clients get managed Postgres, Mongo and Redis pools, heartbeats and log forwarding without raw driver wiring.',
    },
    {
      label: 'One control plane',
      description:
        'The Angular portal and Express API handle projects, secrets, users and docs. Passwordless JWT sits behind an OAuth2 proxy.',
    },
    {
      label: 'Git push to preview',
      description:
        'ArgoCD and Helm roll the change onto k3s and issue a preview URL with health checks. Config is Global, Project, Environment, then Instance.',
    },
    {
      label: 'Observability by default',
      description: 'Prometheus, Grafana and Loki ship from every onboarded service. Local parity is Docker Compose.',
    },
  ],
  classstream: [
    {
      label: 'Ingest and package',
      description:
        'VOD uploads and RTMP live feeds are transcoded by FFmpeg to 1080, 720 and 480, then packaged as encrypted MPEG-DASH by Bento4.',
    },
    {
      label: 'Two-step ClearKey',
      description:
        'A dummy key is issued first. The real ClearKey is released only after session validation, so offline key extraction fails.',
    },
    {
      label: 'Live class path',
      description: 'Socket.IO carries chat and class events while the Angular PWA plays the adaptive stream.',
    },
    {
      label: 'Split datastores',
      description: 'MySQL holds school records. Mongo stores key-audit logs for the DRM path.',
    },
  ],
  dayflow: [
    {
      label: 'Role login',
      description: 'JWT access and refresh tokens separate Employee routes from HR and Admin.',
    },
    {
      label: 'Offline attendance',
      description: 'Check-in and check-out queue in the PWA and flush in order when the network returns.',
    },
    {
      label: 'Live HR presence',
      description: 'SSE pushes still-in counts. The dashboard falls back to polling if the stream drops.',
    },
    {
      label: 'Leave and payroll',
      description: 'Employees apply and view payslips. HR approves leave and manages payroll on the same API.',
    },
  ],
  'caps-automation': [
    {
      label: 'Identity and policy',
      description:
        'JWT, Google OAuth, API keys and device sessions sit under volunteer, team lead, admin and super-admin roles. The same predicates gate REST and remote MCP.',
    },
    {
      label: 'Event operations',
      description:
        'Custom forms, registration email templates, a registration worker and device heartbeats run attendance. Photos sync into Google Drive in the background.',
    },
    {
      label: 'Certificates and mail',
      description:
        'Handlebars templates, pdf-lib and canvas render certificates. A public verify route and SMTP templates send them. Infisical holds the secrets.',
    },
    {
      label: 'Reports and RAG',
      description:
        'Weekly, period and session reports are scheduled. Embeddings and a RAG path turn monthly ops notes into DOCX for leadership.',
    },
    {
      label: 'Coordination plane',
      description:
        'Worklogs, meeting minutes, inventory, bookings and Socket.IO notifications share Mongo and Redis on Kubernetes.',
    },
    {
      label: 'Remote MCP',
      description:
        'Streamable HTTP MCP with OAuth 2.1 PKCE calls the same domain services. It does not HTTP-proxy the REST API.',
    },
  ],
  'phone-proctor': [
    {
      label: 'Phone ingest',
      description: 'The kiosk app streams camera frames plus motion and audio over a WebSocket gateway.',
    },
    {
      label: 'Vision and fusion',
      description:
        'OpenCV looks for face, gaze and motion. A second stage only flags when more than one signal agrees.',
    },
    {
      label: 'Human review',
      description: 'The rule engine emits timed incidents with evidence. It does not auto-fail a candidate.',
    },
    {
      label: 'Horizontal workers',
      description: 'Frames land on a queue so extra Python workers can take more sessions.',
    },
  ],
  ambue: [
    {
      label: 'Field capture',
      description: 'Medical reps submit reports from Angular. An optional Android scanner verifies batches.',
    },
    {
      label: 'RBAC API',
      description: 'JWT claims split MR, Manager and Admin so field and management surfaces stay separate.',
    },
    {
      label: 'Review and reporting',
      description: 'Managers escalate. Admins read inventory-oriented reports from MySQL.',
    },
    {
      label: 'AWS host',
      description: 'The Node API and Angular assets ran on EC2 behind Nginx for about a year.',
    },
  ],
  'vision-you': [
    {
      label: 'Assessment input',
      description: 'Students fill values, skills, lifestyle and task-preference forms.',
    },
    {
      label: 'Three engines',
      description: 'Dedicated GPT-4o-mini routes run Vision, Ikigai and task-match with their own token budgets.',
    },
    {
      label: 'Validated JSON',
      description: 'Schema checks and markdown stripping happen before render. A failed parse does not crash the UI.',
    },
    {
      label: 'Save and compare',
      description: 'Results land in Supabase so a student can reopen a previous run.',
    },
  ],
  'caps-kengeri': [
    {
      label: 'Public site',
      description: 'Events, team and club pages ship with JSON-LD and a sitemap.',
    },
    {
      label: 'Three-tier publish',
      description: 'Editors draft, moderators review, admins publish.',
    },
    {
      label: 'Blocked words',
      description: 'Unsafe copy is flagged or rejected before it reaches the live site.',
    },
  ],
  recalibrate: [
    {
      label: 'Ask',
      description: 'A student posts. Blocked words screen the body before it is visible.',
    },
    {
      label: 'Moderate and answer',
      description: 'Moderators approve. Specialists claim the thread and reply.',
    },
    {
      label: 'Oversee',
      description: 'Admins manage roles, word lists and audit visibility.',
    },
  ],
  battery: [
    {
      label: 'Collect at the edge',
      description: 'A Rust daemon reads voltage, current, temperature and cycle data on a fixed cadence.',
    },
    {
      label: 'Ship aggregates',
      description: 'Edge storage forwards batches to the cloud API.',
    },
    {
      label: 'Serve health',
      description: 'A Go REST service exposes dashboards, alerts and life estimates. Both sides run in Docker.',
    },
  ],
};

const MEDIA: Record<string, Omit<WorkMedia, 'mermaid' | 'steps'>> = {
  platform: {
    image: '/images/work/platform-page.png',
    gallery: [
      '/images/work/platform-page.png',
      '/images/work/platform-scroll.png',
      '/images/work/platform-hero.jpg',
    ],
    poster: '/images/work/platform-overview-poster.jpg',
    video: '/videos/work/platform-overview.mp4',
  },
  classstream: {
    image: '/images/work/classstream-hero.png',
    gallery: [
      '/images/work/classstream-hero.png',
      '/screenshots/classstream-login.jpg',
      '/images/work/classstream-page.png',
      '/images/work/classstream-asset-1.webp',
    ],
  },
  'caps-automation': {
    image: '/images/work/caps-automation-hero.png',
    gallery: [
      '/images/work/caps-automation-hero.png',
      '/images/work/caps-automation-page.png',
      '/images/work/caps-login.png',
    ],
  },
  'vision-you': {
    image: '/images/work/vision-you-hero.png',
    gallery: ['/images/work/vision-you-hero.png'],
  },
  'caps-kengeri': {
    image: '/images/work/caps-kengeri-hero.png',
    gallery: ['/images/work/caps-kengeri-hero.png', '/images/work/caps-kengeri-page.png'],
  },
  recalibrate: {
    image: '/screenshots/rf-filled.jpg',
    gallery: ['/screenshots/rf-filled.jpg'],
  },
};

function mermaidFromSteps(project: Project): string {
  const steps = project.architecture?.steps || [];
  if (!steps.length) return '';
  const nodes = steps.map((step, index) => {
    const label = step.label.replace(/[[\]()"\n]/g, ' ').slice(0, 72);
    return `  S${index}["${label}"]`;
  });
  const edges = steps.slice(1).map((_, index) => `  S${index} --> S${index + 1}`);
  return `flowchart LR\n${nodes.concat(edges).join('\n')}`;
}

export function workMedia(project: Project): WorkMedia {
  const key = keyFor(project);
  const media = MEDIA[key] || { gallery: [] };
  return {
    ...media,
    mermaid: DIAGRAMS[key] || mermaidFromSteps(project),
    steps: STEPS[key] || project.architecture?.steps || [],
  };
}
