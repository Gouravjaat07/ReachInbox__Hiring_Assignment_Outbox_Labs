import { Router } from 'express';
import { getEmail, listFailedEmails, listScheduledEmails, listSentEmails, scheduleEmails } from '../controllers/email.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const emailRouter = Router();

emailRouter.post('/schedule', requireAuth, scheduleEmails);
emailRouter.get('/scheduled', requireAuth, listScheduledEmails);
emailRouter.get('/sent', requireAuth, listSentEmails);
emailRouter.get('/failed', requireAuth, listFailedEmails);
emailRouter.get('/:id', requireAuth, getEmail);
