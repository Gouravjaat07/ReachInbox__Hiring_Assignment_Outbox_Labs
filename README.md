# ReachInbox Email Scheduler

ReachInbox is a full-stack email job scheduler built with Express, React, Prisma, PostgreSQL, Redis, BullMQ, Nodemailer, and Google OAuth 2.0.

## Architecture

React frontend -> Express API -> PostgreSQL as the source of truth -> Redis/BullMQ for delayed jobs -> BullMQ worker -> Nodemailer -> Ethereal SMTP.

PostgreSQL stores users, senders, campaigns, and email state. BullMQ stores delayed jobs in Redis. The worker reads current state from PostgreSQL before sending, which gives strong practical duplicate protection.

## Key Features

- Real Google OAuth login with HTTP-only cookie sessions.
- Sender management and campaign persistence in PostgreSQL.
- CSV/TXT/pasted lead parsing with validation and deduplication.
- BullMQ delayed jobs for scheduling, not cron or timers.
- Redis-backed distributed rate limiting and minimum-delay enforcement.
- Nodemailer transport configured for Ethereal SMTP.
- Scheduled and sent email views in the frontend.
- Restart-safe reconciliation for jobs that were persisted but not yet enqueued.

## Prerequisites

- Node.js 22+
- Docker and Docker Compose
- A Google OAuth client configured to use the callback URL in `.env`
- Ethereal SMTP credentials in `.env`

## Environment

Copy `.env.example` to `.env` and keep the existing placeholders up to date with your local credentials. The local database URL must point at the Docker PostgreSQL service.

The compose file uses:

- PostgreSQL database: `reachinbox`
- PostgreSQL user: `reachinbox`
- PostgreSQL password: `reachinbox_dev_password`
- PostgreSQL port: `5432`
- Redis port: `6379`

## Production Deployment

### Render backend

Set `NODE_ENV=production` and configure `FRONTEND_URL` as the Vercel **origin**—for example, `https://your-app.vercel.app`, without a trailing slash. Set `GOOGLE_CALLBACK_URL` to `https://your-render-domain.onrender.com/api/auth/google/callback`, plus the existing database, Redis, SMTP, `JWT_SECRET`, and `COOKIE_SECRET` variables. Keep all secrets only in Render's environment configuration.

Deploy the API and BullMQ consumer as two Render services. The included `render.yaml` defines the commands; it intentionally does not create a database or Key Value instance because an existing production database and Valkey instance can be attached to both services.

- Web Service: build `npm install && npx prisma generate && npm run build`; pre-deploy `npx prisma migrate deploy`; start `npm run start`.
- Background Worker: build `npm install && npx prisma generate && npm run build`; start `npm run start:worker`.

Copy the same `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, SMTP settings, `WORKER_CONCURRENCY`, `MIN_DELAY_BETWEEN_EMAILS_MS`, and `MAX_EMAILS_PER_HOUR` to the worker. The worker also validates the common application environment, so copy the remaining backend variables (`FRONTEND_URL`, Google OAuth variables, `JWT_SECRET`, `COOKIE_SECRET`, and `UPLOAD_MAX_SIZE_MB`) unchanged. Only the web service runs Prisma migrations.

BullMQ requires Redis/Valkey to retain queued jobs. Change the Render Key Value eviction policy from `allkeys-lru` to `noeviction` in the Render service settings. This cannot safely be changed by application code; with `allkeys-lru`, Redis may evict delayed BullMQ jobs under memory pressure.

### Vercel frontend

Set `VITE_API_URL=https://your-render-domain.onrender.com` and redeploy after changing it. Never place backend secrets in `VITE_*` variables.

### Google Cloud OAuth

Register `https://your-render-domain.onrender.com/api/auth/google/callback` as an Authorized redirect URI. Add `https://your-app.vercel.app` as an Authorized JavaScript origin if your Google client configuration requires it.

### Cookie and CORS behavior

The Vercel app and Render API are on different sites. In production the API issues secure, HTTP-only `SameSite=None` cookies, and the frontend client sends credentialed requests. The API allows only the configured frontend origin; do not use `*` with credentials.

## Install

```bash
npm install
```

## Database and Queue Services

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

## Prisma

Generate the client:

```bash
npm run prisma:generate
```

Apply migrations:

```bash
npm run prisma:migrate
```

## Run

Start the backend and frontend in development mode:

```bash
npm run dev
```

In separate terminals you can also run:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
npm run worker --workspace backend
```

## Checks

Run the main validation commands:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## API

- `GET /api/health`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/senders`
- `POST /api/senders`
- `POST /api/campaigns`
- `GET /api/campaigns`
- `GET /api/campaigns/:id`
- `POST /api/leads/parse`
- `POST /api/emails/schedule`
- `GET /api/emails/scheduled`
- `GET /api/emails/sent`
- `GET /api/emails/:id`

## Scheduling Behavior

- Emails are stored in PostgreSQL first.
- BullMQ delayed jobs are used for execution timing.
- The worker loads the email from PostgreSQL, claims it atomically, and sends it through Nodemailer.
- Rate limiting is distributed with Redis and enforced per sender.
- Minimum delay is also coordinated through Redis.
- If rate limiting blocks a send, the email is rescheduled rather than dropped.
- BullMQ job IDs are deterministic to reduce duplicate enqueueing.

## Restart Recovery

Startup reconciliation only finds emails that were persisted in PostgreSQL but never assigned a BullMQ job. It does not blindly recreate every job on every boot.

## Testing Notes

The current automated test coverage includes the lead parser. The app compiles successfully with TypeScript and builds successfully in both backend and frontend workspaces.

## Known Trade-offs

External SMTP systems cannot provide mathematical exactly-once delivery without an end-to-end idempotency protocol across the provider. This project provides strong practical duplicate protection with PostgreSQL state, deterministic job IDs, atomic claims, and retry-safe worker logic.
