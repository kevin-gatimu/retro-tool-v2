# Convex Backend

This package holds the Convex realtime projection layer for the Retro Tool platform. It is **self-hosted** everywhere: locally it runs in a Docker container, and staging runs the same self-hosted backend on Azure App Service (see [docs/CONVEX-AZURE-SELF-HOSTING-PLAN.md](../docs/CONVEX-AZURE-SELF-HOSTING-PLAN.md) and [docs/convex-staging-deployment-runbook.md](../docs/convex-staging-deployment-runbook.md)). Convex Cloud is not the deployment path; it survives only as a historical/rollback reference in the env templates.

---

## What It Does

Convex provides instant, subscription-based realtime updates for all collaborative features. The NestJS API is the system of record (PostgreSQL); after each mutation it pushes a snapshot to Convex via the admin key, which then broadcasts to all subscribed browser clients. Convex holds no business logic and no durable state of its own — only active collaboration projections.

---

## Version pinning

The SDK and the backend container image are a **tested pair**, recorded in [`compatibility.json`](compatibility.json). Do not bump one independently:

- `package.json` pins `convex` to an **exact** version (currently `1.42.3`) — not a caret range.
- `compatibility.json` pins the matching backend image (`ghcr.io/get-convex/convex-backend`) by **sha256 digest** alongside the SDK version and the staging ACR image reference.

When upgrading, update both together and re-verify, then bump `verifiedAt` in `compatibility.json`.

---

## Modules

`convex/` contains the projection functions the NestJS sync service drives (via `internalMutation`, callable only through the admin key) and the queries browser clients subscribe to.

| File | Purpose | Queries exposed to browser |
| --- | --- | --- |
| `liveRetros.ts` | Retro session + full board projection, plus ephemeral typing/ready state | `getRetroProjection`, `listRecentRetroProjections`, `getRetroBoard`, `getTypingUsers`, `getReadyStatus` |
| `liveEstimates.ts` | Story-estimate session + full board projection | `getSessionProjection`, `listActiveSessionProjections`, `getEstimateBoard` |
| `liveIcebreakers.ts` | Icebreaker session + full board projection | `getSessionProjection`, `listActiveSessionProjections`, `getIcebreakerBoard` |
| `liveStandups.ts` | Daily standup entry + full room projection | `getStandupBoard` |
| `livePolls.ts` | Lightweight poll list projection | `listPollProjections` |
| `liveSurveys.ts` | Lightweight survey list + active-count projection | `listSurveyProjections` |
| `liveNotifications.ts` | Per-user notification projection | `listUserNotifications`, `getUnreadCount` |
| `liveTeamMembers.ts` | Team-membership projection used to authorize team-scoped reads | — (internal; consumed by other queries) |
| `admin.ts` | `clearTables` + `pruneStaleByUpdatedAt` admin mutations called by NestJS | — |
| `rateLimits.ts` | Token-bucket / fixed-window guards on upserts and client interactions | — |
| `auth.config.ts` | RS256 JWT verification config (Better Auth ↔ Convex bridge) | — |
| `schema.ts` | Convex document schema | — |
| `convex.config.ts` | Installs the rate-limiter component | — |
| `server.ts`, `lib/` | Shared function wrappers (`server.ts`) and auth/limit helpers (`lib/`) | — |

Each projection module exposes `upsert*` / `delete*` (and some `prune*`) `internalMutation`s that the NestJS API calls with the admin key to keep the projection in sync with PostgreSQL.

### Admin mutations (`admin.ts`)

- `clearTables` — deletes all rows from an allowlisted set of projection/ephemeral tables.
- `pruneStaleByUpdatedAt` — generic bounded mark-and-sweep: NestJS stamps live rows during a snapshot pass, then calls this repeatedly to delete rows whose `updatedAt` predates the reconcile timestamp (projections with no matching Postgres source). The ephemeral tables are deliberately excluded from pruning.

### Schema tables

`schema.ts` defines 15 tables: session projections (`liveRetroSessions`, `liveEstimateSessions`, `liveIcebreakerSessions`, `liveStandupEntries`), full board snapshots (`liveRetroBoards`, `liveEstimateBoards`, `liveIcebreakerBoards`, `liveStandupBoards`), lightweight list projections (`livePolls`, `liveSurveys`), `liveNotifications`, the `liveTeamMembers` authorization projection, and three ephemeral collaboration tables (`livePresence`, `liveTyping`, `liveReadyStatus`).

> **Note:** the former `liveReports.ts` module and its `@convex-dev/aggregate` B-trees were retired with the reports v2 redesign — analytical reporting is now served from PostgreSQL via `/api/reports/v2/*`.

---

## Setup

### Recommended: repo-root bootstrap

From the repo root, `pnpm local:bootstrap` (`scripts/local-dev.mjs`) handles the whole local self-hosted setup: it starts the Docker infra, derives the admin key from the running Convex container, writes `CONVEX_SELF_HOSTED_URL` + `CONVEX_SELF_HOSTED_ADMIN_KEY` into `convex-backend/.env.local` (and the API's sync vars), clears the Cloud `CONVEX_DEPLOYMENT` / `CONVEX_DEPLOY_KEY` refs, sets the JWT function env vars on the deployment, and runs `convex deploy`.

### Manual environment

```bash
cp .env.example .env.local
```

Key variables (see `.env.example` for the full annotated list):

| Variable | Purpose |
| --- | --- |
| `CONVEX_SELF_HOSTED_URL` | Self-hosted backend URL the CLI targets (local: `http://127.0.0.1:3210`) |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | Admin key derived from the running container (`generate_admin_key.sh` / dashboard :6791) |
| `CONVEX_INSTANCE_NAME` / `CONVEX_INSTANCE_SECRET` | Container runtime identity (drives the admin key) |
| `CONVEX_POSTGRES_URL` | Postgres backing the Convex container |
| `CONVEX_DEPLOY_KEY` / `CONVEX_DEPLOYMENT` / `CONVEX_CLOUD_URL` | Cloud CLI targeting — **inactive** locally, left empty when self-hosting |

### Running locally

If you didn't use `pnpm local:bootstrap`, bring up the infra and start the function watcher from the repo root:

```bash
pnpm local:infra    # starts the Convex container, its Postgres, and the Convex dashboard
pnpm dev:convex     # runs `convex dev` (this package's `dev` script)
```

### Running against remote environments

```bash
pnpm dev:convex:staging    # loads .env.staging-local → watches against staging
pnpm dev:convex:prod       # loads .env.production-local → watches against production
```

### Deploying

```bash
pnpm deploy         # deploys functions to the configured (self-hosted) deployment
```

---

## Auth (RS256 JWT verification)

`auth.config.ts` configures Convex's `customJwt` verifier to validate the RS256 JWTs minted by the NestJS Better Auth server. It reads three **Convex function env vars** — set on the deployment via `convex env set`, **not** container env:

| Var | Value |
| --- | --- |
| `JWT_ISSUER` | The API origin (e.g. `http://localhost:8000`); must match the token `iss` byte-for-byte |
| `JWT_AUDIENCE` | `convex` (the token `aud` / `applicationID`) |
| `JWT_JWKS_URL` | The API's JWKS endpoint (from the container, use `host.docker.internal`/the compose service name, not `localhost`) |

After verification, `ctx.auth.getUserIdentity().subject` is the Better Auth user id stored in projections. This is distinct from the admin-key path the NestJS sync service uses for projection writes. See [docs/convex-nestjs-auth.md](../docs/convex-nestjs-auth.md).

---

## Scripts

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `convex dev` | Watch mode against the local self-hosted backend |
| `dev:staging` | `dotenv -e .env.staging-local -- convex dev` | Watch against staging |
| `dev:prod` | `dotenv -e .env.production-local -- convex dev` | Watch against production |
| `codegen` | `convex codegen` | Regenerate TypeScript types |
| `deploy` | `convex deploy` | Deploy functions to the configured deployment |
| `type-check` | `tsc --noEmit -p convex/tsconfig.json` | Type-check the functions |
| `lint` | `eslint convex` | Lint the functions |

Repo-root equivalent for the watcher: `pnpm dev:convex`.

---

## Dependencies

| Package | Purpose |
| --- | --- |
| `convex` | Core SDK (exact-pinned; see [Version pinning](#version-pinning)) |
| `@convex-dev/rate-limiter` | Token-bucket + fixed-window rate limiting |
| `dotenv-cli` | Load env files for remote-environment scripts (dev dependency) |

`@convex-dev/aggregate` is still declared but no longer used — it backed the retired `liveReports.ts` aggregates.

---

## AI Guidelines

**Before editing any file in `convex/`**, read [`convex/_generated/ai/guidelines.md`](convex/_generated/ai/guidelines.md). Those rules override general Convex knowledge from training data (also required by the repo `CLAUDE.md`).
