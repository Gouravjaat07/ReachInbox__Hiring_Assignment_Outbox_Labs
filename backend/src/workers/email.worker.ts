import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { env } from '../config/env.js';
import { closeRedisClient, createBullRedisClient } from '../config/redis.js';
import { EMAIL_QUEUE_NAME } from '../queues/queue.constants.js';
import { claimEmailForProcessing, finalizeFailedEmail, finalizeSentEmail } from '../services/idempotency.service.js';
import { reserveSendWindow } from '../services/rate-limit.service.js';
import { isRetryableSmtpError, sendEmailMail, smtpErrorDetails, verifyMailTransport } from '../services/mail.service.js';
import { emailRepository } from '../repositories/email.repository.js';
import { emailQueue, deterministicEmailJobId } from '../queues/email.queue.js';
import { logger } from '../utils/logger.js';

const workerRedisByWorker = new WeakMap<Worker, ReturnType<typeof createBullRedisClient>>();

async function rescheduleEmail(emailId: string, scheduledAt: Date) {
  const nextJobId = `${deterministicEmailJobId(emailId)}-rescheduled-${scheduledAt.getTime()}`;
  const job = await emailQueue.add('send-email', { emailId }, { jobId: nextJobId, delay: Math.max(0, scheduledAt.getTime() - Date.now()) });
  await emailRepository.reschedule(emailId, scheduledAt, job.id as string);
}

async function processEmailJob(job: Job<{ emailId: string }>) {
  logger.info({ jobId: job.id, emailId: job.data.emailId, attempt: job.attemptsMade + 1 }, 'Processing email job');
  const email = await claimEmailForProcessing(job.data.emailId);
  if (!email) {
    logger.info({ jobId: job.id, emailId: job.data.emailId }, 'Email is no longer eligible for processing');
    return;
  }

  try {
    const currentTime = new Date();
    const window = await reserveSendWindow(
      email.senderId,
      email.campaign.hourlyLimit,
      env.MIN_DELAY_BETWEEN_EMAILS_MS,
      currentTime,
    );

    if (!window.allowed) {
      const scheduledAt = window.availableAt;
      await rescheduleEmail(email.id, scheduledAt);
      logger.info({ jobId: job.id, emailId: email.id, scheduledAt }, 'Email rescheduled due to rate limiting');
      return;
    }

    const fromAddress = `${email.sender.name} <${email.sender.email}>`;
    const delivery = await sendEmailMail({
      emailId: email.id,
      attempt: job.attemptsMade + 1,
      from: fromAddress,
      to: email.recipient,
      subject: email.subject,
      text: email.body,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">${email.body.replace(/\n/g, '<br/>')}</div>`,
    });
    await finalizeSentEmail(email.id, delivery.previewUrl);
    logger.info({ jobId: job.id, emailId: email.id, status: 'SENT' }, 'Email marked as sent');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SMTP failure';
    const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined;
    const attempts = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;

    if (!isRetryableSmtpError(error) || attempts >= maxAttempts) {
      await finalizeFailedEmail(email.id, message);
      logger.error({ jobId: job.id, emailId: email.id, error: message, errorCode, status: 'FAILED' }, 'Email failed permanently');
      return;
    }

    // BullMQ retries the same job. Releasing the database claim makes the next
    // attempt eligible while retaining bullJobId, so reconciliation cannot add a duplicate.
    await emailRepository.releaseForRetry(email.id);
    logger.warn({ jobId: job.id, emailId: email.id, error: message, errorCode, nextAttempt: attempts + 1 }, 'Email returned to retryable state');
    throw error;
  }
}

export async function startEmailWorker() {
  logger.info({ queue: EMAIL_QUEUE_NAME, concurrency: env.WORKER_CONCURRENCY }, 'Email worker starting');

  const workerRedisConnection = createBullRedisClient('worker');

  const worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: workerRedisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  });

  workerRedisByWorker.set(worker, workerRedisConnection);

  worker.on('error', (error) => {
    logger.error({ error, queue: EMAIL_QUEUE_NAME }, 'Email worker Redis or processor error');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Worker completed email job');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, emailId: job?.data.emailId, error }, 'Email job failed');
  });

  try {
    await worker.waitUntilReady();
  } catch (error) {
    logger.fatal({ error, dependency: 'redis/bullmq', queue: EMAIL_QUEUE_NAME }, 'BullMQ worker failed to initialize');
    await worker.close().catch((closeError: unknown) => {
      logger.error({ error: closeError }, 'Failed to close BullMQ worker after startup error');
    });
    await closeRedisClient(workerRedisConnection);
    throw error;
  }

  logger.info({ queue: EMAIL_QUEUE_NAME }, 'Redis connection established');
  logger.info({ queue: EMAIL_QUEUE_NAME, concurrency: env.WORKER_CONCURRENCY }, 'Email worker ready');

  // SMTP availability must not determine web-service availability. This check
  // is advisory; sendMail still performs the real connection and BullMQ retries
  // any transient failure using the existing PROCESSING -> SCHEDULED release.
  void verifyMailTransport().catch((error: unknown) => {
    const details = smtpErrorDetails(error);
    logger.warn({
      dependency: 'smtp',
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      code: details.code,
      responseCode: details.responseCode,
      command: details.command,
      message: details.message,
      response: details.response,
      phase: details.command === 'CONN' || ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'EPIPE', 'ESOCKET'].includes(details.code ?? '')
        ? 'connection'
        : details.code === 'EAUTH' || details.responseCode === 535
          ? 'authentication'
          : details.responseCode !== undefined
            ? 'smtp'
            : 'unknown',
    }, 'SMTP connection unavailable; will retry when sending');
  });

  return worker;
}

export async function closeEmailWorker(worker: Worker) {
  await worker.close();
  const redisConnection = workerRedisByWorker.get(worker);
  if (redisConnection) {
    workerRedisByWorker.delete(worker);
    await closeRedisClient(redisConnection);
  }
}
