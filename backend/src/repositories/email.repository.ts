import { prisma } from '../config/database.js';
import type { EmailStatus } from '@prisma/client';

export const emailRepository = {
  createMany(data: Array<{
    campaignId: string;
    senderId: string;
    recipient: string;
    subject: string;
    body: string;
    scheduledAt: Date;
    idempotencyKey: string;
  }>) {
    return prisma.email.createMany({ data });
  },
  create(data: {
    campaignId: string;
    senderId: string;
    recipient: string;
    subject: string;
    body: string;
    scheduledAt: Date;
    idempotencyKey: string;
  }) {
    return prisma.email.create({ data });
  },
  findById(id: string) {
    return prisma.email.findUnique({
      where: { id },
      include: {
        campaign: true,
        sender: true,
      },
    });
  },
  findByIdForUser(id: string, userId: string) {
    return prisma.email.findFirst({
      where: { id, campaign: { userId } },
      include: {
        campaign: true,
        sender: true,
      },
    });
  },
  listByUserAndStatus(userId: string, status: EmailStatus) {
    return prisma.email.findMany({
      where: { status, campaign: { userId } },
      orderBy: { scheduledAt: 'asc' },
      include: {
        sender: true,
        campaign: true,
      },
    });
  },
  listByUserAndStatuses(userId: string, statuses: EmailStatus[]) {
    return prisma.email.findMany({
      where: { status: { in: statuses }, campaign: { userId } },
      orderBy: { scheduledAt: 'asc' },
      include: { sender: true, campaign: true },
    });
  },
  listPendingWithoutJob(limit = 200) {
    return prisma.email.findMany({
      where: {
        status: 'SCHEDULED',
        bullJobId: null,
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      include: {
        sender: true,
        campaign: true,
      },
    });
  },
  recoverStaleProcessing(cutoff: Date, maxAttempts: number) {
    return prisma.$transaction([
      prisma.email.updateMany({
        where: { status: 'PROCESSING', processingStartedAt: { lt: cutoff }, attempts: { lt: maxAttempts } },
        data: { status: 'SCHEDULED', bullJobId: null, processingStartedAt: null },
      }),
      prisma.email.updateMany({
        where: { status: 'PROCESSING', processingStartedAt: { lt: cutoff }, attempts: { gte: maxAttempts } },
        data: { status: 'FAILED', failedAt: new Date(), errorMessage: 'Worker claim expired after maximum attempts' },
      }),
    ]);
  },
  updateBullJobId(id: string, bullJobId: string) {
    return prisma.email.update({ where: { id }, data: { bullJobId } });
  },
  markProcessing(id: string) {
    return prisma.email.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: { status: 'PROCESSING', processingStartedAt: new Date(), attempts: { increment: 1 } },
    });
  },
  markSent(id: string, sentAt: Date) {
    return prisma.email.update({
      where: { id },
      data: { status: 'SENT', sentAt, failedAt: null, errorMessage: null },
    });
  },
  markFailed(id: string, errorMessage: string) {
    return prisma.email.update({
      where: { id },
      data: { status: 'FAILED', failedAt: new Date(), errorMessage },
    });
  },
  releaseForRetry(id: string) {
    return prisma.email.updateMany({
      where: { id, status: 'PROCESSING' },
      data: {
        status: 'SCHEDULED',
        processingStartedAt: null,
      },
    });
  },
  reschedule(id: string, scheduledAt: Date, bullJobId?: string) {
    return prisma.email.update({
      where: { id },
      data: {
        status: 'SCHEDULED',
        scheduledAt,
        bullJobId: bullJobId ?? null,
        processingStartedAt: null,
        errorMessage: null,
      },
    });
  },
  updateScheduledTime(id: string, scheduledAt: Date) {
    return prisma.email.update({ where: { id }, data: { scheduledAt } });
  },
  getDashboardCounts(userId: string) {
    return prisma.email.groupBy({
      by: ['status'],
      where: { campaign: { userId } },
      _count: { status: true },
    });
  },
};
