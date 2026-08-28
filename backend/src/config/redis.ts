import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

interface RedisMulti {
  incr(key: string): RedisMulti;
  expireat(key: string, timestamp: number): RedisMulti;
  exec(): Promise<unknown>;
}

interface RedisClientShape {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string>;
  multi(): RedisMulti;
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
  on(event: 'error' | 'reconnecting', listener: (error: unknown) => void): RedisClientShape;
  disconnect(): Promise<void>;
}

const RedisClient = Redis as unknown as new (options: RedisOptions) => RedisClientShape;

function buildRedisOptions(includeLazyConnect: boolean): RedisOptions {
  const baseOptions: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  };

  if (env.REDIS_URL) {
    const url = new URL(env.REDIS_URL);
    baseOptions.host = url.hostname;
    baseOptions.port = Number(url.port || '6379');
    baseOptions.tls = {};

    if (url.username) {
      baseOptions.username = decodeURIComponent(url.username);
    }
    if (url.password) {
      baseOptions.password = decodeURIComponent(url.password);
    }
  } else {
    // REDIS_URL is enforced in production. This fallback keeps intentional
    // local development configurations working without weakening production.
    baseOptions.host = env.REDIS_HOST;
    baseOptions.port = env.REDIS_PORT ?? 6379;
    if (env.REDIS_PASSWORD) {
      baseOptions.password = env.REDIS_PASSWORD;
    }
  }

  if (includeLazyConnect) {
    baseOptions.lazyConnect = true;
  }

  return baseOptions;
}

export const redisConnection = new RedisClient(buildRedisOptions(true));

redisConnection.on('error', (error) => {
  logger.warn({ error, dependency: 'redis' }, 'Redis connection error; reconnecting');
});

redisConnection.on('reconnecting', (attempt) => {
  logger.info({ attempt, dependency: 'redis' }, 'Redis reconnecting');
});

export const redis = redisConnection;

export function createBullConnection() {
  return buildRedisOptions(false);
}
