import { CampaignStatus } from '@prisma/client';
import { prisma } from '../config/database.js';

export const campaignRepository = {
  create(userId: string, data: { subject: string; body: string; startTime: Date; delayMs: number; hourlyLimit: number; status?: CampaignStatus }) {
    return prisma.campaign.create({
      data: {
        userId,
        subject: data.subject,
        body: data.body,
        startTime: data.startTime,
        delayMs: data.delayMs,
        hourlyLimit: data.hourlyLimit,
        ...(data.status ? { status: data.status } : {}),
      },
    });
  },
  listByUser(userId: string) {
    return prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        emails: {
          select: { id: true, status: true, recipient: true, scheduledAt: true, sentAt: true },
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });
  },
  findByIdForUser(id: string, userId: string) {
    return prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        emails: true,
      },
    });
  },
  updateStatus(id: string, status: CampaignStatus) {
    return prisma.campaign.update({ where: { id }, data: { status } });
  },
};
