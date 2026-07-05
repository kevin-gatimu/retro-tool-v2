# Local development against the staging environment

How to run the API + UI **locally** while sharing the deployed staging resources
(Postgres, Convex Cloud, Redis) with other developers — including working
**Convex realtime**.

---

## TL;DR — the working recipe

Every developer runs:

```bash
pnpm dev:api:staging      # NestJS on :8000, loads retro-tool-api/.env.staging-local
pnpm dev:ui:staging       # Vite on :3000, loads retro-tool-ui/.env.staging-local
```

with local env files configured to **share** these staging resources:

| Resource | Value (shared by everyone) |
|---|---|
| PostgreSQL | `retrotool-staging-db.postgres.database.azure.com` / `retro_tool_db` — the **same DB the deployed staging API uses** |
| Convex | The staging Convex Cloud deployment (`CONVEX_SYNC_URL` / `VITE_CONVEX_URL`) |
| `BETTER_AUTH_SECRET` | Identical to the deployed staging App Service setting |
| `BETTER_AUTH_JWT_ISSUER` | `https://retrotool-staging-api.azurewebsites.net` (see below) |

Each developer's **API and UI run locally** (`http://localhost:8000` /
`http://localhost:3000`), so code changes hot-reload without affecting others.

---

## Why Convex realtime needs three things to line up

Convex Cloud verifies browser JWTs with a `customJwt` provider configured as:

```
issuer  = https://retrotool-staging-api.azurewebsites.net
jwks    = https://retrotool-staging-api.azurewebsites.net/api/auth/jwks
audience= convex
```

A locally-minted token is only accepted when **all three** hold:

1. **Same signing keys** — Better Auth stores its RS256 key pair in the `jwks`
   table of Postgres, encrypted with `BETTER_AUTH_SECRET`. Point your local API
   at the **staging DB** with the **staging secret** and it signs with the exact
   key the public staging JWKS endpoint serves. If either differs, your local
   API silently creates a *new* key pair and Convex rejects your tokens with
   `JWT's 'kid' … does this key match any key in the provider's JWKS?`.

2. **Same `iss` claim** — by default Better Auth sets `iss` to `BETTER_AUTH_URL`
   (`http://localhost:8000` locally) which Convex rejects (`No auth provider
   found matching the given token`). Override it in
   `retro-tool-api/.env.staging-local`:

   ```env
   BETTER_AUTH_JWT_ISSUER=https://retrotool-staging-api.azurewebsites.net
   BETTER_AUTH_JWT_AUDIENCE=convex
   ```

   This only changes the JWT `iss` claim used by Convex; cookies, redirects,
   and OAuth still use the localhost `BETTER_AUTH_URL`.

3. **Publicly reachable JWKS** — Convex Cloud fetches keys from the *deployed*
   staging API's `/api/auth/jwks`, which it can reach. Your local JWKS never
   needs to be exposed because it serves the same keys (shared DB).

With those in place, `useConvexAuth()` authenticates locally, `*ConvexSync`
components hydrate from projections, and updates you make appear live in every
other developer's browser.

## Symptom → cause cheat sheet

| Console error (browser) | Cause | Fix |
|---|---|---|
| `No auth provider found matching the given token … issuer=…azurewebsites.net` | Local token has `iss=http://localhost:8000` | Set `BETTER_AUTH_JWT_ISSUER` (recipe above) |
| `The JWT's 'kid' … does this key match any key in the provider's JWKS?` | Local API signs with a different key than the deployed JWKS serves — usually a **different DB** or different `BETTER_AUTH_SECRET` | Point `DATABASE_URL` at the staging DB and copy the staging secret; restart the local API |
| No error, but no realtime updates | `VITE_*_REALTIME_BACKEND=convex` while Convex auth is broken — the Socket.IO fallback and REST polling are disabled when Convex is enabled | Fix Convex auth, or set the feature's flag to `socket-io` in `retro-tool-ui/.env.staging-local` |

> The deployed staging API caches JWKS keys in memory at startup. If the `jwks`
> table changes (e.g. someone connected with a wrong secret and generated a new
> key), restart the App Service so the public JWKS endpoint reflects the table:
> `az webapp restart --name retrotool-staging-api --resource-group retrotool-staging-rg`

---

## Rules for sharing staging safely

- **Never point `.env.staging-local` at the production DB** (or vice versa).
  The prod server is `retro-tool-db-server…/retro-tool-db`; staging is
  `retrotool-staging-db…/retro_tool_db`. Mixing them corrupts JWKS trust and
  scatters test data. Verify with:
  `Select-String retro-tool-api/.env.*-local -Pattern '^DATABASE_URL='`
- **Migrations**: use `pnpm --dir retro-tool-api db:generate:staging` and
  `db:migrate:staging`. Migrations are shared — coordinate before applying
  breaking changes since every developer and the deployed staging API use the
  same schema.
- **Convex function changes**: deploy with
  `pnpm --dir convex-backend exec dotenv -e .env.staging-local -- convex deploy`.
  This is also shared — a schema/function push affects everyone on staging.
- **Socket.IO events are per-API-instance.** Your local API only emits socket
  events to browsers connected to *your* localhost. Convex is the cross-instance
  realtime channel: the projection lives in Convex Cloud, so pushes from any
  API instance (yours, a teammate's, or the deployed one) reach all browsers.
- Sign-in state is shared through the DB: the same account works locally and
  on deployed staging, but cookies are per-origin, so you sign in once per
  origin (localhost vs azurewebsites.net).

## When you'd rather be isolated

If shared staging gets noisy, drop to the fully local stack instead:

```bash
pnpm local:infra   # Postgres + Redis + self-hosted Convex in Docker
pnpm dev:api       # loads .env.local
pnpm dev:ui
pnpm dev:convex
```

`.env.local` uses the self-hosted Convex where the JWKS URL is your own
localhost — no issuer/key gymnastics needed.
