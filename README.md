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
