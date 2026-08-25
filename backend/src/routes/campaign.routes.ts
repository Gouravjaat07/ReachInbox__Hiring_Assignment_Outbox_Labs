import { Router } from 'express';
import { createCampaign, getCampaign, listCampaigns } from '../controllers/campaign.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const campaignRouter = Router();

campaignRouter.post('/', requireAuth, createCampaign);
campaignRouter.get('/', requireAuth, listCampaigns);
campaignRouter.get('/:id', requireAuth, getCampaign);
