import { Router } from 'express';
import { googleCallback, googleLogin, logout, me } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.get('/google', googleLogin);
authRouter.get('/google/callback', googleCallback);
authRouter.get('/me', requireAuth, me);
authRouter.post('/logout', requireAuth, logout);
