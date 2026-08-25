import { Queue } from 'bullmq';
import { createBullConnection } from '../config/redis.js';
import { EMAIL_QUEUE_NAME } from './queue.constants.js';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 3,
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

export function deterministicEmailJobId(emailId: string) {
  return `email-${emailId}`;
}
