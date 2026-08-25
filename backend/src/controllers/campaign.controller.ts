import type { Request, Response } from 'express';
import { z } from 'zod';
import { campaignRepository } from '../repositories/campaign.repository.js';
import { sendError, sendSuccess } from '../utils/response.js';

const campaignDraftSchema = z.object({
  subject: z.string().min(1).max(255),
  body: z.string().min(1),
  startTime: z.string().datetime(),
  delayMs: z.number().int().positive(),
  hourlyLimit: z.number().int().positive(),
});

export async function createCampaign(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const parsed = campaignDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid campaign data', 400);
  }

  const campaign = await campaignRepository.create(req.user.id, {
    ...parsed.data,
    startTime: new Date(parsed.data.startTime),
    status: 'DRAFT',
  });

  return sendSuccess(res, campaign, 201);
}

export async function listCampaigns(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const campaigns = await campaignRepository.listByUser(req.user.id);
  return sendSuccess(res, campaigns);
}

export async function getCampaign(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const campaignId = typeof req.params.id === 'string' ? req.params.id : '';
  const campaign = await campaignRepository.findByIdForUser(campaignId, req.user.id);
  if (!campaign) {
    return sendError(res, 'NOT_FOUND', 'Campaign not found', 404);
  }

  return sendSuccess(res, campaign);
}
