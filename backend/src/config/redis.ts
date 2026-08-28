import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { env } from './env.js';

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
  disconnect(): Promise<void>;
}

const RedisClient = Redis as unknown as new (options: RedisOptions) => RedisClientShape;

function buildRedisOptions(includeLazyConnect: boolean): RedisOptions {
  const baseOptions: RedisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };

  if (env.REDIS_PASSWORD) {
    baseOptions.password = env.REDIS_PASSWORD;
  }

  if (includeLazyConnect) {
    baseOptions.lazyConnect = true;
  }

  return baseOptions;
}

export const redisConnection = new RedisClient(buildRedisOptions(true));

export const redis = redisConnection;

export function createBullConnection() {
  return buildRedisOptions(false);
}
