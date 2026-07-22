export interface ArchitectureStep {
    icon?: string;
    label: string;
    description: string;
}

export interface TechDetail {
    title: string;
    description: string;
    category?: string;
    tags?: string[];
}

export interface Deployment {
    type: string;
    platform: string;
    url?: string;
    details: string;
    ciCd: string;
}

export interface Project {
    _id?: string;
    title: string;
    shortDescription: string;
    fullDescription: string;
    features: string[];
    tags: string[];
    imageUrl?: string;
    gallery?: string[];
    architecture?: {
        title: string;
        steps: ArchitectureStep[];
    };
    techDetails?: TechDetail[];
    deployment?: Deployment;
    link?: string;
    repo?: string;
    frontendRepo?: string;
    backendRepo?: string;
    category: 'Web' | 'Mobile' | 'DevOps' | 'Backend';
    source?: 'github' | 'gitlab' | 'manual';
    sourceUrl?: string;
    lastSyncedAt?: string;
    featured?: boolean;
    languageStats?: { name: string; percent: number; color: string }[];
    status?: {
        phase: 'Development' | 'Production' | 'Archived';
        since?: string;
        ciStatus?: 'Passing' | 'Failing' | 'Not Configured';
        deploymentType?: 'Vercel' | 'AWS' | 'Netlify' | 'Manual';
    };
    timeline?: {
        start: string;
        end?: string;
        history: { phase: string; date: string; completed: boolean; link?: string }[];
    };
}
