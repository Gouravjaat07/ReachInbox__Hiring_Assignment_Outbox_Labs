import type { Request, Response } from 'express';
import { z } from 'zod';
import { senderRepository } from '../repositories/sender.repository.js';
import { sendError, sendSuccess } from '../utils/response.js';

const senderSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
});

export async function listSenders(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }
  const senders = await senderRepository.listByUser(req.user.id);
  return sendSuccess(res, senders);
}

export async function createSender(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const parsed = senderSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid sender data', 400);
  }

  const sender = await senderRepository.create(req.user.id, parsed.data.email.toLowerCase(), parsed.data.name);
  return sendSuccess(res, sender, 201);
}
