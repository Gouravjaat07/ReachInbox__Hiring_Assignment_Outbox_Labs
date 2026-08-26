import { startEmailWorker } from './workers/email.worker.js';
import { logger } from './utils/logger.js';

logger.info('Worker process booting');
startEmailWorker().catch((error) => {
  logger.fatal({ error }, 'Email worker failed during startup');
  process.exit(1);
});
