import multer from 'multer';
import { env } from '../config/env.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024,
  },
});
