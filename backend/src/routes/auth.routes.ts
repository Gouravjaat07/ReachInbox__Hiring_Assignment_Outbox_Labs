import { Router } from 'express';
import { googleCallback, googleLogin, logout, me } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { GOOGLE_CALLBACK_ROUTE, GOOGLE_LOGIN_ROUTE } from '../config/auth.js';

export const authRouter = Router();

authRouter.get(GOOGLE_LOGIN_ROUTE, googleLogin);
authRouter.get(GOOGLE_CALLBACK_ROUTE, googleCallback);
authRouter.get('/me', requireAuth, me);
authRouter.post('/logout', requireAuth, logout);
