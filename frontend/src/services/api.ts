import axios from 'axios';
import type { ApiResponse, Campaign, Email, Sender, User } from '../types';
import { API_BASE_URL } from '../config/api';

export class ApiError extends Error {
  status?: number;
  apiCode?: string;

  constructor(message: string, status?: number, apiCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.apiCode = apiCode;
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>) {
  try {
    const response = await promise;
    if (!response.data.success) {
      throw new ApiError(response.data.error?.message ?? 'Request failed', 200, response.data.error?.code);
    }
    return response.data.data as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message ?? error.message;
      const apiCode = (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;
      throw new ApiError(message, error.response?.status, apiCode);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Request failed');
  }
}

export const authApi = {
  me: () => unwrap<User>(api.get('/auth/me')),
  completeHandoff: (code: string) => unwrap<{ completed: boolean }>(api.post('/auth/session/complete', { code })),
  logout: () => unwrap<{ loggedOut: boolean }>(api.post('/auth/logout')),
};

export const senderApi = {
  list: () => unwrap<Sender[]>(api.get('/senders')),
  create: (payload: { email: string; name: string }) => unwrap<Sender>(api.post('/senders', payload)),
};

export const campaignApi = {
  list: () => unwrap<Campaign[]>(api.get('/campaigns')),
  get: (id: string) => unwrap<Campaign>(api.get(`/campaigns/${id}`)),
  create: (payload: { subject: string; body: string; startTime: string; delayMs: number; hourlyLimit: number }) =>
    unwrap<Campaign>(api.post('/campaigns', payload)),
};

export const emailApi = {
  schedule: (payload: {
    subject: string;
    body: string;
    startTime: string;
    delayMs: number;
    hourlyLimit: number;
    senderId: string;
    recipients: string[];
  }) => unwrap<{ campaignId: string; scheduledCount: number; failedEnqueues: number }>(api.post('/emails/schedule', payload)),
  scheduled: () => unwrap<Email[]>(api.get('/emails/scheduled')),
  sent: () => unwrap<Email[]>(api.get('/emails/sent')),
  failed: () => unwrap<Email[]>(api.get('/emails/failed')),
  get: (id: string) => unwrap<Email>(api.get(`/emails/${id}`)),
  parseLeads: async (input: { text?: string; file?: File }) => {
    const formData = new FormData();
    if (input.text) formData.append('text', input.text);
    if (input.file) formData.append('file', input.file);
    return unwrap<{ emails: string[]; count: number; invalidCount: number; duplicatesRemoved: number }>(
      api.post('/leads/parse', formData),
    );
  },
};
