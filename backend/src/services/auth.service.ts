import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';

const googleTokenEndpoint = 'https://oauth2.googleapis.com/token';
const googleUserInfoEndpoint = 'https://www.googleapis.com/oauth2/v2/userinfo';

export function buildGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function createOAuthState() {
  return crypto.randomBytes(24).toString('hex');
}

export async function exchangeCodeForGoogleProfile(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    grant_type: 'authorization_code',
  });

  const tokenResponse = await fetch(googleTokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange Google authorization code');
  }

  const tokenJson = await tokenResponse.json() as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error('Google access token was not returned');
  }

  const userInfoResponse = await fetch(googleUserInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    throw new Error('Failed to fetch Google profile');
  }

  const profile = await userInfoResponse.json() as {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };

  if (!profile.id || !profile.email) {
    throw new Error('Google profile is incomplete');
  }

  return profile;
}

export async function authenticateGoogleProfile(profile: { id: string; email: string; name: string; picture?: string }) {
  return userRepository.upsertGoogleUser({
    googleId: profile.id,
    email: profile.email,
    name: profile.name,
    avatar: profile.picture ?? null,
  });
}

export function signAuthToken(userId: string) {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });
}
