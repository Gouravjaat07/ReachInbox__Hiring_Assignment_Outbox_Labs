import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import {
  authenticateGoogleProfile,
  buildGoogleAuthUrl,
  createOAuthState,
  exchangeCodeForGoogleProfile,
  signAuthToken,
} from '../services/auth.service.js';
import { logger } from '../utils/logger.js';
import { sendError, sendSuccess } from '../utils/response.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  // The Vercel UI calls the production API from a different site.
  // Cross-site credentialed API requests require `SameSite=None; Secure`.
  sameSite: env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
  path: '/',
};

export async function googleLogin(req: Request, res: Response) {
  const state = createOAuthState();

  res.cookie('oauth_state', state, {
    ...cookieOptions,
    signed: true,
    maxAge: 10 * 60 * 1000,
  });

  return res.redirect(buildGoogleAuthUrl(state));
}

export async function googleCallback(req: Request, res: Response) {
  const { code, state } = req.query as Record<string, string | undefined>;
  const stateCookie = req.signedCookies?.oauth_state;

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return sendError(res, 'AUTH_INVALID_STATE', 'Invalid OAuth state', 401);
  }

  try {
    const profile = await exchangeCodeForGoogleProfile(code);
    const user = await authenticateGoogleProfile(profile);
    const token = signAuthToken(user.id);

    res.clearCookie('oauth_state', cookieOptions);

    res.cookie('auth_token', token, {
      ...cookieOptions,
      signed: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Authentication failed';

    if (
      message.includes("Can't reach database server") ||
      message.includes('ECONNREFUSED')
    ) {
      logger.error(
        { error },
        'Google authentication unavailable because the database cannot be reached',
      );

      return sendError(
        res,
        'AUTH_SERVICE_UNAVAILABLE',
        'Authentication is temporarily unavailable. Start PostgreSQL and try again.',
        503,
      );
    }

    return sendError(res, 'AUTH_FAILED', message, 401);
  }
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  return sendSuccess(res, req.user);
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('auth_token', cookieOptions);
  res.clearCookie('oauth_state', cookieOptions);

  return sendSuccess(res, { loggedOut: true });
}