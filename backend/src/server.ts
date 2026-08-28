import type { Server } from 'node:http';
import type { Worker } from 'bullmq';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { redisConnection } from './config/redis.js';
import { emailQueue } from './queues/email.queue.js';
import { logger } from './utils/logger.js';
import { reconcilePendingEmails } from './services/scheduling.service.js';
import { startEmailWorker } from './workers/email.worker.js';

const app = createApp();

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function startServer() {
  logger.info({ port: env.PORT }, 'API server starting');

  const resources: { server?: Server; worker?: Worker } = {};
  let shutdownPromise: Promise<void> | undefined;
  let workerRetryTimer: NodeJS.Timeout | undefined;
  let reconciliationTimer: NodeJS.Timeout | undefined;

  const shutdown = (signal: string) => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      logger.info({ signal }, 'API and email worker shutting down');

      const results = await Promise.allSettled([
        resources.server ? closeServer(resources.server) : Promise.resolve(),
        resources.worker ? resources.worker.close() : Promise.resolve(),
        emailQueue.close(),
        redisConnection.disconnect(),
        prisma.$disconnect(),
      ]);
      if (workerRetryTimer) clearInterval(workerRetryTimer);
      if (reconciliationTimer) clearInterval(reconciliationTimer);

      const rejected = results.filter((result) => result.status === 'rejected');
      if (rejected.length > 0) {
        logger.error({ rejected: rejected.length }, 'Shutdown completed with errors');
        process.exitCode = 1;
      } else {
        logger.info('API and email worker shut down cleanly');
      }
    })();
    return shutdownPromise;
  };

  // Register before awaiting SMTP/Redis startup so the hosting platform can terminate a
  // deploying instance cleanly even while a dependency is still connecting.
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  // This is intentionally created once in the API process. It consumes the same
  // Redis-backed queue used by scheduling requests and remains alive with Express.
  resources.server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Backend listening');
  });

  const startWorkerWithRetry = async () => {
    if (resources.worker) return;
    try {
      resources.worker = await startEmailWorker();
      workerRetryTimer = undefined;
    } catch (error) {
      logger.error({ error, dependency: 'redis/bullmq' }, 'Email worker unavailable; API remains available and worker will retry');
      if (!workerRetryTimer) {
        workerRetryTimer = setInterval(() => void startWorkerWithRetry(), 30_000);
      }
      return;
    }

    try {
      await reconcilePendingEmails();
    } catch (error) {
      logger.error({ error }, 'Failed to reconcile pending email jobs');
    }
    if (!reconciliationTimer) {
      reconciliationTimer = setInterval(() => {
        reconcilePendingEmails().catch((error) => {
          logger.error({ error }, 'Failed to reconcile pending email jobs');
        });
      }, 30_000);
    }
  };

  await startWorkerWithRetry();
}

startServer().catch((error) => {
  logger.fatal({ error }, 'API and email worker failed during startup');
  process.exit(1);
});
