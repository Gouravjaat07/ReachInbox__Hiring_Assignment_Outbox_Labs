import { startEmailWorker } from './workers/email.worker.js';
import { prisma } from './config/database.js';
import { redisConnection } from './config/redis.js';
import { emailQueue } from './queues/email.queue.js';
import { logger } from './utils/logger.js';

logger.info('Worker process booting');
startEmailWorker().then((worker) => {
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Email worker shutting down');
    await Promise.allSettled([worker.close(), emailQueue.close(), redisConnection.disconnect(), prisma.$disconnect()]);
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}).catch((error) => {
  logger.fatal({ error }, 'Email worker failed during startup');
  process.exit(1);
});
