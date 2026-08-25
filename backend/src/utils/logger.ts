import pino from 'pino';
import { isProduction } from '../config/env.js';

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'SMTP_PASSWORD',
      'GOOGLE_CLIENT_SECRET',
      'JWT_SECRET',
      'COOKIE_SECRET',
    ],
    remove: true,
  },
});
