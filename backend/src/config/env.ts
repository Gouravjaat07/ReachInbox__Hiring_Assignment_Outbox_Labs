import dotenv from 'dotenv';
import { z } from 'zod';
import { GOOGLE_CALLBACK_PATH } from './auth.js';

dotenv.config();

const booleanFromEnv = z.enum(['true', 'false']).transform((value) => value === 'true');
const smtpFamilyFromEnv = z.enum(['4', '6']).transform((value) => Number(value) as 4 | 6);

const frontendUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'FRONTEND_URL must use http or https')
  // CORS compares the request Origin, which never contains a path or trailing slash.
  .transform((value) => new URL(value).origin);

const googleCallbackUrlSchema = z.string().url().superRefine((value, context) => {
  const url = new URL(value);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'GOOGLE_CALLBACK_URL must use http or https' });
  }

  if (url.pathname !== GOOGLE_CALLBACK_PATH || url.search || url.hash) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `GOOGLE_CALLBACK_URL must be the exact callback endpoint: ${GOOGLE_CALLBACK_PATH}`,
    });
  }
});

const redisUrlSchema = z.string().url().superRefine((value, context) => {
  const url = new URL(value);

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'REDIS_URL must use redis:// or rediss://',
    });
  }

  if (!url.hostname) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'REDIS_URL must include a hostname',
    });
  }

  if (url.hash || url.search) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'REDIS_URL must not include query parameters or fragments',
    });
  }
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_URL: frontendUrlSchema,
  DATABASE_URL: z.string().min(1),
  REDIS_URL: redisUrlSchema.optional(),
  REDIS_HOST: z.string().min(1).optional(),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_PASSWORD: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: googleCallbackUrlSchema,
  JWT_SECRET: z.string().min(16),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().email(),
  SMTP_SECURE: booleanFromEnv.optional(),
  SMTP_REQUIRE_TLS: booleanFromEnv.default('true'),
  SMTP_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  SMTP_GREETING_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  SMTP_SOCKET_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  SMTP_FAMILY: smtpFamilyFromEnv.optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MAX_EMAIL_ATTEMPTS: z.coerce.number().int().positive().default(3),
  PROCESSING_TIMEOUT_MS: z.coerce.number().int().positive().default(5 * 60_000),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().int().positive().default(200),
  COOKIE_SECRET: z.string().min(16),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().int().positive().default(5),
}).superRefine((value, context) => {
  if (!value.REDIS_URL && (!value.REDIS_HOST || !value.REDIS_PORT)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_HOST'],
      message: 'Set REDIS_URL or both REDIS_HOST and REDIS_PORT',
    });
  }

  if (value.NODE_ENV === 'production') {
    if (!value.REDIS_HOST || !value.REDIS_PORT || !value.REDIS_PASSWORD) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_HOST'],
        message: 'REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD are required in production',
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
