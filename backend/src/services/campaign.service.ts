import type { User } from '@prisma/client';
import { campaignRepository } from '../repositories/campaign.repository.js';

export async function listCampaigns(user: User) {
  return campaignRepository.listByUser(user.id);
}

export async function getCampaign(user: User, campaignId: string) {
  return campaignRepository.findByIdForUser(campaignId, user.id);
}
