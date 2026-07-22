# Retro Tool

A collaborative agile retrospective and story-estimation platform. Built for engineering teams who want structured, real-time retrospectives with role-based access control, live story estimates, actionable reporting, and automated email workflows.

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Who Uses It — Roles &amp; Permissions](#who-uses-it--roles--permissions)
3. [Architecture Overview](#architecture-overview)
4. [Convex Realtime Layer](#convex-realtime-layer)
5. [Monorepo Structure](#monorepo-structure)
6. [Tech Stack](#tech-stack)
7. [Local Development](#local-development)
8. [Environment Setup](#environment-setup)
9. [Database &amp; Seed Workflow](#database--seed-workflow)
10. [Workspace Commands](#workspace-commands)
11. [Deployment](#deployment)
12. [Documentation Index](#documentation-index)

---

## What It Does

Retro Tool provides everything a team needs to run effective agile ceremonies:

| Feature                         | Description                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Retrospectives**        | Phased retro boards (brainstorm → group → vote → discuss → action items) with built-in templates (Start/Stop/Continue, 4Ls, Mad/Sad/Glad, and more)    |
| **Story Estimates**       | Real-time story-estimation sessions with reveal mechanics and consensus tracking                                                                           |
| **Organizations & Teams** | Hierarchical org → team → member structure with fine-grained RBAC                                                                                        |
| **Action Items**          | Per-retro action items with carry-forward tracking across sessions                                                                                         |
| **Reports & Analytics**   | Dashboards for retro completion rates, card counts, vote counts, and action item health — answered from PostgreSQL via the`/api/reports/v2/*` endpoints |
| **Notifications**         | In-app notification centre + browser push notifications (VAPID)                                                                                            |
| **Email Workflows**       | Retro reminders, weekly digests, and transactional email via Resend                                                                                        |
| **Multi-Session Auth**    | Email/password + OAuth (Microsoft) via Better Auth with multi-session support                                                                              |

---

## Who Uses It — Roles & Permissions

The platform has two parallel role dimensions: a **system-level role** on every user and a **context role** per org or team membership.

### System Roles

```
┌──────────────────────────────────────────────────────────┐
│                     SYSTEM ROLES                         │
│                                                          │
│  ┌─────────────┐   Full access everywhere. Can promote  │
│  │ super-admin │ ◄ / demote admins, reactivate users.   │
│  └──────┬──────┘                                        │
│         │                                               │
│  ┌──────▼──────┐   Platform-wide. Manages orgs,         │
│  │system-admin │ ◄ suspends users, views all orgs.      │
│  └──────┬──────┘                                        │
│         │                                               │
│  ┌──────▼──────┐   Default for every new sign-up.       │
│  │   member    │ ◄ Access is scoped by org/team role.   │
│  └─────────────┘                                        │
└──────────────────────────────────────────────────────────┘
```

> The first user to sign up is automatically bootstrapped as `super-admin`.

### Organization Roles

```
┌────────────────────────────────────────────────────────────────┐
│                    ORGANIZATION ROLES                          │
│                                                                │
│  ┌───────────┐  Created the org. Can delete, transfer          │
│  │ org-owner │  ownership, promote/demote org-admins.          │
│  └─────┬─────┘                                                │
│        │                                                       │
│  ┌─────▼─────┐  Manages members, invites users, updates        │
│  │ org-admin │  org settings, creates and deletes teams.       │
│  └─────┬─────┘                                                │
│        │                                                       │
│  ┌─────▼─────┐  Views org and team info, joins teams,          │
│  │  member   │  participates in retros and estimates.          │
│  └───────────┘                                                │
└────────────────────────────────────────────────────────────────┘
```

### Team Roles

```
┌────────────────────────────────────────────────────────────────┐
│                       TEAM ROLES                               │
│                                                                │
│  ┌───────────┐  Manages team members, approves join             │
│  │ team-lead │  requests, creates and manages retros.          │
│  └─────┬─────┘                                                │
│        │                                                       │
│  ┌─────▼─────┐  Participates in retros and story estimates,    │
│  │  member   │  adds cards, votes, views results.              │
│  └───────────┘                                                │
└────────────────────────────────────────────────────────────────┘
```

> Full permission matrices are in [docs/security/rbac.md](docs/security/rbac.md).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│                                                                 │
│  React 19 + TanStack Router + TanStack Query                    │
│  Better Auth client · Socket.IO client · Convex React SDK       │
│                                                                 │
│      REST/HTTP         WebSocket           WebSocket            │
│         │               (Socket.IO)         (Convex)            │
└─────────┼───────────────────┼───────────────────┼──────────────┘
          │                   │                   │
          ▼                   ▼                   │
┌─────────────────────────────────────┐           │
│           NestJS API                │           │
│                                     │           │
│  Auth · Orgs · Teams · Retros       │           │
│  Estimates · Notifications · Email  │           │
│  Reports · Reminders · Scheduler    │           │
│                                     │           │
│  PostgreSQL (system of record)      │           │
│         │                           │           │
│         │  HTTP Admin API           │           │
│         │  (projection sync)        │           │
└─────────┼───────────────────────────┘           │
          │                                       │
          ▼                                       ▼
┌──────────────────────────────────────────────────────────────┐
│                 Convex Realtime Projection Layer              │
│                                                              │
│  liveRetros · liveEstimates · liveNotifications              │
│  liveStandups · liveIcebreakers · liveSurveys/Polls          │
│  liveTeamMembers · rateLimits                                │
│                                                              │
│  Convex embedded DB (backed by its own PostgreSQL)           │
└──────────────────────────────────────────────────────────────┘
```

**Key principle:** PostgreSQL (via NestJS) is the **system of record** for all durable business state. Convex stores only active collaboration snapshots that the UI reads reactively.

---

## Convex Realtime Layer

Convex is the real-time projection layer that makes collaborative retro and estimate boards feel instant for every participant. Understanding its role is critical if you work on any live-board feature.

### The Problem It Solves

Traditional polling and even Socket.IO require the client to either poll on a timer or manage explicit room subscriptions. When a team of ten people is in a live retro simultaneously, every card add, vote, or phase change must reach all clients with no perceptible lag. Convex provides this through an automatic, document-level dependency graph — every `useQuery` on the browser is a persistent live subscription.

### How a Request Flows Through the System

```
User casts a vote in browser
        │
        │  1. HTTP POST /api/retros/:id/cards/:cardId/votes
        ▼
┌───────────────────┐
│    NestJS API     │
│                   │
│  2. Write vote    │
│     row to        │
│     PostgreSQL    │
│                   │
│  3. Emit via      │──────► Socket.IO room broadcast
│     Gateway       │        (fallback transport)
│                   │
│  4. Call Convex   │
│     Projection    │
│     Sync Service  │
└────────┬──────────┘
         │
         │  5. POST http://convex:3210/api/mutation
         │     { path: "liveRetros:upsertRetroBoard",
         │       args: { retroId, board snapshot },
         │       Authorization: "Convex <adminKey>" }
         │
         ▼
┌──────────────────────────────┐
│     Convex Backend           │
│                              │
│  6. Rate-limit check         │
│     (token bucket 10/s       │
│      per retroId)            │
│                              │
│  7. Upsert document in       │
│     embedded DB              │
│                              │
│  8. Dependency graph fires   │
│     — all subscribed         │
│     queries re-execute       │
└────────────┬─────────────────┘
             │
             │  9. WebSocket push to every
             │     subscribed browser tab
             │     (50–150 ms end-to-end)
             ▼
┌────────────────────────────┐
│  All connected browsers    │
│                            │
│  useQuery(liveRetros       │
│    .getRetroBoard, args)   │
│  → UI re-renders with      │
│    updated vote counts     │
└────────────────────────────┘
```

### What Convex Manages

| Module                                | What it stores                                                  | Queries exposed to browser |
| ------------------------------------- | --------------------------------------------------------------- | -------------------------- |
| `liveRetros.ts`                     | Active retro board snapshot (cards, votes, phase, participants) | `getRetroBoard`          |
| `liveEstimates.ts`                  | Active estimate session snapshot (stories, votes, reveal state) | `getEstimateBoard`       |
| `liveStandups.ts`                   | Active standup snapshot (updates, participants)                 | `getStandupBoard`        |
| `liveIcebreakers.ts`                | Active icebreaker snapshot                                      | `getIcebreakerBoard`     |
| `liveSurveys.ts` / `livePolls.ts` | Active survey / poll snapshot and live results                  | `getSurvey`, `getPoll` |
| `liveTeamMembers.ts`                | Team-member presence / roster projection                        | `getTeamMembers`         |
| `liveNotifications.ts`              | Per-user notification projection                                | `getUserNotifications`   |
| `rateLimits.ts`                     | Token-bucket and fixed-window guards on every upsert            | —                         |

> Historical/analytical reporting is **not** in Convex — the `@convex-dev/aggregate` counters that once backed a `liveReports` module were retired in the reports v2 redesign. Report dashboards are now answered from PostgreSQL via `/api/reports/v2/*`.

### Feature Flags

The UI chooses its realtime backend per feature via Vite env vars:

```env
VITE_RETROS_REALTIME_BACKEND=convex      # or: socket-io
VITE_ESTIMATES_REALTIME_BACKEND=convex   # or: socket-io
```

Socket.IO remains the fallback transport when either flag is set to `socket-io`.

> Deep dive: [docs/architecture/convex.md](docs/architecture/convex.md) · [docs/security/convex-nestjs-auth.md](docs/security/convex-nestjs-auth.md) · [convex-backend/README.md](convex-backend/README.md)

---

## Monorepo Structure

```
.
├── convex-backend/           # Self-hosted Convex functions and schema
│   └── convex/
│       ├── schema.ts         # Convex document schema
│       ├── liveRetros.ts     # Retro board queries + mutations
│       ├── liveEstimates.ts  # Estimate board queries + mutations
│       ├── liveStandups.ts   # Standup board queries + mutations
│       ├── liveIcebreakers.ts
│       ├── liveSurveys.ts / livePolls.ts
│       ├── liveTeamMembers.ts
│       ├── liveNotifications.ts
│       └── rateLimits.ts     # Write-rate guards
│
├── packages/
│   └── shared/
│       └── contracts/        # Shared realtime contracts (UI ↔ Convex)
│
├── retro-tool-api/           # NestJS REST + Socket.IO backend
│   ├── src/
│   │   ├── auth/             # Better Auth integration + RBAC guards
│   │   ├── organizations/    # Org management
│   │   ├── teams/            # Team management
│   │   ├── retros/           # Retro lifecycle, cards, votes
│   │   ├── estimates/        # Story estimate sessions
│   │   ├── estimate-templates/
│   │   ├── notifications/    # In-app + push notifications
│   │   ├── email/            # Transactional email (Resend)
│   │   ├── reports/          # Analytics endpoints
│   │   ├── invitations/      # Org + team invitation handling
│   │   ├── sessions/         # Session management
│   │   ├── action-items/     # Retro action items
│   │   ├── team-roles/       # Team role definitions
│   │   ├── convex-admin/     # Convex projection sync
│   │   ├── user-preferences/ # Notification preferences
│   │   ├── adapters/         # Socket.IO adapter
│   │   ├── common/           # Shared guards, interceptors, types
│   │   ├── database/         # Drizzle provider
│   │   └── seed/             # Seed scripts
│   ├── scripts/              # Operational scripts (db-backup)
│   └── drizzle/              # Database migrations
│
├── retro-tool-ui/            # React 19 frontend
│   └── src/
│       ├── routes/           # File-based routing (TanStack Router)
│       ├── components/       # Shared UI components
│       ├── hooks/            # Auth, push, theme hooks
│       └── lib/              # API client, RBAC helpers
│
├── infra/                    # Azure Bicep IaC (CLI-only)
│   ├── deploy.bicep          # Subscription-scoped entry point
│   ├── main.bicep            # All resources
│   └── README.md             # Deployment documentation
│
├── .github/workflows/        # CI/CD pipelines
│   ├── ci.yml                # Lint + type-check + test
│   ├── deploy-api.yml        # Docker build → ACR → App Service
│   ├── deploy-ui.yml         # Vite build → Static Web App
│   ├── deploy-convex.yml     # Deploy Convex functions to App Service
│   ├── release-please.yml    # Automated release PRs
│   └── release-staging.yml   # Staging release automation
│
├── docker/
│   └── docker-compose.local.yml
│
└── docs/                     # Project-wide documentation
```

---

## Tech Stack

### Frontend — `retro-tool-ui`

| Layer         | Technology                           |
| ------------- | ------------------------------------ |
| Framework     | React 19                             |
| Routing       | TanStack Router (file-based)         |
| Data fetching | TanStack Query                       |
| Forms         | TanStack Form                        |
| Tables        | TanStack Table                       |
| Auth client   | Better Auth (`better-auth/client`) |
| UI primitives | Radix UI                             |
| Styling       | TailwindCSS 4                        |
| Charts        | Recharts                             |
| Realtime      | Socket.IO client + Convex React SDK  |
| Validation    | Zod                                  |

> Full details: [retro-tool-ui/README.md](retro-tool-ui/README.md)

### Backend — `retro-tool-api`

| Layer              | Technology                                    |
| ------------------ | --------------------------------------------- |
| Runtime            | Node.js + TypeScript                          |
| Framework          | NestJS 11                                     |
| Database           | PostgreSQL 16                                 |
| ORM                | Drizzle ORM                                   |
| Auth               | Better Auth +`@thallesp/nestjs-better-auth` |
| WebSockets         | Socket.IO                                     |
| Validation         | class-validator + Zod                         |
| Email              | Resend                                        |
| Push notifications | web-push (VAPID)                              |
| Scheduler          | `@nestjs/schedule` (cron jobs)              |

> Full details: [retro-tool-api/README.md](retro-tool-api/README.md)

### Realtime — `convex-backend`

| Layer         | Technology                     |
| ------------- | ------------------------------ |
| Runtime       | Self-hosted Convex             |
| Functions     | TypeScript queries + mutations |
| Rate limiting | `@convex-dev/rate-limiter`   |
| Aggregates    | `@convex-dev/aggregate`      |
| Auth bridge   | Better Auth JWT                |

> Full details: [convex-backend/README.md](convex-backend/README.md) · [docs/architecture/convex.md](docs/architecture/convex.md)

---

## Local Development

### Option 0 — One-command bootstrap (recommended)

Brings up the self-hosted stack (PostgreSQL + Convex) in Docker, derives the
Convex admin key from the running container, writes it into the `.env.local`
files, runs migrations + seeds, and deploys the Convex functions:

```powershell
pnpm local:bootstrap      # full setup (add --reset via `pnpm local:reset` for a clean slate)
pnpm local:dev            # then run API + UI + Convex watcher, each reading its own .env.local
pnpm local:dev:all        # same, plus the VitePress user-guide dev server (retro-tool-ui/docs)
```

`local:bootstrap` is idempotent — safe to re-run any time creds or the admin key
drift. It regenerates the admin key (deterministic from `INSTANCE_NAME` +
`INSTANCE_SECRET`) and re-patches `retro-tool-api/.env.local` and
`convex-backend/.env.local`. Stop the Docker infra with `pnpm local:down`.

> Dashboard login: after bootstrap the Convex dashboard credentials (Deployment
> URL `http://localhost:3210` + Admin Key) are written to the git-ignored
> `convex-dashboard-login.local.txt` at the repo root — paste them into the
> dashboard at `http://localhost:6791`.
>
> The local Postgres publishes on host port **5433** (the container is 5432
> internally) so it never collides with a host-native Postgres on 5432. Convex
> reaches it over the Docker network, unaffected.

### Option 1 — Full Docker stack (everything in containers)

```powershell
pnpm local:up
```

Services exposed:

| Service          | URL                                | Notes                                     |
| ---------------- | ---------------------------------- | ----------------------------------------- |
| UI               | `http://localhost:3000`          | nginx-served frontend                     |
| API              | `http://localhost:8000`          | NestJS backend                            |
| Swagger          | `http://localhost:8000/api/docs` | Interactive API docs                      |
| PostgreSQL       | `localhost:5433`                 | seeded on first start (5432 in-container) |
| Convex API       | `http://localhost:3210`          | self-hosted Convex backend                |
| Convex dashboard | `http://localhost:6791`          | local Convex UI                           |

### Option 2 — Hybrid pnpm (live reload)

Start infrastructure containers first:

```powershell
pnpm local:infra
```

Then run each app process (or all at once with `pnpm local:dev`):

```powershell
pnpm dev:api       # NestJS with watch mode
pnpm dev:ui        # Vite dev server
pnpm dev:convex    # Convex function watcher
```

> Note: the Convex admin key only exists once the container is running, so on a
> fresh checkout run `pnpm local:bootstrap` (Option 0) at least once to populate
> the `.env.local` keys before using this option.

### VS Code Tasks

Use `Terminal: Run Task` to launch any of the pre-configured tasks:

| Task                          | What it starts                        |
| ----------------------------- | ------------------------------------- |
| `Local Infra`               | PostgreSQL + Convex containers only   |
| `API Dev`                   | NestJS in watch mode                  |
| `UI Dev`                    | Vite dev server                       |
| `Convex Dev`                | Convex function watcher               |
| `Local App Dev`             | Infra + API + UI in parallel          |
| `Local App Dev With Convex` | Infra + API + UI + Convex in parallel |
| `Local Docker Stack`        | Full container stack                  |

---

## Environment Setup

### 1. Install dependencies

```powershell
pnpm install
```

### 2. Copy environment files

```powershell
Copy-Item retro-tool-api/.env.example retro-tool-api/.env.local
Copy-Item retro-tool-ui/.env.example retro-tool-ui/.env.local
Copy-Item convex-backend/.env.example convex-backend/.env.local
Copy-Item docker/.env.example docker/.env
```

### 3. API environment (`retro-tool-api/.env.local`)

| Variable                                              | Purpose                              |
| ----------------------------------------------------- | ------------------------------------ |
| `DATABASE_URL`                                      | PostgreSQL connection string         |
| `BETTER_AUTH_SECRET`                                | Session signing secret               |
| `BETTER_AUTH_URL`                                   | Must match server URL + port         |
| `FRONTEND_URL`                                      | CORS allowed origin                  |
| `CONVEX_SYNC_URL`                                   | Convex HTTP Admin API URL            |
| `CONVEX_SYNC_ADMIN_KEY`                             | Convex admin key for projection sync |
| `RESEND_API_KEY`                                    | Transactional email                  |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`          | Browser push notifications           |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | OAuth (Microsoft)                    |

### 4. UI environment (`retro-tool-ui/.env.local`)

```env
VITE_API_URL=http://localhost:8000
VITE_CONVEX_URL=http://localhost:3210
VITE_RETROS_REALTIME_BACKEND=convex       # or: socket-io
VITE_ESTIMATES_REALTIME_BACKEND=convex    # or: socket-io
VITE_NOTIFICATIONS_REALTIME_BACKEND=convex
```

### 5. Convex environment (`convex-backend/.env.local`)

Self-hosted deploy vars (populated by `pnpm local:bootstrap` for local dev):
`CONVEX_SELF_HOSTED_URL` (local: `http://127.0.0.1:3210`),
`CONVEX_SELF_HOSTED_ADMIN_KEY`, plus the JWT bridge (`JWT_ISSUER`,
`JWT_AUDIENCE`, `JWT_JWKS_URL`).

### 6. Running against remote environments

Each package has `.env.staging-local` and `.env.production-local` files for running locally against Azure resources. Uses `dotenv-cli` to load env before the process starts:

```powershell
pnpm dev:api:staging    # API against staging DB + Convex
pnpm dev:ui:staging     # UI pointing at staging Convex
pnpm dev:convex:staging # Convex CLI against staging

pnpm dev:api:prod       # API against production
pnpm dev:ui:prod        # UI pointing at production Convex
pnpm dev:convex:prod    # Convex CLI against production
```

> `NODE_ENV` stays `development` in all local env files regardless of which remote resources you target.

---

## Database & Seed Workflow

```powershell
pnpm --dir retro-tool-api db:generate     # generate migration from schema changes
pnpm --dir retro-tool-api db:migrate      # apply pending migrations
pnpm --dir retro-tool-api db:seed         # seed demo users, orgs, teams, retros + templates
pnpm --dir retro-tool-api db:seed:templates  # templates only (idempotent)
pnpm --dir retro-tool-api db:studio       # open Drizzle Studio in browser
```

The seed creates demo accounts, a sample organization, teams, and all built-in retro templates. See [retro-tool-api/README.md](retro-tool-api/README.md) for seed credentials.

---

## Workspace Commands

Run all commands from the repository root:

```powershell
pnpm install        # install all workspace dependencies
pnpm build          # build all packages
pnpm lint           # lint all packages
pnpm type-check     # type-check all packages
pnpm test           # run all tests
```

Package-scoped type checks:

```powershell
pnpm --filter retro-tool-api type-check
pnpm --filter retro-tool-ui type-check
pnpm --filter @retro-tool/contracts type-check
```

Infrastructure:

```powershell
pnpm local:up       # start full Docker stack
pnpm local:infra    # start infrastructure containers only
pnpm local:down     # stop and remove containers
pnpm local:logs     # tail container logs
```

---

## Deployment

The project targets **Azure** with infrastructure provisioned via Bicep (CLI-only) and app deployment via GitHub Actions.

### Deployment model

```
┌─────────────────────────────────────────────────────────────┐
│                        AZURE                                │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │ Static Web App   │    │ App Service for Containers   │  │
│  │ (React UI)       │    │ (NestJS API via ACR)         │  │
│  └──────────────────┘    └──────────────────────────────┘  │
│                                    │                        │
│              ┌────────────────────┬┘                        │
│              ▼                    ▼                         │
│  ┌─────────────────┐   ┌──────────────────────────────┐    │
│  │ PostgreSQL      │   │ Self-hosted Convex           │    │
│  │ Flexible Server │   │ (App Service, per environment)│   │
│  └─────────────────┘   └──────────────────────────────┘    │
│                                                             │
│  ┌─────────────────┐   ┌──────────────────────────────┐    │
│  │ Container       │   │ User-assigned Managed        │    │
│  │ Registry (ACR)  │   │ Identity (AcrPull)           │    │
│  └─────────────────┘   └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Branch model

| Branch      | Environment | Resource Group           |
| ----------- | ----------- | ------------------------ |
| `main`    | Production  | `retrotool-prod-rg`    |
| `staging` | Staging     | `retrotool-staging-rg` |
| `develop` | Develop     | `retrotool-develop-rg` |

Each environment has its own App Service, ACR, Static Web App, and Managed Identity. PostgreSQL Flexible Server is per-environment.

### Infrastructure (Bicep — CLI only)

Infrastructure is provisioned manually via Azure CLI + Bicep templates in the `infra/` folder. See [infra/README.md](infra/README.md) for full commands and outputs.

```powershell
# Preview changes
az deployment sub what-if --location southafricanorth --template-file infra/deploy.bicep --parameters environment=prod ...

# Deploy
az deployment sub create --location southafricanorth --template-file infra/deploy.bicep --parameters environment=prod ...
```

### CI/CD (GitHub Actions)

- [.github/workflows/ci.yml](.github/workflows/ci.yml) — lint, type-check, test on all PRs
- [.github/workflows/deploy-api.yml](.github/workflows/deploy-api.yml) — builds Docker image, pushes to ACR, deploys to App Service
- [.github/workflows/deploy-ui.yml](.github/workflows/deploy-ui.yml) — builds Vite, deploys to Azure Static Web App
- [.github/workflows/deploy-convex.yml](.github/workflows/deploy-convex.yml) — deploys Convex functions to the self-hosted App Service backend
- [.github/workflows/release-please.yml](.github/workflows/release-please.yml) — automated release PRs / changelog
- [.github/workflows/release-staging.yml](.github/workflows/release-staging.yml) — staging release automation

### Deployment checklist

- [ ] Infrastructure provisioned via `infra/deploy.bicep` for the target environment
- [ ] GitHub environment secrets set (from Bicep outputs): `ACR_LOGIN_SERVER`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- [ ] App Service application settings configured (auth, DB, Convex, email, VAPID, OAuth)
- [ ] Database migrations run (`pnpm --dir retro-tool-api db:migrate:prod`)
- [ ] Prod-safe seeds applied (`pnpm --dir retro-tool-api db:seed:prod`)
- [ ] OIDC federated credentials configured for GitHub Actions
- [ ] Custom domains and SSL configured
- [ ] OAuth redirect URIs updated in App Registration

> Full step-by-step: [infra/README.md](infra/README.md) · OIDC setup: [infra/README-oidc.md](infra/README-oidc.md)

---

## Documentation Index

### Project-wide

| Document                                                                                    | Description                                                                        |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [docs/security/rbac.md](docs/security/rbac.md)                                               | Complete role and permission matrices                                              |
| [docs/workflows/app-flows.md](docs/workflows/app-flows.md)                                   | Every major user-facing flow (auth, org, team, retro, estimates)                   |
| [docs/workflows/invitations-and-onboarding.md](docs/workflows/invitations-and-onboarding.md) | Invitation system (org + team), accept-invite journey, onboarding & password rules |
| [docs/deployment/convex-self-hosting.md](docs/deployment/convex-self-hosting.md)             | Running Convex in Docker (local + production)                                      |
| [docs/future-roadmap.md](docs/future-roadmap.md)                                             | Planned features: IceBreakers, AI summaries, Jira/ADO export, SAML                 |

### Infrastructure & Deployment

| Document                                                                                              | Description                                                                    |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [infra/README.md](infra/README.md)                                                                     | Bicep deployment commands, what-if, outputs, post-provisioning checklist       |
| [infra/README-oidc.md](infra/README-oidc.md)                                                           | OIDC federated-credential setup for GitHub Actions                             |
| [docs/deployment/azure-provisioning.md](docs/deployment/azure-provisioning.md)                         | Full provisioning walkthrough                                                  |
| [docs/deployment/azure-resources.md](docs/deployment/azure-resources.md)                               | Azure resource inventory and architecture                                      |
| [docs/deployment/convex-azure-self-hosting-plan.md](docs/deployment/convex-azure-self-hosting-plan.md) | Plan for self-hosting Convex on Azure App Service                              |
| [docs/deployment/convex-staging-runbook.md](docs/deployment/convex-staging-runbook.md)                 | Staging Convex deployment runbook                                              |
| [docs/deployment/release-and-branch-strategy.md](docs/deployment/release-and-branch-strategy.md)       | Branch model, release-please versioning, conventional commits, deploy triggers |

### Backend

| Document                                            | Description                                                  |
| --------------------------------------------------- | ------------------------------------------------------------ |
| [retro-tool-api/README.md](retro-tool-api/README.md) | API setup, modules, auth, seed credentials, WebSocket events |

### Frontend

| Document                                          | Description                                 |
| ------------------------------------------------- | ------------------------------------------- |
| [retro-tool-ui/README.md](retro-tool-ui/README.md) | UI setup, route map, RBAC helpers, realtime |

### Realtime

| Document                                                                        | Description                                     |
| ------------------------------------------------------------------------------- | ----------------------------------------------- |
| [docs/deployment/convex-self-hosting.md](docs/deployment/convex-self-hosting.md) | Running Convex in Docker (local and production) |
| [convex-backend/README.md](convex-backend/README.md)                             | Convex backend setup and modules                |

---

## Prerequisites

- Node.js 22 (`engines.node >= 22`)
- pnpm 11 (repo pins `pnpm@11.13.0` via `packageManager`)
- Docker Desktop
- Git

Optional:

- Azure CLI — for deployment
- `npx web-push generate-vapid-keys` — for push notifications
