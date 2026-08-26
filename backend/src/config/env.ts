import dotenv from 'dotenv';
import { z } from 'zod';

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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_URL: frontendUrlSchema,
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
