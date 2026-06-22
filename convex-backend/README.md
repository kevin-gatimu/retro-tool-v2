# Convex Backend

This package holds the Convex realtime projection layer for the Retro Tool platform. Locally it runs self-hosted via Docker; in staging and production it uses Convex Cloud.

---

## What It Does

Convex provides instant, subscription-based realtime updates for all collaborative features. The NestJS API is the system of record (PostgreSQL); after each mutation it pushes a snapshot to Convex, which then broadcasts to all subscribed browser clients.

---

## Modules

| File | Purpose | Queries exposed to browser |
| --- | --- | --- |
| `liveRetros.ts` | Active retro board snapshot (cards, votes, phase, participants) | `getRetroBoard` |
| `liveEstimates.ts` | Active estimate session snapshot (stories, votes, reveal state) | `getEstimateBoard` |
| `liveNotifications.ts` | Per-user notification projection | `getUserNotifications` |
| `liveReports.ts` | Aggregate B-trees for stats (retros completed, cards, votes, action items) | `getTeamStats`, `getUserStats`, `getSystemStats` |
| `rateLimits.ts` | Token-bucket and fixed-window guards on every upsert | — |
| `schema.ts` | Convex document schema | — |
| `admin.ts` | Admin mutations called by NestJS sync service | — |
| `auth.config.ts` | Better Auth JWT bridge configuration | — |

---

## Setup

### 1. Environment

```bash
cp .env.example .env.local
```

Key variables:

| Variable | Purpose |
| --- | --- |
| `CONVEX_URL` | Convex deployment URL (local: `http://localhost:3210`) |
| `CONVEX_DEPLOY_KEY` | Admin key for deployments |

### 2. Running locally

The self-hosted Convex instance starts as part of the Docker stack:

```bash
# From repo root
pnpm local:infra    # starts Convex + Postgres + Redis
pnpm dev:convex     # starts the Convex function watcher
```

### 3. Running against remote environments

```bash
pnpm dev:staging    # loads .env.staging-local → watches against staging Convex Cloud
pnpm dev:prod       # loads .env.production-local → watches against production Convex Cloud
```

### 4. Deploying

```bash
pnpm deploy         # deploys functions to the configured Convex deployment
```

---

## Scripts

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `convex dev` | Watch mode against local Convex |
| `dev:staging` | `dotenv -e .env.staging-local -- convex dev` | Watch against staging |
| `dev:prod` | `dotenv -e .env.production-local -- convex dev` | Watch against production |
| `codegen` | `convex codegen` | Regenerate TypeScript types |
| `deploy` | `convex deploy` | Deploy to Convex Cloud |

---

## Dependencies

| Package | Purpose |
| --- | --- |
| `convex` | Core SDK |
| `@convex-dev/rate-limiter` | Token-bucket + fixed-window rate limiting |
| `@convex-dev/aggregate` | B-tree aggregate indexes for stats |
| `dotenv-cli` | Load env files for remote environment scripts |

---

## AI Guidelines

**Before editing any file in `convex/`**, read [`convex/_generated/ai/guidelines.md`](convex/_generated/ai/guidelines.md). Those rules override general Convex knowledge from training data.
