# ReachInbox - Email Scheduler

ReachInbox is a full-stack email scheduling app for creating campaigns, scheduling delayed sends, tracking email state, and reviewing delivery outcomes. It uses React/Vite, Express, PostgreSQL with Prisma, Redis with BullMQ, Nodemailer, Ethereal SMTP, and Google OAuth.

## 🚀 Quick Start

### Prerequisites

- Node.js 22 or newer
- Docker Desktop and Docker Compose
- A Google OAuth client with the local callback URL registered
- An Ethereal account and SMTP credentials

### 1. Clone and install

```bash
git clone <repository-url>
cd ReachInbox__Hiring_Assignment_Outbox_Labs
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your local values for PostgreSQL, Redis, Google OAuth, JWT, cookies, and Ethereal SMTP.

### 3. Start local services

```bash
docker compose up -d postgres redis
```

### 4. Run Prisma setup

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Start the application

```bash
npm run dev
```

This starts the backend and frontend together. The app is available at:

```text
http://localhost:5173
```

## ✨ Key Features

- Campaign and sender management with PostgreSQL persistence
- Delayed email scheduling through BullMQ and Redis
- Worker-based processing with retry and failure handling
- Per-sender rate limiting and hourly send caps
- Google OAuth sign-in with secure cookie-based session flow
- SMTP diagnostics and email-state inspection tooling
- CSV/TXT upload and pasted lead parsing for bulk sends
- Sent and failed email tracking with Ethereal preview links where available

## 🛠️ Tech Stack

| Area | Stack |
| --- | --- |
| Frontend | React + Vite + TypeScript |
| Backend | Express + Node.js |
| Database | PostgreSQL + Prisma |
| Queue & scheduling | Redis + BullMQ |
| SMTP | Nodemailer + Ethereal SMTP |
| Authentication | Google OAuth 2.0 |
| Deployment | Railway (backend) + Vercel (frontend) |

## 🏗️ Architecture

```text
React/Vite frontend
    |
    | authenticated HTTP requests
    v
Express API (same Node.js process)
    |
    +---- PostgreSQL / Prisma
    |       source of truth for users, campaigns, senders, emails
    |
    +---- Redis
    |       |
    |       +---- BullMQ delayed email jobs
    |       +---- sender rate-limit keys
    |
    +---- BullMQ email worker
                |
                v
            Nodemailer
                |
                v
            Ethereal SMTP
```

The backend runs Express and the worker in the same Node.js process. Redis backs BullMQ delayed jobs and sender-level rate limiting; PostgreSQL stores the durable source of truth for scheduling and email state.

## 📸 Screenshots

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

## 📧 Email Scheduling Flow

A scheduled email follows this path:

1. User creates a campaign and schedules sends
2. The app writes the email and campaign records to PostgreSQL
3. A delayed BullMQ job is created in Redis
4. The worker picks up the job and claims the email state
5. Rate-limit checks are enforced in Redis
6. Nodemailer sends through Ethereal SMTP
7. PostgreSQL is updated to `SENT` or `FAILED` based on the SMTP result

## 🔄 Persistence & Restart Recovery

- PostgreSQL is the durable source of truth for campaigns, senders, and email state
- BullMQ jobs are stored in Redis and survive process restarts when configured correctly
- Processing claims older than the configured timeout are reconciled automatically
- Retryable failures return emails to `SCHEDULED` for reprocessing
- Failed jobs or exhausted attempts end in `FAILED`
- Deterministic job IDs and atomic claims provide practical duplicate protection

## ⚡ Rate Limiting & Worker Concurrency

The worker uses `WORKER_CONCURRENCY` to process jobs concurrently. For each sender, the Redis Lua script atomically checks and reserves:

- the campaign hourly email quota
- the minimum time gap between sends

Blocked jobs are rescheduled without marking the email as failed.

## 🔐 Google OAuth / Authentication

- Google OAuth starts from the backend and completes through the configured callback URL
- The app issues a signed, HTTP-only authentication cookie for the browser
- The frontend uses the configured `FRONTEND_URL` for redirects and CORS
- The callback flow is designed for the Railway + Vercel deployment split used in production

## 📩 SMTP / Ethereal

Ethereal is the required fake SMTP service used by this project. It captures outgoing mail for inspection rather than delivering to real inboxes.

Create an account at [ethereal.email](https://ethereal.email), then copy the generated SMTP host, port, username, and password into your local or Railway environment variables.

Important configuration details:

- `SMTP_HOST=smtp.ethereal.email`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_REQUIRE_TLS=true`

This combination is correct for Ethereal on port 587 and uses STARTTLS. SMTP verification is advisory and does not prevent the API from starting.

Useful operational commands:

```bash
npm run smtp:diagnose --workspace backend
npm run email:inspect --workspace backend -- <email-id>
```

## 🌐 Production Deployment

### Railway backend

Deploy one Railway service with:

```text
Root Directory: backend
Build Command: npm install && npx prisma generate && npm run build
Pre-deploy Command: npx prisma migrate deploy
Start Command: npm run start
```

Set `NODE_ENV=production`, the PostgreSQL `DATABASE_URL`, and the required Redis and OAuth variables.

### Vercel frontend

Set the Vercel build variable:

```text
VITE_API_URL=https://reachinbox-api-production-749e.up.railway.app
```

## 🔧 Environment Configuration

Backend environment variables:

```dotenv
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>
REDIS_HOST=<upstash-host>
REDIS_PORT=6379
REDIS_PASSWORD=<upstash-password>
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

Frontend environment variable:

```dotenv
VITE_API_URL=http://localhost:5000
```

Keep real credentials and secrets out of Git. The backend reads its variables from `backend/src/config/env.ts`; frontend variables are exposed only when prefixed with `VITE_`.

## 🔌 API Reference

### Authentication

- `GET /api/auth/google` - begin Google OAuth
- `GET /api/auth/google/callback` - complete OAuth and issue the one-time Redis handoff
- `POST /api/auth/session/complete` - complete login and set the auth cookie
- `GET /api/auth/me` - return the authenticated user
- `POST /api/auth/logout` - clear authentication cookies

### Application resources

- `GET /api/health` - health check
- `GET /api/senders` and `POST /api/senders` - list and create senders
- `POST /api/campaigns`, `GET /api/campaigns`, `GET /api/campaigns/:id` - campaign operations
- `POST /api/leads/parse` - parse pasted or uploaded lead data
- `POST /api/emails/schedule` - persist and queue campaign emails
- `GET /api/emails/scheduled` - return `SCHEDULED` and `PROCESSING` emails
- `GET /api/emails/sent` - return only `SENT` emails
- `GET /api/emails/failed` - return only `FAILED` emails
- `GET /api/emails/:id` - return one email for the authenticated user

## 🧪 Verification / Testing

Run from the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The automated tests cover email retry-state logic, SMTP error classification, and scheduled/processing visibility. Live delivery tests require PostgreSQL, Redis, OAuth credentials, and valid Ethereal SMTP credentials.

## ⚖️ Trade-offs / Operational Notes

- PostgreSQL is the durable source of truth; Redis/BullMQ is execution infrastructure
- SMTP verification is intentionally non-fatal so temporary outages do not take down the API
- `ETIMEDOUT` with `command=CONN` means the TCP connection failed before greeting, STARTTLS, authentication, or message submission
- Ethereal is appropriate for development and testing, not for real production mailbox delivery
- Exactly-once delivery cannot be guaranteed across an external SMTP provider and a database update; this implementation provides bounded, retry-safe, practical duplicate protection

The repository is a monorepo with `backend` and `frontend` workspaces.
