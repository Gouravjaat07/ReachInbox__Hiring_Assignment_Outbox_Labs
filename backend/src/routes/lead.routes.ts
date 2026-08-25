import { Router } from 'express';
import { parseLeads } from '../controllers/lead.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';

export const leadRouter = Router();

leadRouter.post('/parse', requireAuth, upload.single('file'), parseLeads);
