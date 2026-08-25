import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { reconcilePendingEmails } from './services/scheduling.service.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Backend listening');
});

reconcilePendingEmails().catch((error) => {
  logger.error({ error }, 'Failed to reconcile pending email jobs');
});
