import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { createBullConnection } from '../config/redis.js';
import { EMAIL_QUEUE_NAME } from './queue.constants.js';
import { logger } from '../utils/logger.js';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: env.MAX_EMAIL_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 60 * 60 * 24 * 7,
      count: 1000,
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 30,
    },
  },
});

emailQueue.on('error', (error) => {
  logger.error({ error, queue: EMAIL_QUEUE_NAME, dependency: 'redis' }, 'Email queue Redis error');
});

export function deterministicEmailJobId(emailId: string) {
  return `email-${emailId}`;
}
