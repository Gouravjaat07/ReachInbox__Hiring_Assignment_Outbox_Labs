import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { env } from '../config/env.js';
import { createBullConnection } from '../config/redis.js';
import { EMAIL_QUEUE_NAME } from '../queues/queue.constants.js';
import { claimEmailForProcessing, finalizeFailedEmail, finalizeSentEmail } from '../services/idempotency.service.js';
import { reserveSendWindow } from '../services/rate-limit.service.js';
import { sendEmailMail, verifyMailTransport } from '../services/mail.service.js';
import { emailRepository } from '../repositories/email.repository.js';
import { emailQueue, deterministicEmailJobId } from '../queues/email.queue.js';
import { logger } from '../utils/logger.js';

async function rescheduleEmail(emailId: string, scheduledAt: Date) {
  const nextJobId = `${deterministicEmailJobId(emailId)}-rescheduled-${scheduledAt.getTime()}`;
  const job = await emailQueue.add('send-email', { emailId }, { jobId: nextJobId, delay: Math.max(0, scheduledAt.getTime() - Date.now()) });
  await emailRepository.reschedule(emailId, scheduledAt, job.id as string);
}

async function processEmailJob(job: Job<{ emailId: string }>) {
  const email = await claimEmailForProcessing(job.data.emailId);
  if (!email) {
    logger.info({ emailId: job.data.emailId }, 'Email already handled by another worker');
    return;
  }

  if (email.status === 'SENT') {
    return;
  }

  const currentTime = new Date();
  const window = await reserveSendWindow(
    email.senderId,
    email.campaign.hourlyLimit,
    env.MIN_DELAY_BETWEEN_EMAILS_MS,
    currentTime,
  );

  if (!window.allowed) {
    const scheduledAt = window.availableAt;
    await emailRepository.reschedule(email.id, scheduledAt);
    await rescheduleEmail(email.id, scheduledAt);
    logger.info({ emailId: email.id, scheduledAt }, 'Email rescheduled due to rate limiting');
    return;
  }

  try {
    const fromAddress = `${email.sender.name} <${email.sender.email}>`;
    const delivery = await sendEmailMail({
      from: fromAddress,
      to: email.recipient,
      subject: email.subject,
      text: email.body,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">${email.body.replace(/\n/g, '<br/>')}</div>`,
    });
    await finalizeSentEmail(email.id, delivery.previewUrl);
    logger.info({ emailId: email.id, recipient: email.recipient, previewUrl: delivery.previewUrl }, 'Email marked as sent');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SMTP failure';
    const attempts = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;

    if (attempts >= maxAttempts) {
      await finalizeFailedEmail(email.id, message);
      logger.error({ emailId: email.id, error: message }, 'Email failed permanently');
      return;
    }

    logger.warn({ emailId: email.id, error: message }, 'Email send failed and will be retried');
    throw error;
  }
}

export async function startEmailWorker() {
  await verifyMailTransport();

  const worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: createBullConnection(),
    concurrency: env.WORKER_CONCURRENCY,
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Worker completed email job');
  });

  worker.on('failed', async (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Worker failed email job');
    if (job?.data?.emailId) {
      const email = await emailRepository.findById(job.data.emailId);
      if (email && email.status === 'PROCESSING' && job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await finalizeFailedEmail(email.id, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  });

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info({ concurrency: env.WORKER_CONCURRENCY }, 'Email worker started');
  return worker;
}
