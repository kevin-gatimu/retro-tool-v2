# CLAUDE.md — Retro Tool

This is a **pnpm monorepo** containing three applications and one shared package. Read this file before touching any code.

---

## Quick-start commands

```bash
# Install all workspace dependencies
pnpm install

# Start full local stack (Docker)
pnpm local:up

# Start only infra (Postgres, Redis, Convex) then run apps natively
pnpm local:infra
pnpm dev:api       # NestJS on :8000
pnpm dev:ui        # Vite on :3000
pnpm dev:convex    # Convex function watcher
```

### Per-package commands (run from repo root)

```bash
pnpm --filter retro-tool-api  start:dev       # API watch mode
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
pnpm --dir retro-tool-api db:generate        # generate Drizzle migration
pnpm --dir retro-tool-api db:migrate         # apply migrations
pnpm --dir retro-tool-api db:seed            # seed demo data + templates
pnpm --dir retro-tool-api db:seed:templates  # templates only (idempotent)
pnpm --dir retro-tool-api db:studio          # Drizzle Studio in browser
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
│   │   ├── notifications/
│   │   ├── email/
│   │   ├── reports/
│   │   ├── users/
│   │   ├── action-items/
│   │   ├── weekly-digests/
│   │   └── adapters/      # Convex projection sync services
│   └── drizzle/           # DB migrations
├── retro-tool-ui/         # React 19 + TanStack Router frontend
│   └── src/
│       ├── routes/        # File-based routing
│       ├── components/
│       ├── hooks/
│       └── lib/
├── docker/
│   └── docker-compose.local.yml
└── docs/
```

---

## Environment files

Copy these before first run:

```bash
cp retro-tool-api/.env.example    retro-tool-api/.env
cp retro-tool-ui/.env.example     retro-tool-ui/.env
cp convex-backend/.env.example    convex-backend/.env
cp docker/.env.example            docker/.env
```

**Key API env vars** (`retro-tool-api/.env`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing secret (generate: `openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | Must match API URL (`http://localhost:8000`) |
| `FRONTEND_URL` | CORS allowed origin |
| `REDIS_URL` | Redis connection |
| `CONVEX_SYNC_URL` | Convex Admin API URL |
| `CONVEX_SYNC_ADMIN_KEY` | Convex admin key for projection writes |
| `RESEND_API_KEY` | Transactional email |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push notifications |

**Key UI env vars** (`retro-tool-ui/.env`):

```env
VITE_API_URL=http://localhost:8000
VITE_CONVEX_URL=http://localhost:3210
VITE_RETROS_REALTIME_BACKEND=convex       # or: socket-io
VITE_ESTIMATES_REALTIME_BACKEND=convex    # or: socket-io
VITE_NOTIFICATIONS_REALTIME_BACKEND=convex
```

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
| Realtime projection | Self-hosted Convex (local) / Convex Cloud (production) |
| Email | Resend |
| Push notifications | web-push (VAPID) |
| Scheduler | `@nestjs/schedule` |
| Validation | class-validator + Zod |

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

First sign-up is auto-bootstrapped as `super-admin`. Full matrices: [docs/RBAC.md](docs/RBAC.md).

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
| Redis | `localhost:6379` |

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
| [docs/RBAC.md](docs/RBAC.md) | Full permission matrices for system, org, team, and retro actions; helper function signatures; user status lifecycle |
| [docs/app-flows.md](docs/app-flows.md) | Step-by-step flows: auth, user approval, org/team management, retro phases, estimates, notifications |
| [docs/deployment-guide.md](docs/deployment-guide.md) | Azure deployment walkthrough |
| [docs/azure-cloud-resources.md](docs/azure-cloud-resources.md) | Azure resource inventory and cost estimates |
| [docs/convex-components.md](docs/convex-components.md) | Rate limiter, aggregate B-trees, and Better Auth JWT bridge |
| [docs/convex-self-hosting.md](docs/convex-self-hosting.md) | Running Convex in Docker (local + production) |
| [docs/local-cloud-testing.md](docs/local-cloud-testing.md) | Testing locally against cloud resources |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common issues and fixes |
| [docs/future-roadmap.md](docs/future-roadmap.md) | Planned: IceBreakers, AI summaries, Jira/ADO export, SAML |

### Convex AI guidelines

**Must read before editing any file in `convex-backend/convex/`:**
[convex-backend/convex/_generated/ai/guidelines.md](convex-backend/convex/_generated/ai/guidelines.md)

---

## Prerequisites

- Node.js 22
- pnpm 9+
- Docker Desktop
