# Retro Tool

A collaborative agile retrospective and story-estimation platform. Built for engineering teams who want structured, real-time retrospectives with role-based access control, live story estimates, actionable reporting, and automated email workflows.

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Who Uses It — Roles & Permissions](#who-uses-it--roles--permissions)
3. [Architecture Overview](#architecture-overview)
4. [Convex Realtime Layer](#convex-realtime-layer)
5. [Monorepo Structure](#monorepo-structure)
6. [Tech Stack](#tech-stack)
7. [Local Development](#local-development)
8. [Environment Setup](#environment-setup)
9. [Database & Seed Workflow](#database--seed-workflow)
10. [Workspace Commands](#workspace-commands)
11. [Deployment](#deployment)
12. [Documentation Index](#documentation-index)

---

## What It Does

Retro Tool provides everything a team needs to run effective agile ceremonies:

| Feature | Description |
| --- | --- |
| **Retrospectives** | Phased retro boards (brainstorm → group → vote → discuss → action items) with built-in templates (Start/Stop/Continue, 4Ls, Mad/Sad/Glad, and more) |
| **Story Estimates** | Real-time story-estimation sessions with reveal mechanics and consensus tracking |
| **Organizations & Teams** | Hierarchical org → team → member structure with fine-grained RBAC |
| **Action Items** | Per-retro action items with carry-forward tracking across sessions |
| **Reports & Analytics** | Live dashboards for retro completion rates, card counts, vote counts, and action item health — powered by Convex aggregates |
| **Notifications** | In-app notification centre + browser push notifications (VAPID) |
| **Email Workflows** | Retro reminders, weekly digests, and transactional email via Resend |
| **Multi-Session Auth** | Email/password + OAuth (Microsoft, Google) via Better Auth with multi-session support |

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

> Full permission matrices are in [docs/RBAC.md](docs/RBAC.md) and [retro-tool-api/docs/RBAC.md](retro-tool-api/docs/RBAC.md).

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
│  Redis (cache / sessions)           │           │                  
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
│  liveReports (aggregate B-trees)  · rateLimits               │
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

| Module | What it stores | Queries exposed to browser |
| --- | --- | --- |
| `liveRetros.ts` | Active retro board snapshot (cards, votes, phase, participants) | `getRetroBoard` |
| `liveEstimates.ts` | Active estimate session snapshot (stories, votes, reveal state) | `getEstimateBoard` |
| `liveNotifications.ts` | Per-user notification projection | `getUserNotifications` |
| `liveReports.ts` | Aggregate B-trees for stats (retros completed, cards, votes, action items) | `getTeamStats`, `getUserStats`, `getSystemStats` |
| `rateLimits.ts` | Token-bucket and fixed-window guards on every upsert | — |

### Feature Flags

The UI chooses its realtime backend per feature via Vite env vars:

```env
VITE_RETROS_REALTIME_BACKEND=convex      # or: socket-io
VITE_ESTIMATES_REALTIME_BACKEND=convex   # or: socket-io
```

Socket.IO remains the fallback transport when either flag is set to `socket-io`.

> Deep dive: [plan-convex-realtime.md](plan-convex-realtime.md) · [docs/convex-components.md](docs/convex-components.md) · [convex-backend/README.md](convex-backend/README.md)

---

## Monorepo Structure

```
.
├── convex-backend/           # Self-hosted Convex functions and schema
│   └── convex/
│       ├── schema.ts         # Convex document schema
│       ├── liveRetros.ts     # Retro board queries + mutations
│       ├── liveEstimates.ts  # Estimate board queries + mutations
│       ├── liveNotifications.ts
│       ├── liveReports.ts    # Aggregate-powered stats
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
│   │   ├── notifications/    # In-app + push notifications
│   │   ├── email/            # Transactional email (Resend)
│   │   ├── reports/          # Analytics endpoints
│   │   └── adapters/         # Convex projection sync services
│   └── drizzle/              # Database migrations
│
├── retro-tool-ui/            # React 19 frontend
│   └── src/
│       ├── routes/           # File-based routing (TanStack Router)
│       ├── components/       # Shared UI components
│       ├── hooks/            # Auth, push, theme hooks
│       └── lib/              # API client, RBAC helpers
│
├── docker/
│   └── docker-compose.local.yml
│
├── docs/                     # Project-wide documentation
└── scripts/                  # Deployment and admin scripts
```

---

## Tech Stack

### Frontend — `retro-tool-ui`

| Layer | Technology |
| --- | --- |
| Framework | React 19 |
| Routing | TanStack Router (file-based) |
| Data fetching | TanStack Query |
| Forms | TanStack Form |
| Tables | TanStack Table |
| Auth client | Better Auth (`better-auth/client`) |
| UI primitives | Radix UI |
| Styling | TailwindCSS 4 |
| Charts | Recharts |
| Realtime | Socket.IO client + Convex React SDK |
| Validation | Zod |

> Full details: [retro-tool-ui/README.md](retro-tool-ui/README.md)

### Backend — `retro-tool-api`

| Layer | Technology |
| --- | --- |
| Runtime | Node.js + TypeScript |
| Framework | NestJS 11 |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Auth | Better Auth + `@thallesp/nestjs-better-auth` |
| WebSockets | Socket.IO |
| Validation | class-validator + Zod |
| Email | Resend |
| Push notifications | web-push (VAPID) |
| Scheduler | `@nestjs/schedule` (cron jobs) |

> Full details: [retro-tool-api/README.md](retro-tool-api/README.md)

### Realtime — `convex-backend`

| Layer | Technology |
| --- | --- |
| Runtime | Self-hosted Convex |
| Functions | TypeScript queries + mutations |
| Rate limiting | `@convex-dev/rate-limiter` |
| Aggregates | `@convex-dev/aggregate` |
| Auth bridge | Better Auth JWT |

> Full details: [convex-backend/README.md](convex-backend/README.md) · [plan-convex-realtime.md](plan-convex-realtime.md)

---

## Local Development

There are two ways to run the project locally.

### Option 1 — Full Docker stack (fastest start)

```powershell
pnpm local:up
```

Services exposed:

| Service | URL | Notes |
| --- | --- | --- |
| UI | `http://localhost:3000` | nginx-served frontend |
| API | `http://localhost:8000` | NestJS backend |
| Swagger | `http://localhost:8000/api/docs` | Interactive API docs |
| PostgreSQL | `localhost:5432` | seeded on first start |
| Redis | `localhost:6379` | cache layer |
| Convex API | `http://localhost:3210` | self-hosted Convex backend |
| Convex dashboard | `http://localhost:6791` | local Convex UI |

### Option 2 — Hybrid pnpm (live reload)

Start infrastructure containers first:

```powershell
pnpm local:infra
```

Then run each app process:

```powershell
pnpm dev:api       # NestJS with watch mode
pnpm dev:ui        # Vite dev server
pnpm dev:convex    # Convex function watcher
```

### VS Code Tasks

Use `Terminal: Run Task` to launch any of the pre-configured tasks:

| Task | What it starts |
| --- | --- |
| `Local Infra` | PostgreSQL + Redis containers only |
| `API Dev` | NestJS in watch mode |
| `UI Dev` | Vite dev server |
| `Convex Dev` | Convex function watcher |
| `Local App Dev` | Infra + API + UI in parallel |
| `Local App Dev With Convex` | Infra + API + UI + Convex in parallel |
| `Local Docker Stack` | Full container stack |

---

## Environment Setup

### 1. Install dependencies

```powershell
pnpm install
```

### 2. API environment

```powershell
Copy-Item retro-tool-api/.env.example retro-tool-api/.env
```

Key variables in [retro-tool-api/.env.example](retro-tool-api/.env.example):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Must match server URL + port |
| `FRONTEND_URL` | CORS allowed origin |
| `REDIS_URL` | Redis connection string |
| `CONVEX_SYNC_URL` | Convex HTTP Admin API URL |
| `CONVEX_SYNC_ADMIN_KEY` | Convex admin key for projection sync |
| `RESEND_API_KEY` | Transactional email |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Browser push notifications |

> See [retro-tool-api/docs/Email.md](retro-tool-api/docs/Email.md) for email setup. See [retro-tool-api/docs/Cache.md](retro-tool-api/docs/Cache.md) for Redis/cache details.

### 3. UI environment

```powershell
Copy-Item retro-tool-ui/.env.example retro-tool-ui/.env
```

Key variables in [retro-tool-ui/.env.example](retro-tool-ui/.env.example):

```env
VITE_API_URL=http://localhost:8000
VITE_CONVEX_URL=http://localhost:3210
VITE_RETROS_REALTIME_BACKEND=socket-io     # or: convex
VITE_ESTIMATES_REALTIME_BACKEND=socket-io  # or: convex
```

Switch either `BACKEND` flag to `convex` to test Convex-driven real-time locally.

### 4. Convex environment

```powershell
Copy-Item convex-backend/.env.example convex-backend/.env
```

Variables: `CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`, `CONVEX_CLOUD_URL`, `CONVEX_DEPLOYMENT`.

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

The project targets **Azure** with a CI/CD pipeline driven by GitHub Actions.

### Deployment model

```
┌─────────────────────────────────────────────────────────────┐
│                        AZURE                                │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │ Static Web App   │    │ App Service (Linux)          │  │
│  │ (React UI)       │    │ (NestJS API — zip deploy)    │  │
│  └──────────────────┘    └──────────────────────────────┘  │
│                                    │                        │
│              ┌────────────────────┬┘                        │
│              ▼                    ▼                         │
│  ┌─────────────────┐   ┌──────────────────────────────┐    │
│  │ PostgreSQL      │   │ Convex Cloud                 │    │
│  │ Flexible Server │   │ (managed, per environment)   │    │
│  │ (shared)        │   └──────────────────────────────┘    │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

### Branch model

| Branch | Environment |
| --- | --- |
| `staging` | Staging (Free F1 App Service) |
| `main` | Production (target: S1 Standard) |

Both environments share one PostgreSQL Flexible Server. Convex functions are deployed to **Convex Cloud** (not self-hosted) in production.

### CI/CD

- [.github/workflows/deploy-api.yml](.github/workflows/deploy-api.yml) — builds and deploys the NestJS API
- [.github/workflows/deploy-ui.yml](.github/workflows/deploy-ui.yml) — builds and deploys the React UI

> The workflows are scaffolds. Replace placeholder Azure tenant, subscription, App Service name, and Static Web App token values before first deployment.

### Deployment checklist

- [ ] `BETTER_AUTH_SECRET`, `DATABASE_URL`, `CONVEX_SYNC_URL`, `CONVEX_SYNC_ADMIN_KEY` set in App Service config
- [ ] All UI `VITE_*` values and Convex feature flags set for each environment
- [ ] Database migrations run (`pnpm db:migrate`) before first start
- [ ] `pnpm db:seed:templates` run to load built-in retro templates
- [ ] VAPID keys generated and set if push notifications are enabled
- [ ] Resend API key configured if email workflows are enabled

> Full step-by-step: [docs/deployment-guide.md](docs/deployment-guide.md) · Azure resources: [docs/azure-cloud-resources.md](docs/azure-cloud-resources.md)

---

## Documentation Index

### Project-wide

| Document | Description |
| --- | --- |
| [docs/RBAC.md](docs/RBAC.md) | Complete role and permission matrices |
| [docs/app-flows.md](docs/app-flows.md) | Every major user-facing flow (auth, org, team, retro, estimates) |
| [docs/deployment-guide.md](docs/deployment-guide.md) | Step-by-step Azure deployment |
| [docs/azure-cloud-resources.md](docs/azure-cloud-resources.md) | Azure resource inventory and cost estimates |
| [docs/local-cloud-testing.md](docs/local-cloud-testing.md) | Testing locally against cloud resources |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common issues and fixes |
| [docs/future-roadmap.md](docs/future-roadmap.md) | Planned features: IceBreakers, AI summaries, Jira/ADO export, SAML |

### Backend

| Document | Description |
| --- | --- |
| [retro-tool-api/README.md](retro-tool-api/README.md) | API setup, modules, auth, seed credentials |
| [retro-tool-api/docs/RBAC.md](retro-tool-api/docs/RBAC.md) | Backend permission guards reference |
| [retro-tool-api/docs/Email.md](retro-tool-api/docs/Email.md) | Email workflow setup (Resend) |
| [retro-tool-api/docs/Cache.md](retro-tool-api/docs/Cache.md) | Redis caching strategy |

### Frontend

| Document | Description |
| --- | --- |
| [retro-tool-ui/README.md](retro-tool-ui/README.md) | UI setup, route map, RBAC helpers |
| [retro-tool-ui/docs/Email.md](retro-tool-ui/docs/Email.md) | Email-related UI flows |
| [retro-tool-ui/docs/Cache.md](retro-tool-ui/docs/Cache.md) | TanStack Query cache strategy |

### Realtime

| Document | Description |
| --- | --- |
| [plan-convex-realtime.md](plan-convex-realtime.md) | Convex architecture, data flow, and rollout plan |
| [docs/convex-components.md](docs/convex-components.md) | Rate limiter, aggregate, and auth bridge reference |
| [docs/convex-self-hosting.md](docs/convex-self-hosting.md) | Running Convex in Docker (local and production) |
| [convex-backend/README.md](convex-backend/README.md) | Convex package notes |

---

## Prerequisites

- Node.js 22
- pnpm 9
- Docker Desktop
- Git

Optional:

- Azure CLI — for deployment
- `npx web-push generate-vapid-keys` — for push notifications
