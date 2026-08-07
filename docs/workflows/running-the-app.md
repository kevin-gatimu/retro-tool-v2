# Running the app — local, staging, and production

How to run the API + UI (+ Convex) against each of the three environments. In every mode your **code
runs locally** (`http://localhost:8000` / `http://localhost:3000`) and hot-reloads; what changes is
**which backing resources** (Postgres, Convex, secrets) it talks to.

| Mode | Backing resources | Env file loaded | Isolation |
|---|---|---|---|
| **Local** | Docker: Postgres + self-hosted Convex | `.env.local` | Fully isolated — your own DB & Convex |
| **Staging** | Deployed staging Azure resources (shared) | `.env.staging-local` | Shared with every dev + the deployed staging API |
| **Production** | Deployed production Azure resources | `.env.production-local` | **Live user data — read the warnings** |

---

## Contents

- [Quick reference — commands per mode](#quick-reference--commands-per-mode)
- [Local mode (isolated Docker stack)](#local-mode-isolated-docker-stack)
- [Staging mode (shared staging resources)](#staging-mode-shared-staging-resources)
- [Production mode](#production-mode)
- [Why Convex realtime needs three things to line up](#why-convex-realtime-needs-three-things-to-line-up)
- [Symptom → cause cheat sheet](#symptom--cause-cheat-sheet)
- [Rules for sharing staging/production safely](#rules-for-sharing-stagingproduction-safely)
- [Database & Convex operations per environment](#database--convex-operations-per-environment)

---

## Quick reference — commands per mode

All commands run from the repo root.

| | Local | Staging | Production |
|---|---|---|---|
| **API** | `pnpm dev:api` | `pnpm dev:api:staging` | `pnpm dev:api:prod` |
| **UI** | `pnpm dev:ui` | `pnpm dev:ui:staging` | `pnpm dev:ui:prod` |
| **Convex watcher** | `pnpm dev:convex` | `pnpm dev:convex:staging` | `pnpm dev:convex:prod` |
| **API + UI together** | `pnpm local:dev` | `pnpm dev:staging` | — |
| **API + UI + Convex + docs** | `pnpm local:dev:all` | — | — |
| **Env file** | `.env.local` | `.env.staging-local` | `.env.production-local` |

Under the hood the `:staging` / `:prod` scripts use `dotenv-cli` to pre-load the environment-specific
file (Vite uses `--mode staging-local` / `--mode production-local`). `ConfigModule` won't overwrite
already-set `process.env`, so those values take precedence.

---

## Local mode (isolated Docker stack)

The default for day-to-day work. Everything runs on your machine — no shared state, no issuer/key
gymnastics.

```bash
pnpm local:infra   # Postgres + self-hosted Convex + dashboard in Docker
pnpm dev:api       # NestJS on :8000, loads .env.local
pnpm dev:ui        # Vite on :3000
pnpm dev:convex    # Convex function watcher (self-hosted)
```

Or start the full stack in Docker with `pnpm local:up`, and run all three app processes together with
`pnpm local:dev` (add the VitePress user-guide dev server too with `pnpm local:dev:all`). Stop infra
with `pnpm local:down`; tail logs with `pnpm local:logs`.

`.env.local` points at the **self-hosted** Convex, whose JWKS URL is your own localhost — so the
three-way JWT alignment described below is automatic. First run: `pnpm local:bootstrap` (seed) /
`pnpm local:reset` (wipe + reseed).

---

## Staging mode (shared staging resources)

Run the API + UI locally while **sharing the deployed staging resources** with other developers —
including working **Convex realtime**. Useful for reproducing staging-only issues or testing against
real shared data.

```bash
pnpm dev:api:staging      # NestJS on :8000, loads retro-tool-api/.env.staging-local
pnpm dev:ui:staging       # Vite on :3000, loads retro-tool-ui/.env.staging-local
```

with local env files configured to **share** these staging resources:

| Resource | Value (shared by everyone) |
|---|---|
| PostgreSQL | `retrotool-staging-db.postgres.database.azure.com` / `retro_tool_db` — the **same DB the deployed staging API uses** |
| Convex | The self-hosted staging Convex deployment on Azure App Service (`retrotool-staging-convex`), via `CONVEX_SYNC_URL` / `VITE_CONVEX_URL` |
| `BETTER_AUTH_SECRET` | Identical to the deployed staging App Service setting |
| `BETTER_AUTH_JWT_ISSUER` | `https://retrotool-staging-api.azurewebsites.net` (see [below](#why-convex-realtime-needs-three-things-to-line-up)) |

Each developer's API and UI run locally, so code changes hot-reload without affecting others; only the
backing data is shared.

---

## Production mode

> ⚠️ **This connects your local API/UI to live production data.** Use it only for read-only diagnosis
> or a deliberate, coordinated operation — never for routine development. Prefer local or staging.

```bash
pnpm dev:api:prod         # NestJS on :8000, loads retro-tool-api/.env.production-local
pnpm dev:ui:prod          # Vite on :3000, loads retro-tool-ui/.env.production-local
pnpm dev:convex:prod      # Convex watcher against the self-hosted production deployment
```

`.env.production-local` shares the production resources the same way staging does, but with production
values:

| Resource | Production value |
|---|---|
| PostgreSQL | `retro-tool-db-server…` / `retro_tool_db` |
| API host (JWT issuer) | `https://retrotool-prod-api.azurewebsites.net` |
| Convex | The self-hosted production Convex deployment on Azure App Service (`retrotool-prod-convex`) |
| `BETTER_AUTH_SECRET` | Identical to the deployed **production** App Service setting |

The same three-way JWT alignment applies — substitute the production API host for the staging one in
`BETTER_AUTH_JWT_ISSUER`. **Never mix staging and production values in one env file** (see
[safety rules](#rules-for-sharing-stagingproduction-safely)).

---

## Why Convex realtime needs three things to line up

*(Applies when running locally against the shared staging/production Convex deployments — plain
`.env.local` dev is automatic, since its JWKS URL points at your own local container.)*

Convex verifies browser JWTs with a `customJwt` provider configured (staging example) as:

```
issuer  = https://retrotool-staging-api.azurewebsites.net
jwks    = https://retrotool-staging-api.azurewebsites.net/api/auth/jwks
audience= convex
```

A locally-minted token is only accepted when **all three** hold:

1. **Same signing keys** — Better Auth stores its RS256 key pair in the `jwks` table of Postgres,
   encrypted with `BETTER_AUTH_SECRET`. Point your local API at the **shared DB** (staging or prod) with
   the matching **secret** and it signs with the exact key the public JWKS endpoint serves. If either
   differs, your local API silently creates a *new* key pair and Convex rejects your tokens with
   `JWT's 'kid' … does this key match any key in the provider's JWKS?`.

2. **Same `iss` claim** — by default Better Auth sets `iss` to `BETTER_AUTH_URL`
   (`http://localhost:8000` locally) which Convex rejects (`No auth provider found matching the given
   token`). Override it in the environment's local env file:

   ```env
   BETTER_AUTH_JWT_ISSUER=https://retrotool-staging-api.azurewebsites.net
   BETTER_AUTH_JWT_AUDIENCE=convex
   ```

   (Use the production API host in `.env.production-local`.) This only changes the JWT `iss` claim used
   by Convex; cookies, redirects, and OAuth still use the localhost `BETTER_AUTH_URL`.

3. **Publicly reachable JWKS** — the self-hosted Convex deployment fetches keys from the *deployed*
   API's `/api/auth/jwks`, which it can reach. Your local JWKS never needs to be exposed because it
   serves the same keys (shared DB).

With those in place, `useConvexAuth()` authenticates locally, `*ConvexSync` components hydrate from
projections, and updates you make appear live in every other developer's browser. For the full JWT
issue/verify design see [convex-nestjs-auth.md](../security/convex-nestjs-auth.md).

---

## Symptom → cause cheat sheet

| Console error (browser) | Cause | Fix |
|---|---|---|
| `No auth provider found matching the given token … issuer=…azurewebsites.net` | Local token has `iss=http://localhost:8000` | Set `BETTER_AUTH_JWT_ISSUER` (recipe above) |
| `The JWT's 'kid' … does this key match any key in the provider's JWKS?` | Local API signs with a different key than the deployed JWKS serves — usually a **different DB** or different `BETTER_AUTH_SECRET` | Point `DATABASE_URL` at the shared DB and copy the matching secret; restart the local API |
| No error, but no realtime updates | `VITE_*_REALTIME_BACKEND=convex` while Convex auth is broken — REST polling is disabled for most features whenever `isConvexConfigured()` is true, even if the Convex connection itself is failing | Fix Convex auth. There is no working `socket-io` flag value to fall back to anymore (Socket.IO gateways were removed) — to force REST polling instead, unset `VITE_CONVEX_URL` and rebuild the UI |

> The deployed API caches JWKS keys in memory at startup. If the `jwks` table changes (e.g. someone
> connected with a wrong secret and generated a new key), restart the App Service so the public JWKS
> endpoint reflects the table:
> `az webapp restart --name retrotool-staging-api --resource-group retrotool-staging-rg`
> (substitute `retrotool-prod-api` / `retrotool-prod-rg` for production).

---

## Rules for sharing staging/production safely

- **Never cross environments in an env file.** Keep `.env.staging-local` pointed only at staging
  resources and `.env.production-local` only at production. Prod DB is `retro-tool-db-server…/retro_tool_db`;
  staging is `retrotool-staging-db…/retro_tool_db`. Mixing them corrupts JWKS trust and scatters data.
  Verify with:
  `Select-String retro-tool-api/.env.*-local -Pattern '^DATABASE_URL='`
- **Migrations are shared.** Every developer and the deployed API on that environment use the same
  schema, so coordinate before applying breaking changes. Use the per-environment scripts (see
  [next section](#database--convex-operations-per-environment)).
- **Convex function changes are shared.** A schema/function push affects everyone on that environment.
- **Convex is the cross-instance realtime channel.** There's no Socket.IO layer anymore (it was
  removed entirely — no gateways, no per-instance broadcast to worry about). The projection lives in
  the shared Convex deployment (self-hosted on Azure App Service for staging/production), so pushes
  from any API instance (yours, a teammate's, or the deployed one) reach all browsers.
- **Sign-in state is shared through the DB**, but cookies are per-origin, so you sign in once per origin
  (localhost vs azurewebsites.net).

## Database & Convex operations per environment

Run from the repo root. **Local** commands hit your Docker Postgres / self-hosted Convex; the
`:staging` / `:prod` variants load the corresponding env file and hit the shared cloud resources.

| Operation | Local | Staging | Production |
|---|---|---|---|
| Generate migration | `pnpm --dir retro-tool-api db:generate` | `db:generate:staging` | `db:generate:prod` |
| Apply migrations | `pnpm --dir retro-tool-api db:migrate` | `db:migrate:staging` | `db:migrate:prod` |
| Seed (prod-safe) | `pnpm --dir retro-tool-api db:seed` | `db:seed:staging` | `db:seed:prod` |
| Seed templates | `db:seed:templates` | `db:seed:templates:staging` | `db:seed:templates:prod` |
| Deploy Convex functions | *(watcher)* `pnpm dev:convex` | `pnpm --dir convex-backend exec dotenv -e .env.staging-local -- convex deploy` | `…-e .env.production-local -- convex deploy` |

Migrations and Convex pushes are shared on staging/production — coordinate before applying breaking
changes.
