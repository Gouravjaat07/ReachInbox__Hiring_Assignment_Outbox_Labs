import { CampaignStatus, type User } from '@prisma/client';
import { prisma } from '../config/database.js';
import { emailRepository } from '../repositories/email.repository.js';
import { senderRepository } from '../repositories/sender.repository.js';
import { emailQueue, deterministicEmailJobId } from '../queues/email.queue.js';
import { addMilliseconds } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export type ScheduleInput = {
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  senderId: string;
  recipients: string[];
  campaignName?: string | undefined;
};

export async function scheduleCampaignEmails(user: User, input: ScheduleInput) {
  const sender = await senderRepository.findByIdForUser(input.senderId, user.id);
  if (!sender) {
    throw new Error('Sender not found for authenticated user');
  }

  const normalizedRecipients = Array.from(new Set(input.recipients.map((recipient) => recipient.trim().toLowerCase())));
  const startTime = new Date(input.startTime);
  if (Number.isNaN(startTime.getTime())) {
    throw new Error('Invalid start time');
  }

  const campaign = await prisma.$transaction(async (tx) => {
    const createdCampaign = await tx.campaign.create({
      data: {
        userId: user.id,
        subject: input.subject,
        body: input.body,
        startTime,
        delayMs: input.delayMs,
        hourlyLimit: input.hourlyLimit,
        status: CampaignStatus.SCHEDULED,
      },
    });

    const emails = normalizedRecipients.map((recipient, index) => ({
      campaignId: createdCampaign.id,
      senderId: sender.id,
      recipient,
      subject: input.subject,
      body: input.body,
      scheduledAt: addMilliseconds(startTime, index * input.delayMs),
      idempotencyKey: `${createdCampaign.id}:${recipient}`,
    }));

    for (const email of emails) {
      await tx.email.create({ data: email });
    }

    return createdCampaign;
  });

  const createdEmails = await prisma.email.findMany({
    where: { campaignId: campaign.id },
    orderBy: { scheduledAt: 'asc' },
  });

  const enqueueResults = await Promise.allSettled(
    createdEmails.map(async (email) => {
      const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
      const job = await emailQueue.add(
        'send-email',
        { emailId: email.id },
        {
          jobId: deterministicEmailJobId(email.id),
          delay,
        },
      );
      await emailRepository.updateBullJobId(email.id, job.id as string);
      logger.info({ campaignId: campaign.id, emailId: email.id, senderId: email.senderId, jobId: job.id, scheduledAt: email.scheduledAt }, 'Email scheduled and BullMQ job created');
      return job.id;
    }),
  );

  const failedEnqueues = enqueueResults.filter((result) => result.status === 'rejected').length;
  if (failedEnqueues > 0) {
    logger.warn({ failedEnqueues, campaignId: campaign.id }, 'Some jobs failed to enqueue and will be reconciled later');
  }

  return {
    campaignId: campaign.id,
    scheduledCount: createdEmails.length,
    failedEnqueues,
  };
}

export async function reconcilePendingEmails() {
  const staleCutoff = new Date(Date.now() - env.PROCESSING_TIMEOUT_MS);
  const [released, failed] = await emailRepository.recoverStaleProcessing(staleCutoff, env.MAX_EMAIL_ATTEMPTS);
  if (released.count > 0 || failed.count > 0) {
    logger.warn({ released: released.count, failed: failed.count, staleCutoff }, 'Recovered stale processing email claims');
  }

  const pending = await emailRepository.listPendingWithoutJob(200);
  for (const email of pending) {
    const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
    try {
      const job = await emailQueue.add(
        'send-email',
        { emailId: email.id },
        { jobId: deterministicEmailJobId(email.id), delay },
      );
      await emailRepository.updateBullJobId(email.id, job.id as string);
    } catch (error) {
      logger.error({ error, emailId: email.id }, 'Failed to reconcile pending email job');
    }
  }
}
