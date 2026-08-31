<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# AGENTS.md — Retro Tool

Orientation guide for AI agents working in this codebase. Read this before making any changes.
The canonical execution workflow is [docs/guidelines/ai-agent-guidelines.md](docs/guidelines/ai-agent-guidelines.md).

---

## Mandatory checks after every code change

Run these after **every** edit. The pre-commit hooks run lint-staged (ESLint + Prettier) and will block commits if these fail.

```bash
# Type-check
pnpm --filter retro-tool-api type-check
pnpm --filter retro-tool-ui  type-check

# Lint + auto-fix (mirrors what lint-staged runs on commit)
pnpm --filter retro-tool-api lint
pnpm --filter retro-tool-ui  lint
```

### Common lint errors to avoid

| Error | Fix |
| --- | --- |
| `@typescript-eslint/consistent-type-imports` | Never use inline `import()` types in generics. Import the type at the top with `import type { Foo }` and reference `Foo` directly. |
| `react-hooks/exhaustive-deps` (unknown rule) | This rule is **not** in the project ESLint config — never add `// eslint-disable-next-line react-hooks/exhaustive-deps` comments. |

---

## What this project is

**Retro Tool** is a collaborative agile platform for engineering teams — retrospective boards, real-time story estimation, org/team management, reports, email workflows, and push notifications. It is a **pnpm monorepo** with three apps and one shared package.

---

## Monorepo structure

```
retro-tool/
├── convex-backend/        # Convex realtime projection layer (TypeScript)
├── packages/shared/contracts/  # Shared type contracts (UI ↔ Convex)
├── retro-tool-api/        # NestJS 11 REST backend
├── retro-tool-ui/         # React 19 + TanStack Router frontend
├── docker/                # docker-compose for local stack
└── docs/                  # Project-wide documentation (see References below)
```

---

## Architecture — the one rule you must not break

**PostgreSQL (via NestJS) is the authoritative system of record.** All durable business state lives in Postgres. Convex stores *only* active collaboration snapshots that NestJS pushes after each mutation. Never write business logic into Convex mutations — the API owns all writes.

```
Browser  ──REST/HTTP──►  NestJS API  ──writes──►  PostgreSQL
NestJS   ──HTTP POST──►  Convex      ──pushes──►  subscribed browsers (WebSocket)
```

Convex is a **read-only projection layer** from the perspective of the application. The NestJS `*-projection-sync.service.ts` files are the only thing that should write to Convex.

---

## App-by-app summary

### `retro-tool-api` — NestJS backend

- **Port:** 8000
- **Swagger:** `http://localhost:8000/api/docs`
- **Database:** PostgreSQL 16 via Drizzle ORM (`drizzle/` migrations)
- **Auth:** Better Auth + `@thallesp/nestjs-better-auth` (cookie sessions + OAuth)
- **Realtime projection:** Self-hosted Convex; the API pushes snapshots after mutations

Key NestJS modules:

| Module | Responsibility |
|---|---|
| `auth` | Better Auth config, session guards |
| `organizations` | Org CRUD, member management |
| `teams` | Team CRUD, join requests, membership |
| `retros` | Retro lifecycle, phases, cards, votes, merging |
| `estimates` | Story estimate sessions, rounds, votes |
| `notifications` | In-app notifications, push (VAPID) |
| `email` | Transactional email via Resend |
| `reports` | Analytics endpoint (aggregate stats) |
| `users` | User management, approval, suspend/reactivate |
| `action-items` | Per-retro action items + carry-forward |
| `weekly-digests` | Scheduled weekly digest emails |
| `adapters` | `*-projection-sync.service.ts` — Convex write layer |
| `common` | RBAC helpers, shared enums, context builders |

**RBAC pattern in the API:**

1. `CommonService.buildOrgContext(userId, orgId)` or `buildTeamContext(userId, teamId)` — assembles the permission context from DB.
2. `canPerformOrgAction(ctx, action)` / `canPerformTeamAction(ctx, action)` — pure helper returns boolean.
3. `assertPermission(condition, message)` — throws `ForbiddenException` if false.

Never bypass `assertPermission` — all controllers use it to gate mutations.

---

### `retro-tool-ui` — React 19 frontend

- **Port:** 3000 (Vite dev server)
- **Router:** TanStack Router (file-based — every file under `src/routes/` is a route)
- **Data:** TanStack Query (cache + server state)
- **Auth client:** Better Auth (`src/lib/auth-client.ts`)
- **Styling:** TailwindCSS 4 + Radix UI + shadcn/ui component pattern

Route layout (mirrors the sidebar):

| Route prefix | Section |
|---|---|
| `/auth/*` | Sign-in, sign-up, OAuth callback, verify email, password reset |
| `/dashboard/*` | Personal dashboard, profile, security, sessions, settings |
| `/organizations/*` | Org list + org detail (`$orgId`) |
| `/teams/*` | Team list + team detail (`$teamId`) |
| `/retros/*` | Retro list, new retro, retro board (`$retroId`) |
| `/estimate/*` | Estimate session list, new session, session board (`$sessionId`) |
| `/reports` | Analytics |
| `/templates` | Retro template browser |
| `/admin/*` | System admin panel (users, orgs, templates, team roles, org setup) |

**Realtime feature flags** (set in `.env`):

```env
VITE_RETROS_REALTIME_BACKEND=convex
VITE_ESTIMATES_REALTIME_BACKEND=convex
VITE_NOTIFICATIONS_REALTIME_BACKEND=convex
```

Convex-sync components sit alongside their route and are named `*-convex-sync.tsx`. They are responsible only for subscribing to Convex queries and calling the NestJS API to trigger syncs.

**File naming:** UI source files use **`kebab-case`** (`notification-bell.tsx`, `use-current-user.ts`). The file name is kebab; the export keeps idiomatic case — components `PascalCase`, hooks `useCamelCase` (file prefixed `use-`). Route files under `src/routes/` are the exception — TanStack Router names them (`index.tsx`, `$teamId.tsx`, `__root.tsx`). Skeletons use `skeleton/index.tsx` (route group) or `<name>.skeleton.tsx` (single route). Full reference: [docs/guidelines/file-naming-conventions.md](docs/guidelines/file-naming-conventions.md).

**RBAC in the UI:**

The frontend mirrors all backend RBAC types and helpers in `src/lib/rbac.ts`. Use those helpers to show/hide UI elements — do not re-implement permission logic inline.

---

### `convex-backend` — Convex realtime layer

- **Self-hosted port:** 3210 (local); also self-hosted on Azure App Service for staging & production — no environment uses Convex Cloud (`develop` isn't a deployed environment at all; it runs locally)
- **Dashboard:** `http://localhost:6791` (local)

Convex modules:

| File | What it stores | Browser queries |
|---|---|---|
| `liveRetros.ts` | Retro board snapshots, session state, presence, typing, ready status | `getRetroBoard` |
| `liveEstimates.ts` | Estimate session snapshots, session state, presence | `getEstimateBoard` |
| `liveNotifications.ts` | Per-user notification projection | `getUserNotifications` |
| `liveReports.ts` | Aggregate B-trees (retros, cards, votes, action items) | `getTeamStats`, `getUserStats`, `getSystemStats` |
| `rateLimits.ts` | Token-bucket and fixed-window write guards | — |

**Critical:** Before editing any file in `convex-backend/convex/`, read `convex-backend/convex/_generated/ai/guidelines.md` — it overrides general Convex training data.

---

## Retro phases (state machine)

```
draft → waiting → active → grouping → voting → discussing → completed
```

Phase transitions are driven by separate API endpoints, followed by projection updates for participants. Only the retro creator or a team-lead/admin can advance phases.

---

## RBAC quick reference

Two parallel role dimensions:

**System roles** (on `user.role`):
```
super-admin > system-admin > member
```

**Context roles** (on membership tables):
```
Org:  org-owner > org-admin > member
Team: team-lead > member
```

The first user to sign up is auto-bootstrapped as `super-admin`. All subsequent users start `pending` and require admin approval before they can access the platform.

Full permission matrices → [docs/security/authorization-rbac.md](docs/security/authorization-rbac.md)

---

## Key user flows — reference

Detailed step-by-step flows for every major feature are in [docs/workflows/app-flows.md](docs/workflows/app-flows.md):

- Auth: sign-up, OAuth, sign-in, email verification, password reset, sign-out
- User approval lifecycle (pending → approved / rejected / suspended)
- Organization management: create, invite, remove member, change role
- Team management: create, join request, add/remove member
- Retro: create, all phase transitions, cards/votes/merges, discussion, carry-forward, complete + report
- Estimates: create session, join, vote/reveal, reset round
- Notifications: in-app + push (VAPID) subscribe/receive/unsubscribe

---

## Environment variables — summary

### `retro-tool-api/.env`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | API base URL |
| `FRONTEND_URL` | CORS origin |
| `CONVEX_SYNC_URL` | Convex Admin API URL |
| `CONVEX_SYNC_ADMIN_KEY` | Convex admin key |
| `RESEND_API_KEY` | Email provider |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push notifications |
| `ENABLE_CRON_JOBS` | Enable scheduler (weekly digest, reminders) |

### `retro-tool-ui/.env`

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | NestJS API base URL |
| `VITE_CONVEX_URL` | Convex backend URL |
| `VITE_*_REALTIME_BACKEND` | Use `convex`; the legacy `socket-io` value disables Convex but has no API Socket.IO server |

### `convex-backend/.env`

| Variable | Purpose |
|---|---|
| `CONVEX_SELF_HOSTED_URL` | Self-hosted Convex URL |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | Self-hosted admin key |
| `CONVEX_BETTER_AUTH_URL` | Better Auth URL for JWT validation |

---

## Common commands

```bash
pnpm install              # install all dependencies
pnpm local:up             # full Docker stack
pnpm local:infra          # infra only (Postgres + self-hosted Convex)
pnpm dev:api              # NestJS watch mode
pnpm dev:ui               # Vite dev server
pnpm dev:convex           # Convex function watcher
pnpm build                # build all packages
pnpm type-check           # type-check all packages
pnpm test                 # run all tests

# Database (API)
pnpm --dir retro-tool-api db:generate
pnpm --dir retro-tool-api db:migrate
pnpm --dir retro-tool-api db:seed
```

---

## Documentation index

| Document | What it covers |
|---|---|
| [docs/security/authorization-rbac.md](docs/security/authorization-rbac.md) | Full permission matrices, helper functions, user status lifecycle |
| [docs/security/backend-api.md](docs/security/backend-api.md) | API hardening: Helmet, rate limiting, CORS, CSRF posture/residual risk |
| [docs/guidelines/file-naming-conventions.md](docs/guidelines/file-naming-conventions.md) | UI file naming (kebab-case files, idiomatic export names, route-file exception) |
| [docs/workflows/app-flows.md](docs/workflows/app-flows.md) | Every major user-facing flow end-to-end |
| [docs/security/authentication.md](docs/security/authentication.md) | Every sign-in method + credential model + per-flow file traces |
| [docs/security/frontend.md](docs/security/frontend.md) | UI security: token storage, XSS/CSP posture, route/RBAC gating |
| [docs/security/database.md](docs/security/database.md) | DB security: TLS, credential injection, SQL-injection posture, no-RLS reality |
| [docs/database/schema.md](docs/database/schema.md) | Tables by domain (columns, keys, FKs, indexes), enums, ER diagram |
| [docs/architecture/overview.md](docs/architecture/overview.md) | System architecture — components, data flow, tech stack |
| [docs/infra/provisioning.md](docs/infra/provisioning.md) | Azure deployment step-by-step (Bicep), incl. the self-hosted Convex stack |
| [docs/deployment/azure-resources.md](docs/deployment/azure-resources.md) | Azure resource inventory (legacy-named production snapshot) |
| [docs/deployment/convex-self-hosting.md](docs/deployment/convex-self-hosting.md) | Running Convex in Docker |
| [docs/workflows/running-the-app.md](docs/workflows/running-the-app.md) | Running locally / against staging / against production |
| [docs/future-roadmap.md](docs/future-roadmap.md) | Planned: AI summaries, Jira/ADO export, SAML, Team Spaces |
| [docs/README.md](docs/README.md) | Documentation index — all docs by domain |
| [retro-tool-api/README.md](retro-tool-api/README.md) | API setup, seed credentials |
| [retro-tool-ui/README.md](retro-tool-ui/README.md) | UI setup, route map |
| [convex-backend/README.md](convex-backend/README.md) | Convex package notes |
| [convex-backend/convex/_generated/ai/guidelines.md](convex-backend/convex/_generated/ai/guidelines.md) | **Must read before editing Convex code** |

---

## Deployment

- **Platform:** Azure (Static Web App for UI, App Service for API, self-hosted Convex on its own App Service for realtime — staging & production only; `develop` has no Azure deployment and runs entirely locally)
- **Branches:** `staging` → staging environment; `main` → production
- **CI/CD:** GitHub Actions (`.github/workflows/deploy-api.yml`, `deploy-ui.yml`)
- **Prerequisites:** run `db:migrate` + `db:seed:templates` before first start in any environment

---

## Prerequisites

- Node.js 22
- pnpm 9+
- Docker Desktop
