import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { authRouter } from './routes/auth.routes.js';
import { campaignRouter } from './routes/campaign.routes.js';
import { emailRouter } from './routes/email.routes.js';
import { leadRouter } from './routes/lead.routes.js';
import { senderRouter } from './routes/sender.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }));
  app.use(express.json({ limit: `${env.UPLOAD_MAX_SIZE_MB}mb` }));
  app.use(express.urlencoded({ extended: true, limit: `${env.UPLOAD_MAX_SIZE_MB}mb` }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use((req, _res, next) => {
    logger.debug({ method: req.method, url: req.url }, 'Request received');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/senders', senderRouter);
  app.use('/api/campaigns', campaignRouter);
  app.use('/api/leads', leadRouter);
  app.use('/api/emails', emailRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
