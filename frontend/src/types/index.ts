export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

export type User = {
  id: string;
  googleId: string;
  name: string;
  email: string;
  avatar?: string | null;
};

export type Sender = {
  id: string;
  userId: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { emails: number };
};

export type Campaign = {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  status: 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  emails?: Email[];
};

export type Email = {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
  bullJobId?: string | null;
  idempotencyKey: string;
  attempts: number;
  sentAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  previewUrl?: string | null;
  processingStartedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: Sender;
  campaign?: Campaign;
};
