# CLAUDE.md — Retro Tool

This is a **pnpm monorepo** containing three applications and one shared package. Read this file before touching any code.

---

## Terminology rules

- **Never use "planning poker"** — the correct term throughout this codebase is **"story estimate"** (or "story estimates"). This applies to UI text, comments, docs, template names, and variable/function names.

---

## Git commit rules

- **Never add a `Co-Authored-By: Claude` trailer** (or any Claude/Anthropic co-author line) to commit messages. Commits are authored solely under the repo owner's git identity, with no AI attribution in the body.

---

## Code conventions

### API module structure

Each NestJS module in `retro-tool-api/src/` follows this pattern:

```
module-name/
├── module-name.module.ts
├── module-name.controller.ts
├── module-name.service.ts
├── module-name.gateway.ts       # (if WebSocket events)
├── dto/                         # Request/response DTOs
├── types/
│   └── index.ts                 # All module-specific TypeScript types
├── schema.ts                    # Drizzle table definitions
└── guards/                      # (if module-specific guards)
```

**Types must live in `types/index.ts`** — not in loose `*.types.ts` files.

### UI file naming

Frontend source files (`retro-tool-ui/src/`) use **`kebab-case`** file names — `notification-bell.tsx`,
`use-current-user.ts`, `api-endpoints.ts`. The **file name is kebab; the export keeps its idiomatic
case** — React components stay `PascalCase` (`export function NotificationBell()`), hooks stay
`useCamelCase` (`export function useCurrentUser()`), prefixed `use-` on the file too. Module-specific
types live in a colocated `types/index.ts`.

**Exception:** files under `routes/` that define routes are named by TanStack Router (`index.tsx`,
`$teamId.tsx`, `__root.tsx`, …) — leave those as the router expects. Skeletons follow
`skeleton/index.tsx` (route group) or `<name>.skeleton.tsx` (single route).

Full reference: [docs/guidelines/file-naming-conventions.md](docs/guidelines/file-naming-conventions.md).

---

## Quick-start commands

```bash
# Install all workspace dependencies
pnpm install

# Start full local stack (Docker)
pnpm local:up

# Start only infra (Postgres + self-hosted Convex) then run apps natively
pnpm local:infra
pnpm dev:api       # NestJS on :8000
pnpm dev:ui        # Vite on :3000
pnpm dev:convex    # Convex function watcher
```

### Per-package commands (run from repo root)

```bash
pnpm --filter retro-tool-api  dev             # API watch mode
pnpm --filter retro-tool-api  test            # Jest unit tests
pnpm --filter retro-tool-api  test:ci         # Jest (serial, for CI)
pnpm --filter retro-tool-api  type-check
pnpm --filter retro-tool-api  lint

pnpm --filter retro-tool-ui   dev             # Vite dev server
pnpm --filter retro-tool-ui   test            # Vitest
pnpm --filter retro-tool-ui   type-check
pnpm --filter retro-tool-ui   lint

pnpm --filter convex-backend  dev             # Convex watcher
pnpm --filter convex-backend  deploy          # Deploy to Convex Cloud
```

### Running locally against remote environments

```bash
# Against staging (loads .env.staging-local)
pnpm dev:api:staging
pnpm dev:ui:staging
pnpm dev:convex:staging

# Against production (loads .env.production-local)
pnpm dev:api:prod
pnpm dev:ui:prod
pnpm dev:convex:prod
```

---

## After every code change — mandatory checks

Run these after **every** code generation or edit to catch issues before commit. The pre-commit hooks run lint-staged (ESLint + Prettier) and will block commits if these fail.

```bash
# Type-check both apps
pnpm --filter retro-tool-api type-check
pnpm --filter retro-tool-ui  type-check

# Lint + auto-fix both apps (mirrors what lint-staged runs on commit)
pnpm --filter retro-tool-api lint
pnpm --filter retro-tool-ui  lint
```

### Common lint errors to avoid

| Error | Fix |
| --- | --- |
| `@typescript-eslint/consistent-type-imports` | Never use inline `import()` types in generics. Import the type at the top of the file with `import type { Foo }` and reference `Foo` directly. |
| `react-hooks/exhaustive-deps` (unknown rule) | This rule is **not** in the project ESLint config — never add `// eslint-disable-next-line react-hooks/exhaustive-deps` comments. Remove them if found. |

### Database commands (API package)

```bash
pnpm --dir retro-tool-api db:generate             # generate Drizzle migration
pnpm --dir retro-tool-api db:migrate              # apply migrations
pnpm --dir retro-tool-api db:seed                 # seed all (templates + roles + demo users)
pnpm --dir retro-tool-api db:seed:templates       # retro + estimate templates (idempotent)
pnpm --dir retro-tool-api db:seed:templates:staging # templates against staging
pnpm --dir retro-tool-api db:seed:templates:prod  # templates against production
pnpm --dir retro-tool-api db:seed:staging         # all prod-safe seeds against staging
pnpm --dir retro-tool-api db:seed:prod            # all prod-safe seeds against production
pnpm --dir retro-tool-api db:studio               # Drizzle Studio in browser
```

### Workspace-wide

```bash
pnpm build        # build all packages
pnpm lint         # lint all packages
pnpm type-check   # type-check all packages
pnpm test         # run all test suites

pnpm local:down   # stop containers
pnpm local:logs   # tail container logs
```

---

## Monorepo layout

```
retro-tool/
├── convex-backend/        # Self-hosted Convex realtime projection layer
│   └── convex/
│       ├── schema.ts
│       ├── liveRetros.ts
│       ├── liveEstimates.ts
│       ├── liveNotifications.ts
│       ├── liveReports.ts
│       └── rateLimits.ts
├── packages/
│   └── shared/contracts/  # Shared TypeScript contracts (UI ↔ Convex)
├── retro-tool-api/        # NestJS REST + Socket.IO backend
│   ├── src/
│   │   ├── auth/
│   │   ├── organizations/
│   │   ├── teams/
│   │   ├── retros/
│   │   ├── estimates/
│   │   ├── estimate-templates/
│   │   ├── notifications/
│   │   ├── email/
│   │   ├── reports/
│   │   ├── users/
│   │   ├── user-preferences/
│   │   ├── action-items/
│   │   ├── invitations/
│   │   ├── sessions/
│   │   ├── team-roles/
│   │   ├── convex-admin/
│   │   ├── adapters/      # Socket.IO adapter
│   │   ├── common/        # Shared guards, interceptors, types
│   │   ├── config/
│   │   ├── database/
│   │   ├── lib/
│   │   └── seed/
│   └── drizzle/           # DB migrations
├── retro-tool-ui/         # React 19 + TanStack Router frontend
│   └── src/
│       ├── routes/        # File-based routing
│       ├── components/
│       ├── hooks/
│       └── lib/
├── infra/                 # Azure Bicep IaC (CLI-only deployment)
│   ├── deploy.bicep       # Subscription-scoped entry point
│   ├── main.bicep         # All resources
│   ├── README.md          # Full deployment docs
│   └── README-prod.md    # Production-specific runbook
├── docker/
│   └── docker-compose.local.yml
├── .github/workflows/
│   ├── ci.yml             # Lint + type-check + test
│   ├── deploy-api.yml     # Build & push API container to Azure
│   └── deploy-ui.yml     # Deploy UI to Static Web App
└── docs/
```

---

## Environment files

Copy these before first run:

```bash
cp retro-tool-api/.env.example    retro-tool-api/.env.local
cp retro-tool-ui/.env.example     retro-tool-ui/.env.local
cp convex-backend/.env.example    convex-backend/.env.local
cp docker/.env.example            docker/.env
```

### Environment file strategy

Each package has multiple env files for different contexts:

| File | Purpose |
|---|---|
| `.env.local` | Local dev with local infra (Docker) — **not committed** |
| `.env.staging-local` | Local dev running against staging Azure resources |
| `.env.production-local` | Local dev running against production Azure resources |
| `.env.example` | Template for local development |

**Key API env vars** (`retro-tool-api/.env.local`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing secret (generate: `openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | Must match API URL (`http://localhost:8000`) |
| `FRONTEND_URL` | CORS allowed origin |
| `CONVEX_SYNC_URL` | Convex Admin API URL |
| `CONVEX_SYNC_ADMIN_KEY` | Convex admin key for projection writes |
| `RESEND_API_KEY` | Transactional email |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push notifications |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | OAuth provider |

**Key UI env vars** (`retro-tool-ui/.env.local`):

```env
VITE_API_URL=http://localhost:8000
VITE_CONVEX_URL=http://localhost:3210
VITE_RETROS_REALTIME_BACKEND=convex       # or: socket-io
VITE_ESTIMATES_REALTIME_BACKEND=convex    # or: socket-io
VITE_NOTIFICATIONS_REALTIME_BACKEND=convex
```

### Env loading in NestJS

The API uses `ConfigModule.forRoot` with `envFilePath: ['.env.local', '.env']`. When running `dev:staging` or `dev:prod`, `dotenv-cli` pre-loads the environment-specific file — `ConfigModule` won't overwrite existing `process.env` vars, so the dotenv-cli values take precedence.

---

## Tech stack at a glance

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Router (file-based), TanStack Query/Form/Table |
| Styling | TailwindCSS 4, Radix UI primitives, shadcn/ui pattern |
| Auth client | Better Auth |
| Realtime (UI) | Socket.IO client + Convex React SDK |
| API | NestJS 11, TypeScript |
| Database | PostgreSQL 16 via Drizzle ORM |
| Auth server | Better Auth + `@thallesp/nestjs-better-auth` |
| WebSockets | Socket.IO |
| Realtime projection | Self-hosted Convex (local) / Convex Cloud (staging & production) |
| Email | Resend |
| Push notifications | web-push (VAPID) |
| Scheduler | `@nestjs/schedule` |
| Validation | class-validator + Zod |
| Infrastructure | Azure Bicep (CLI-only, no IaC in CI) |
| CI/CD | GitHub Actions (ci, deploy-api, deploy-ui) |

---

## Convex guidelines

When editing any file inside `convex-backend/convex/`, **read `convex-backend/convex/_generated/ai/guidelines.md` first**. Those rules override general Convex knowledge from training data.

---

## Key architectural rule

**PostgreSQL is the system of record.** All durable state lives there. Convex holds only active collaboration snapshots that NestJS pushes after each mutation. Never write business logic into Convex mutations — the API owns all writes.

---

## RBAC quick reference

Two role dimensions:

- **System roles**: `super-admin` → `system-admin` → `member`
- **Org roles**: `org-owner` → `org-admin` → `member`
- **Team roles**: `team-lead` → `member`

First sign-up is auto-bootstrapped as `super-admin`. Full matrices: [docs/security/rbac.md](docs/security/rbac.md).

---

## Deployment & environments

Three environments mapped to branches:

| Environment | Branch | Resource Group |
|---|---|---|
| Production | `main` | `retrotool-prod-rg` |
| Staging | `staging` | `retrotool-staging-rg` |
| Develop | `develop` | `retrotool-develop-rg` |

Infrastructure is provisioned via Azure CLI + Bicep (`infra/` folder). See [infra/README.md](infra/README.md) for full commands.

GitHub Actions handle app deployment (not infra):
- **CI** runs on all PRs (lint, type-check, test)
- **deploy-api** builds Docker image → pushes to ACR → deploys to App Service
- **deploy-ui** builds Vite → deploys to Azure Static Web App

---

## Local service URLs

| Service | URL |
|---|---|
| UI | `http://localhost:3000` |
| API | `http://localhost:8000` |
| Swagger | `http://localhost:8000/api/docs` |
| Convex Admin API | `http://localhost:3210` |
| Convex Dashboard | `http://localhost:6791` |
| PostgreSQL | `localhost:5432` |

---

## Documentation reference

### Package READMEs

| Package | README | What it covers |
| --- | --- | --- |
| NestJS API | [retro-tool-api/README.md](retro-tool-api/README.md) | Module list, auth setup, seed credentials, Socket.IO events, all API endpoints |
| React UI | [retro-tool-ui/README.md](retro-tool-ui/README.md) | Route map, RBAC helpers, TanStack Query cache strategy, UI component conventions |
| Convex backend | [convex-backend/README.md](convex-backend/README.md) | Deployment setup, code generation steps, Convex module overview |

### Project-wide docs (`docs/`)

| Document | What it covers |
|---|---|
| [docs/security/rbac.md](docs/security/rbac.md) | Full permission matrices for system, org, team, and retro actions; helper function signatures; user status lifecycle |
| [docs/security/backend-api.md](docs/security/backend-api.md) | API hardening: Helmet, rate limiting (throttler + Better Auth), CORS, and the CSRF posture / residual risk |
| [docs/guidelines/file-naming-conventions.md](docs/guidelines/file-naming-conventions.md) | UI file naming (kebab-case files, idiomatic export names, route-file exception) |
| [docs/workflows/app-flows.md](docs/workflows/app-flows.md) | Step-by-step flows: auth, user approval, org/team management, retro phases, estimates, notifications |
| [docs/security/authentication.md](docs/security/authentication.md) | Every sign-in method (password, email-OTP, passkey, Microsoft OAuth), the credential model, and per-flow file traces (sign-up/in, verification, reset, session validation, sockets, sign-out, RBAC) |
| [docs/security/frontend.md](docs/security/frontend.md) | UI security: token storage, what's exposed to the browser, XSS/CSP posture, route/RBAC gating, residual risk |
| [docs/security/database.md](docs/security/database.md) | DB security: TLS to Azure Postgres, credential injection, SQL-injection posture, no-RLS reality, residual risk |
| [docs/database/schema.md](docs/database/schema.md) | Every table by domain (columns, keys, FKs, indexes), all enums, core entity-relationship diagram |
| [docs/workflows/invitations-and-onboarding.md](docs/workflows/invitations-and-onboarding.md) | Invitation system (org + team), accept-invite journey, acceptance logic, onboarding & password rules |
| [docs/architecture/overview.md](docs/architecture/overview.md) | System architecture design document — components, data flow, tech stack, module tree |
| [docs/architecture/cloud.md](docs/architecture/cloud.md) | Azure cloud architecture — every resource by environment, topology diagram, SKUs, cost posture, deploy workflows |
| [docs/architecture/convex.md](docs/architecture/convex.md) | How the app uses Convex: deployment topology, every key/secret, projection schema, NestJS→Convex sync layer, UI consumption, JWT auth, deploy workflow |
| [docs/architecture/convex-concurrency.md](docs/architecture/convex-concurrency.md) | How the projection layer stays correct under concurrent writes (OCC, point reads, idempotency) |
| [docs/security/convex-nestjs-auth.md](docs/security/convex-nestjs-auth.md) | Deep dive on Convex ↔ NestJS auth: RS256 JWT issue/verify, JWKS exchange, the JWT_ISSUER/AUDIENCE/JWKS_URL config, request lifecycle, vs the admin-key sync path |
| [docs/deployment/convex-self-hosting.md](docs/deployment/convex-self-hosting.md) | Running Convex in Docker (local + production) |
| [docs/workflows/running-the-app.md](docs/workflows/running-the-app.md) | Running the app locally, against staging, and against production |
| [docs/future-roadmap.md](docs/future-roadmap.md) | Planned: IceBreakers, AI summaries, Jira/ADO export, SAML |
| [docs/README.md](docs/README.md) | Documentation index — all docs by domain |
| [infra/README.md](infra/README.md) | Azure Bicep deployment commands, outputs, post-provisioning checklist |
| [infra/README-prod.md](infra/README-prod.md) | Production-specific runbook with App Registration details |
| [docs/deployment/release-and-branch-strategy.md](docs/deployment/release-and-branch-strategy.md) | Branch model, release-please lockstep versioning, conventional commits, and deployment triggers (including the staging-only gap for production) |

### Convex AI guidelines

**Must read before editing any file in `convex-backend/convex/`:**
[convex-backend/convex/_generated/ai/guidelines.md](convex-backend/convex/_generated/ai/guidelines.md)

---

## Prerequisites

- Node.js 22
- pnpm 9+
- Docker Desktop
- Azure CLI (for infrastructure provisioning only)
