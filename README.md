# ReachInbox - Email Scheduler

ReachInbox is a full-stack email scheduling application for creating campaigns, parsing lead lists, scheduling delayed delivery, and inspecting delivery outcomes. It uses React/Vite, an Express API, PostgreSQL with Prisma, Redis with BullMQ, Nodemailer, Ethereal SMTP, and Google OAuth.

## Overview

The application persists campaign and email records in PostgreSQL before creating delayed BullMQ jobs. A worker running in the same Node.js process as the Express API claims each scheduled email atomically, enforces sender-level limits through Redis, sends through Ethereal SMTP, and records `SENT` or `FAILED` in PostgreSQL.

The repository is an npm workspaces monorepo with `backend` and `frontend` packages.

## Login Page

<img width="1536" height="773" alt="Screenshot 2026-08-26 081054" src="https://github.com/user-attachments/assets/7f971162-5970-4c32-aa27-97f31c6c632b" />

## Dashboard

<img width="1532" height="777" alt="Screenshot 2026-08-26 081125" src="https://github.com/user-attachments/assets/e32dc80a-518a-440f-a8ac-4a4cd45288a3" />

## Compose Page

<img width="1447" height="712" alt="Screenshot 2026-08-26 081143" src="https://github.com/user-attachments/assets/6dd91f78-6e36-44f6-be07-641544d20a7d" />

## Scheduled Page

<img width="1536" height="776" alt="Screenshot 2026-08-26 081159" src="https://github.com/user-attachments/assets/d7168dc8-6bb2-4504-a186-57d68a341e5c" />

## Sent Page

<img width="1467" height="706" alt="Screenshot 2026-08-26 081212" src="https://github.com/user-attachments/assets/a9b5a8bc-c781-4cfc-ab36-369b5951e7fa" />

## Features

### Backend

- Google OAuth 2.0 authentication with signed, HTTP-only cookies.
- Environment-driven CORS and OAuth callback/redirect URLs.
- Campaign and sender persistence through Prisma.
- Email scheduling with PostgreSQL as the source of truth.
- BullMQ delayed jobs stored in Redis.
- One BullMQ worker embedded in the Express server process.
- Atomic email claiming and status transitions.
- Bounded exponential retries for transient SMTP/network failures.
- Permanent failure handling for non-retryable SMTP errors.
- Deterministic job IDs and practical duplicate protection.
- Per-sender hourly limits and minimum send spacing using an atomic Redis Lua script.
- Startup and periodic reconciliation for missing jobs and stale processing claims.
- Safe SMTP phase diagnostics and email-state inspection commands.
- Lead parsing from pasted text, CSV, and TXT uploads with validation and deduplication.

### Frontend

- Google sign-in entry point.
- Protected dashboard routes.
- Campaign overview and status counts.
- Compose form with sender selection, subject, body, recipients, start time, delay, and hourly limit.
- CSV/TXT upload and pasted lead input.
- Scheduled email table, including currently processing emails.
- Sent email table with Ethereal preview links when available.
- Failed email table with attempt count, error, and failure time.
- Loading, empty, refresh, and error states.

## Architecture

```text
React/Vite frontend
	|
	| credentialed HTTP API requests
	v
Express API (same Node.js process)
	|
	+---- PostgreSQL / Prisma
	|       source of truth for users, campaigns, senders, emails
	|
	+---- Redis
	|       |
	|       +---- BullMQ delayed email jobs
	|       +---- atomic sender rate-limit keys
	|
	+---- BullMQ email worker
		    |
		    v
		Nodemailer
		    |
		    v
	      Ethereal SMTP
```

In production, Render runs one Web Service using `node dist/server.js`. `backend/src/server.ts` starts Express and exactly one BullMQ worker in that process. A separate Render Background Worker is not required by this repository.

## Scheduling Flow

```text
User schedules a campaign
	|
	v
POST /api/emails/schedule
	|
	v
Validate request and sender ownership
	|
	v
Create Campaign and Email rows in one PostgreSQL transaction
	|
	v
Create deterministic delayed BullMQ jobs in Redis
	|
	v
Scheduled time arrives
	|
	v
Worker atomically claims SCHEDULED -> PROCESSING
	|
	v
Reserve sender rate-limit window in Redis
	|
	+---- blocked: reschedule as SCHEDULED
	|
	v
Nodemailer -> Ethereal SMTP
	|
	+---- success: PROCESSING -> SENT
	|
	+---- transient failure: PROCESSING -> SCHEDULED, BullMQ retries
	|
	+---- permanent/max-attempt failure: PROCESSING -> FAILED
```

`startTime` is parsed as an ISO date. Each recipient receives `startTime + index * delayMs`; BullMQ receives the difference between that timestamp and the current time as its delay. This uses durable Redis-backed delayed jobs rather than `setTimeout`, in-memory timers, or one cron schedule per email. Jobs survive process memory loss and can be reconciled from PostgreSQL after a restart.

## Email State Machine

The implemented email statuses are:

```text
SCHEDULED -> PROCESSING -> SENT
		    |
		    +-> SCHEDULED -> BullMQ retry
		    |
		    +-> FAILED
```

`SENT` is recorded only after `sendMail()` resolves successfully. A transient error such as `ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`, `EAI_AGAIN`, `ENETUNREACH`, `EPIPE`, or `ESOCKET` is retryable. SMTP 4xx responses are also treated as temporary; authentication failures and permanent recipient responses are not blindly retried. `MAX_EMAIL_ATTEMPTS` bounds BullMQ retries.

PostgreSQL rows are never deleted when BullMQ jobs complete or fail. The API exposes scheduled/processing emails at `GET /api/emails/scheduled`, successful emails at `GET /api/emails/sent`, and final failures at `GET /api/emails/failed`.

## Persistence and Restart Recovery

- PostgreSQL is written before queue publication.
- Each email stores `bullJobId`, `idempotencyKey`, `attempts`, status timestamps, errors, and an optional Ethereal preview URL.
- Jobs use `email-<emailId>` as their initial deterministic ID.
- Scheduling failures are reported and later reconciliation searches for `SCHEDULED` emails without a job ID.
- Reconciliation runs on startup and periodically while the worker is available.
- Processing claims older than `PROCESSING_TIMEOUT_MS` are recovered. Claims below `MAX_EMAIL_ATTEMPTS` return to `SCHEDULED`; exhausted claims become `FAILED`.
- Atomic database claims prevent two workers from processing the same `SCHEDULED` row concurrently.

There is an unavoidable distributed-systems boundary: if an SMTP server accepts a message and the process crashes before PostgreSQL is updated, mathematical exactly-once delivery cannot be guaranteed without provider-level idempotency. This project provides practical duplicate protection through atomic claims, deterministic job IDs, durable state, and bounded retries.

## Rate Limiting and Concurrency

The worker uses `WORKER_CONCURRENCY` BullMQ consumers. For each sender, the Redis Lua script atomically checks and reserves:

- The campaign hourly limit.
- `MIN_DELAY_BETWEEN_EMAILS_MS` between sends.

The hourly counter is keyed by sender and UTC hour. The minimum-delay key is also per sender, so concurrent jobs cannot reserve the same send window. A blocked job is returned to `SCHEDULED` and receives a delayed rescheduled job. Rate limiting does not mark an email as failed.

## SMTP / Ethereal

Ethereal is a test SMTP service: messages are captured for inspection rather than delivered to real inboxes. Create an account at [ethereal.email](https://ethereal.email), choose **Create Ethereal Account**, and copy the generated SMTP host, port, username, and password into local or Render environment settings. Do not commit those values.

The application uses Nodemailer with a reusable transporter object but does not enable pooling. Nodemailer opens a fresh SMTP connection for each non-pooled send and the application discards the transporter after a send failure. For port 587, use `SMTP_SECURE=false` and `SMTP_REQUIRE_TLS=true`. SMTP verification is advisory and cannot prevent API startup.

Run the compiled phase-specific diagnostic from the backend directory:

```bash
npm run smtp:diagnose
```

It reports DNS, TCP, SMTP greeting, STARTTLS, and authentication separately. A TCP timeout is reported as `SMTP TCP: FAIL` with `phase=tcp-connect`; it is not mislabeled as a TLS or authentication failure. After a successful send, Nodemailer/Ethereal may provide a preview URL, which is shown in the Sent view.

Inspect one PostgreSQL email record without printing secrets:

```bash
npm run email:inspect -- <email-id>
```

## Environment Variables

Create local files from the safe examples and keep real secrets out of Git. Backend variables are loaded by `backend/src/config/env.ts`; frontend variables are exposed to Vite only when prefixed with `VITE_`.

### Backend

```dotenv
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
JWT_SECRET=<random-secret-at-least-16-characters>
COOKIE_SECRET=<random-secret-at-least-16-characters>
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=<ethereal-smtp-user>
SMTP_PASSWORD=<ethereal-smtp-password>
SMTP_FROM=<ethereal-from-address>
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_CONNECTION_TIMEOUT_MS=30000
SMTP_GREETING_TIMEOUT_MS=30000
SMTP_SOCKET_TIMEOUT_MS=60000
WORKER_CONCURRENCY=5
MAX_EMAIL_ATTEMPTS=3
PROCESSING_TIMEOUT_MS=300000
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR=200
UPLOAD_MAX_SIZE_MB=5
```

`DATABASE_URL` points to PostgreSQL. `REDIS_*` configure Redis/BullMQ; an empty local password is valid. OAuth variables configure Google client identity and the callback. `FRONTEND_URL` controls CORS and the post-login redirect. JWT/cookie secrets sign authentication data. SMTP variables configure Ethereal. Worker and rate-limit values control concurrency, retries, recovery, and sender throughput.

### Frontend

```dotenv
VITE_API_URL=http://localhost:5000
```

The frontend Axios client uses `${VITE_API_URL}/api` and `withCredentials: true`. For Vercel, set `VITE_API_URL` to the deployed Render API origin and rebuild.

## Local Development

### Prerequisites

- Node.js 22 or newer.
- Docker Desktop and Docker Compose, or separately running PostgreSQL and Redis.
- A Google OAuth client with the local callback URI registered.
- An Ethereal account and SMTP credentials.

### Install and configure

From the repository root:

```bash
npm install
```

Copy `.env.example` to `.env`, then set local secrets and credentials. The backend also supports `backend/.env`; do not maintain conflicting values in both files. The included Compose file publishes PostgreSQL on `localhost:5432` and Redis on `localhost:6379`.

### Start dependencies and migrate

```bash
docker compose up -d postgres redis

npm run prisma:generate
npm run prisma:migrate
```

The local database must be running before completing Google OAuth because the callback upserts the authenticated user. If the callback returns `AUTH_SERVICE_UNAVAILABLE`, check PostgreSQL first.

### Start the application

Run both workspaces:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

The backend starts Express and the BullMQ worker together. Do not also run `npm run worker --workspace backend` when using `server.ts`, unless you intentionally want a separate development worker process.

Open `http://localhost:5173` and sign in with Google. The backend callback is `http://localhost:5000/api/auth/google/callback` and redirects to the configured `FRONTEND_URL`.

### Local production-style commands

```bash
npm run build --workspace backend
cd backend
npm run start
```

The frontend supports a production preview after building:

```bash
npm run build --workspace frontend
npm run preview --workspace frontend
```

## Production Deployment

### Render backend

Deploy one Render Web Service with:

```text
Root Directory: backend
Build Command: npm install && npx prisma generate && npm run build
Pre-deploy Command: npx prisma migrate deploy
Start Command: npm run start
```

The start command runs `node dist/server.js`, which owns Express and exactly one BullMQ worker. Set `NODE_ENV=production`, the hosted PostgreSQL `DATABASE_URL`, Render Redis host/port/password, the production `FRONTEND_URL`, and the production `GOOGLE_CALLBACK_URL`. Supply Ethereal settings through the SMTP variables above; do not hard-code them.

Render Redis/Key Value should use the `noeviction` policy. With `allkeys-lru`, Redis may evict delayed BullMQ jobs under memory pressure. This is separate from SMTP connectivity and cannot be safely corrected by application code.

### Vercel frontend

Set the Vercel build variable:

```text
VITE_API_URL=https://<render-service>.onrender.com
```

Never put backend credentials or secrets in `VITE_*` variables. Vercel must be redeployed after changing build-time variables.

### Google OAuth and cookies

Register both callback URLs in the Google Cloud OAuth client:

```text
http://localhost:5000/api/auth/google/callback
https://<render-service>.onrender.com/api/auth/google/callback
```

Development cookies are HTTP-only, `Secure=false`, and `SameSite=Lax`. Production cookies are HTTP-only, `Secure=true`, and `SameSite=None` because the Vercel frontend and Render API are cross-site. CORS allows only the configured `FRONTEND_URL` with credentials enabled; wildcard origins are not used.

## API Reference

### Authentication

- `GET /api/auth/google` - begin Google OAuth.
- `GET /api/auth/google/callback` - complete OAuth and set the signed auth cookie.
- `GET /api/auth/me` - return the authenticated user.
- `POST /api/auth/logout` - clear authentication cookies.

### Application resources

- `GET /api/health` - basic service health response.
- `GET /api/senders` and `POST /api/senders` - list and create senders.
- `POST /api/campaigns`, `GET /api/campaigns`, `GET /api/campaigns/:id` - campaign operations.
- `POST /api/leads/parse` - parse pasted or uploaded lead data.
- `POST /api/emails/schedule` - persist and enqueue a campaign's emails.
- `GET /api/emails/scheduled` - return `SCHEDULED` and `PROCESSING` emails.
- `GET /api/emails/sent` - return only `SENT` emails.
- `GET /api/emails/failed` - return only `FAILED` emails.
- `GET /api/emails/:id` - return one email belonging to the authenticated user.

## Verification and Testing

Run from the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Backend-specific diagnostics and tests:

```bash
npm run smtp:diagnose --workspace backend
npm run email:inspect --workspace backend -- <email-id>
```

The automated suite covers lead parsing, retry-state recovery, SMTP error classification, and scheduled/processing visibility. It does not require live PostgreSQL, Redis, Google OAuth, or Ethereal credentials. A complete live delivery test requires running PostgreSQL and Redis locally and valid Google/Ethereal credentials, or executing the diagnostic and a real scheduled test in the deployed environment.

## Operational Notes and Trade-offs

- PostgreSQL is the durable source of truth; Redis/BullMQ is execution infrastructure.
- SMTP verification is intentionally non-fatal so temporary SMTP outages do not take down the API.
- An SMTP `ETIMEDOUT` with `command=CONN` means the TCP connection failed before greeting, STARTTLS, authentication, or message submission. The diagnostic separates these phases.
- Ethereal captures messages for inspection and is appropriate for development/testing, not production mailbox delivery.
- Exactly-once delivery cannot be mathematically guaranteed across an external SMTP provider and a database update. The implementation provides bounded, retry-safe, practical duplicate protection.
