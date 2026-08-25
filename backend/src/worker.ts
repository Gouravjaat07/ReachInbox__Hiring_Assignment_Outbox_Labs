import { startEmailWorker } from './workers/email.worker.js';

startEmailWorker().catch((error) => {
  console.error('Failed to start worker', error);
  process.exit(1);
});
