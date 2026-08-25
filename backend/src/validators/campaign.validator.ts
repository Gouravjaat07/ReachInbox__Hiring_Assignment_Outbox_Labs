import { z } from 'zod';

export const createCampaignSchema = z.object({
  subject: z.string().min(1).max(255),
  body: z.string().min(1),
  startTime: z.string().datetime(),
  delayMs: z.number().int().positive().max(24 * 60 * 60 * 1000),
  hourlyLimit: z.number().int().positive().max(10000),
  senderId: z.string().min(1),
  recipients: z.array(z.string().email()).min(1),
});
