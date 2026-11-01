export const quotationRef = (quote: { _id?: string }) =>
  `PM-${String(quote?._id || '').slice(-6).toUpperCase()}`;

export type Milestone = {
  label: string;
  percent: number;
  timing?: 'before' | 'after';
  amountPaise: number;
  paidPaise?: number;
  remainingPaise?: number;
  payablePaise?: number;
  collectionPaise?: number;
  orderId?: string;
  collections?: { amountPaise: number; reason: string; at: string }[];
  payments?: { orderId: string; paymentId: string; amountPaise: number; at: string }[];
  evidence?: string;
  feedback?: string;
  releasedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  paymentId?: string;
};

export type Quotation = {
  _id: string;
  __v: number;
  title: string;
  clientName: string;
  clientEmail: string;
  seller: string;
  builder?: any;
  draftEditor?: any;
  draftReady?: boolean;
  draftValidation?: string;
  srs?: { fileId: string; name: string; size: number; sha256: string }[];
  scope: string;
  exclusions: string;
  timeline: string;
  terms: string;
  totalPaise: number;
  minimumOnboardingPaise?: number;
  validUntil: string;
  revision: number;
  status: string;
  digest: string;
  paymentsEnabled: boolean;
  milestones: Milestone[];
  acceptance?: { name: string; email: string; at: string; digest: string };
  deployedAt?: string;
  supportEndsAt?: string;
};
