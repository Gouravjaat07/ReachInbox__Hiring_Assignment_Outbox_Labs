import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import {
  authenticateGoogleProfile,
  buildGoogleAuthUrl,
  createOAuthState,
  exchangeCodeForGoogleProfile,
  signAuthToken,
} from '../services/auth.service.js';
import { consumeAuthHandoff, createAuthHandoff } from '../services/auth-handoff.service.js';
import { logger } from '../utils/logger.js';
import { sendError, sendSuccess } from '../utils/response.js';

const directOAuthCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  // Google returns to Railway in a top-level navigation, so Lax protects the
  // CSRF-state cookie without permitting cross-site subresource requests.
  sameSite: 'lax' as const,
  path: '/',
};

// This response is delivered through Vercel's same-origin /api rewrite. The
// browser therefore stores the signed cookie for the frontend origin and sends
// it on later same-origin /api requests.
const proxiedSessionCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

function renderHandoffForm(action: string, code: string) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const actionOrigin = new URL(action).origin;

  return {
    contentSecurityPolicy: `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${actionOrigin}; base-uri 'none'`,
    html: `<!doctype html><html><head><meta charset="utf-8"><title>Signing in…</title></head><body><form id="session-handoff" method="post" action="${action}"><input type="hidden" name="code" value="${code}"></form><script nonce="${nonce}">document.getElementById('session-handoff').submit();</script><noscript><button form="session-handoff" type="submit">Continue</button></noscript></body></html>`,
  };
}

export async function googleLogin(req: Request, res: Response) {
  const state = createOAuthState();

  res.cookie('oauth_state', state, {
    ...directOAuthCookieOptions,
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
    const handoffCode = await createAuthHandoff(user.id);

    res.clearCookie('oauth_state', directOAuthCookieOptions);

    const handoffUrl = new URL('/api/auth/session/complete', env.FRONTEND_URL).toString();

    logger.info(
      {
        userId: user.id,
        handoff: 'created',
        redirectPath: '/api/auth/session/complete',
      },
      'Google OAuth completed and same-origin session handoff was created',
    );

    const handoffForm = renderHandoffForm(handoffUrl, handoffCode);
    res.set('Content-Security-Policy', handoffForm.contentSecurityPolicy);
    return res.status(200).type('html').send(handoffForm.html);
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

export async function completeSessionHandoff(req: Request, res: Response) {
  const code = typeof req.body?.code === 'string' ? req.body.code : undefined;
  if (!code) {
    return sendError(res, 'AUTH_INVALID_HANDOFF', 'Invalid authentication handoff', 401);
  }

  try {
    const userId = await consumeAuthHandoff(code);
    if (!userId) {
      return sendError(res, 'AUTH_INVALID_HANDOFF', 'Invalid or expired authentication handoff', 401);
    }

    const token = signAuthToken(userId);
    res.cookie('auth_token', token, {
      ...proxiedSessionCookieOptions,
      signed: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info(
      { userId, cookie: 'auth_token', secure: proxiedSessionCookieOptions.secure, sameSite: proxiedSessionCookieOptions.sameSite },
      'Same-origin authentication cookie was issued',
    );

    return res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    logger.error({ error }, 'Failed to complete authentication handoff');
    return sendError(res, 'AUTH_HANDOFF_FAILED', 'Authentication is temporarily unavailable', 503);
  }
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  return sendSuccess(res, req.user);
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('auth_token', proxiedSessionCookieOptions);
  res.clearCookie('oauth_state', directOAuthCookieOptions);

  return sendSuccess(res, { loggedOut: true });
}
