import crypto from 'node:crypto';
import type { Redis as RedisInstance, RedisOptions } from 'ioredis';
import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

type RedisLifecycleState = 'connecting' | 'ready' | 'reconnecting' | 'closed';

type RedisRuntimeConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tlsEnabled: boolean;
};

type RedisClient = RedisInstance;

const RedisClientConstructor = Redis as unknown as new (options: RedisOptions) => RedisClient;

const redisStateByClient = new WeakMap<RedisClient, RedisLifecycleState>();

function parseRedisUrl(value: string): RedisRuntimeConfig {
  const url = new URL(value);
  const tlsEnabled = url.protocol === 'rediss:';

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use redis:// or rediss://');
  }

  if (!url.hostname) {
    throw new Error('REDIS_URL must include a hostname');
  }

  const port = Number(url.port || (tlsEnabled ? '6379' : '6379'));
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('REDIS_URL port is invalid');
  }

  const rawPath = url.pathname.replace(/^\//, '');
  const parsedDb = rawPath ? Number(rawPath) : undefined;
  if (rawPath && (parsedDb === undefined || !Number.isInteger(parsedDb) || parsedDb < 0)) {
    throw new Error('REDIS_URL database index is invalid');
  }

  const config: RedisRuntimeConfig = {
    host: url.hostname,
    port,
    tlsEnabled,
  };

  if (url.username) {
    config.username = decodeURIComponent(url.username);
  }
  if (url.password) {
    config.password = decodeURIComponent(url.password);
  }
  if (parsedDb !== undefined) {
    config.db = parsedDb;
  }

  return config;
}

function resolveRedisConfig(): RedisRuntimeConfig {
  if (env.REDIS_HOST) {
    const config: RedisRuntimeConfig = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT ?? 6379,
      tlsEnabled: env.NODE_ENV === 'production',
    };
    if (env.REDIS_PASSWORD) {
      config.password = env.REDIS_PASSWORD;
    }
    return config;
  }

  if (!env.REDIS_URL) {
    throw new Error('Redis configuration is missing');
  }

  const config = parseRedisUrl(env.REDIS_URL);
  if (env.NODE_ENV === 'production' && !config.tlsEnabled) {
    throw new Error('Production Redis must use TLS');
  }
  return config;
}

const redisRuntimeConfig = resolveRedisConfig();

function buildRedisOptions(input: {
  lazyConnect: boolean;
  maxRetriesPerRequest: number | null;
  role: string;
}): RedisOptions {
  const options: RedisOptions = {
    host: redisRuntimeConfig.host,
    port: redisRuntimeConfig.port,
    username: redisRuntimeConfig.username,
    password: redisRuntimeConfig.password,
    db: redisRuntimeConfig.db,
    lazyConnect: input.lazyConnect,
    maxRetriesPerRequest: input.maxRetriesPerRequest,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    keepAlive: 30_000,
    connectTimeout: 10_000,
    retryStrategy: (attempt) => Math.min(250 * attempt, 5_000),
    connectionName: `reachinbox-${input.role}`,
  };

  if (redisRuntimeConfig.tlsEnabled) {
    options.tls = {
      servername: redisRuntimeConfig.host,
    };
  }

  return options;
}

function registerRedisEvents(client: RedisClient, role: string) {
  redisStateByClient.set(client, 'connecting');

  client.on('connect', () => {
    redisStateByClient.set(client, 'connecting');
    logger.info({ dependency: 'redis', role, host: redisRuntimeConfig.host, port: redisRuntimeConfig.port, tlsEnabled: redisRuntimeConfig.tlsEnabled }, 'Redis connecting');
  });

  client.on('ready', () => {
    redisStateByClient.set(client, 'ready');
    logger.info({ dependency: 'redis', role, host: redisRuntimeConfig.host, port: redisRuntimeConfig.port, tlsEnabled: redisRuntimeConfig.tlsEnabled }, 'Redis ready');
  });

  client.on('reconnecting', (delay: number) => {
    redisStateByClient.set(client, 'reconnecting');
    logger.warn({ dependency: 'redis', role, delayMs: delay, host: redisRuntimeConfig.host, port: redisRuntimeConfig.port, tlsEnabled: redisRuntimeConfig.tlsEnabled }, 'Redis reconnecting');
  });

  client.on('close', () => {
    redisStateByClient.set(client, 'closed');
    logger.warn({ dependency: 'redis', role, host: redisRuntimeConfig.host, port: redisRuntimeConfig.port, tlsEnabled: redisRuntimeConfig.tlsEnabled }, 'Redis connection closed');
  });

  client.on('error', (error: unknown) => {
    logger.error({ dependency: 'redis', role, error, host: redisRuntimeConfig.host, port: redisRuntimeConfig.port, tlsEnabled: redisRuntimeConfig.tlsEnabled }, 'Redis connection error');
  });
}

function createRedisClient(input: {
  role: string;
  lazyConnect: boolean;
  maxRetriesPerRequest: number | null;
}) {
  const client = new RedisClientConstructor(buildRedisOptions(input));
  registerRedisEvents(client, input.role);
  return client;
}

export const redisConnection = createRedisClient({
  role: 'shared',
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

export const redis = redisConnection;

export function createBullRedisClient(role: 'queue' | 'worker') {
  return createRedisClient({
    role: `bullmq-${role}`,
    lazyConnect: false,
    maxRetriesPerRequest: null,
  });
}

export function getRedisConnectionSummary() {
  return {
    host: redisRuntimeConfig.host,
    port: redisRuntimeConfig.port,
    tlsEnabled: redisRuntimeConfig.tlsEnabled,
  };
}

export function getRedisClientState(client: RedisClient) {
  return redisStateByClient.get(client) ?? 'connecting';
}

export async function verifyRedisRoundTrip(client: RedisClient) {
  const key = `healthcheck:${crypto.randomUUID()}`;
  const value = crypto.randomBytes(12).toString('hex');

  await client.ping();
  await client.set(key, value, 'EX', 30);
  const retrieved = await client.get(key);
  await client.del(key);

  if (retrieved !== value) {
    throw new Error('Redis round-trip validation failed');
  }
}

export async function closeRedisClient(client: RedisClient) {
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}
