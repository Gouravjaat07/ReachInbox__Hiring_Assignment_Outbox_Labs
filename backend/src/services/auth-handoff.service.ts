import crypto from 'node:crypto';
import { redis } from '../config/redis.js';

const HANDOFF_TTL_SECONDS = 60;
const HANDOFF_KEY_PREFIX = 'auth-handoff:';

function handoffKey(code: string) {
  return `${HANDOFF_KEY_PREFIX}${code}`;
}

export async function createAuthHandoff(userId: string) {
  const code = crypto.randomBytes(32).toString('hex');
  await redis.set(handoffKey(code), userId, 'EX', HANDOFF_TTL_SECONDS);
  return code;
}

export async function consumeAuthHandoff(code: string) {
  const result = await redis.eval(
    "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value;",
    1,
    handoffKey(code),
  );

  return typeof result === 'string' ? result : null;
}
