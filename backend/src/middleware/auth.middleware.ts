import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.signedCookies?.auth_token;
    if (!token) {
      logger.info({ path: req.path, authCookiePresent: false }, 'Authentication rejected: signed auth cookie is missing');
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      logger.info({ path: req.path, userFound: false }, 'Authentication rejected: session user no longer exists');
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    req.user = user;
    return next();
  } catch {
    logger.info({ path: req.path, authCookiePresent: true }, 'Authentication rejected: auth cookie could not be verified');
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }
}
