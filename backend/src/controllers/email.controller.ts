import type { Request, Response } from 'express';
import { emailRepository } from '../repositories/email.repository.js';
import { scheduleCampaignEmails } from '../services/scheduling.service.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { scheduleEmailsSchema } from '../validators/email.validator.js';

export async function scheduleEmails(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const parsed = scheduleEmailsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid schedule request', 400);
  }

  const summary = await scheduleCampaignEmails(req.user, parsed.data);
  return sendSuccess(res, summary, 201);
}

export async function listScheduledEmails(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const emails = await emailRepository.listByUserAndStatuses(req.user.id, ['SCHEDULED', 'PROCESSING']);
  return sendSuccess(res, emails);
}

export async function listSentEmails(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const emails = await emailRepository.listByUserAndStatus(req.user.id, 'SENT');
  return sendSuccess(res, emails);
}

export async function listFailedEmails(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const emails = await emailRepository.listByUserAndStatus(req.user.id, 'FAILED');
  return sendSuccess(res, emails);
}

export async function getEmail(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const emailId = typeof req.params.id === 'string' ? req.params.id : '';
  const email = await emailRepository.findByIdForUser(emailId, req.user.id);
  if (!email) {
    return sendError(res, 'NOT_FOUND', 'Email not found', 404);
  }

  return sendSuccess(res, email);
}
