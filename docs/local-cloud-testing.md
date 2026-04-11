# Local Cloud Testing Guide

This guide explains how to run the NestJS API locally while connected to the **production PostgreSQL database** and **Convex Cloud** — without deploying to Azure. Useful for debugging production data issues, verifying Convex function deployments, and smoke-testing changes before a full deploy.

---

## Overview

| Service | Normal Local Dev | Cloud Testing Mode |
|---|---|---|
| NestJS API | `localhost:8000` | `localhost:8000` (unchanged) |
| PostgreSQL | Local Docker container | Production Azure PostgreSQL |
| Convex | Self-hosted Docker container | Convex Cloud (`neat-cod-843`) |
| UI | `localhost:3000` | `localhost:3000` (unchanged) |
| Azure App Service | Not used | Not used |

> The API runs on your machine. Only the data layer (DB + Convex) points to production.

---

## How `.env.local` Works

### Load order

The API loads environment variables in this order:

1. `retro-tool-api/.env` — base local config (local DB, local Convex)
2. `retro-tool-api/.env.local` — **overrides** specific vars without touching `.env`

`.env.local` wins because it is loaded second with `override: true`. It only needs to contain the vars you want to change — everything else falls through from `.env`.

Both files are gitignored via the `.env.*` pattern in `.gitignore`, so `.env.local` is never committed.

### Where it is wired up

Every entry point that loads environment variables must follow the same two-load pattern. Currently implemented in:

**[retro-tool-api/src/app.module.ts](../retro-tool-api/src/app.module.ts)** — the NestJS application:

```ts
import { config as loadDotenv } from 'dotenv';
import { join } from 'path';

loadDotenv({ path: join(__dirname, '../.env'), override: true });
loadDotenv({ path: join(__dirname, '../.env.local'), override: true });
```

**[retro-tool-api/src/seed/seed-templates.ts](../retro-tool-api/src/seed/seed-templates.ts)** — the template seed script:

```ts
import { config as loadDotenv } from 'dotenv';
import { join } from 'path';

loadDotenv({ path: join(__dirname, '../../.env'), override: true });
loadDotenv({ path: join(__dirname, '../../.env.local'), override: true });
```

> Note the different relative depth — `app.module.ts` compiles to `dist/`, seed scripts compile to `dist/seed/`, so the path to `.env` at the package root differs by one level.

### Adding `.env.local` support to new scripts

Any script that starts with `import 'dotenv/config'` only loads `.env`. Replace it with the two-load pattern:

```ts
// Before
import 'dotenv/config';

// After
import { config as loadDotenv } from 'dotenv';
import { join } from 'path';
loadDotenv({ path: join(__dirname, '<relative-path-to-package-root>/.env'), override: true });
loadDotenv({ path: join(__dirname, '<relative-path-to-package-root>/.env.local'), override: true });
```

Determine the correct relative path by counting how deep the compiled output sits under `dist/`:

| Script location | Compiled to | Relative path to package root |
|---|---|---|
| `src/app.module.ts` | `dist/app.module.js` | `../` |
| `src/seed/*.ts` | `dist/seed/*.js` | `../../` |
| `src/foo/bar/script.ts` | `dist/foo/bar/script.js` | `../../../` |

### What `.env.local` should contain

Only override the vars that differ from your normal local setup. For cloud testing:

```env
# ── Local overrides for cloud testing ─────────────────────────────────────────
# This file overrides .env. Gitignored. Delete or empty when done testing.

DATABASE_URL=postgresql://pgadmin:<password>@retro-tool-production-pg.postgres.database.azure.com:5432/retro_tool_db?sslmode=require
CONVEX_SYNC_URL=https://neat-cod-843.eu-west-1.convex.cloud
CONVEX_SYNC_ADMIN_KEY=dev:neat-cod-843|<key>
```

You can also use it for other local overrides unrelated to cloud testing — for example, pointing at a staging DB, disabling cron jobs, or redirecting emails:

```env
ENABLE_CRON_JOBS=false
EMAIL_SANDBOX_TO=your@email.com
```

### Missing `.env.local` is safe

If `.env.local` does not exist, `loadDotenv` silently does nothing. The API and all scripts fall back entirely to `.env`. You do not need to create the file unless you actually want to override something.

---

## Prerequisites

- Azure PostgreSQL is running (it always is — it's a managed service)
- You have the production `DATABASE_URL`, `CONVEX_SYNC_URL`, and `CONVEX_SYNC_ADMIN_KEY` values
- Node 22 and pnpm installed
- Dependencies installed: `pnpm install`

---

## Step 1 — Deploy Convex Functions to Cloud

Before running the API locally against Convex Cloud, make sure the latest functions are deployed. This only needs to be done when you've changed Convex functions — not every time you start the API locally.

Navigate to the `convex-backend/` directory and run `pnpm deploy` with the deploy key set:

**Bash:**

```bash
cd convex-backend
CONVEX_DEPLOY_KEY="dev:neat-cod-843|eyJ2MiI6ImI4MzBjOWQ3Y2I4YTQ2MGM5ODFmMWZjYmJiMGJkNDk4In0=" npx convex deploy
```

**PowerShell:**

```powershell
cd convex-backend
$env:CONVEX_DEPLOY_KEY = "dev:neat-cod-843|eyJ2MiI6ImI4MzBjOWQ3Y2I4YTQ2MGM5ODFmMWZjYmJiMGJkNDk4In0="
npx convex deploy
```

### What this does

- Bundles all TypeScript functions in `convex/` (liveRetros, liveEstimates, liveNotifications, liveReports, rateLimits, schema, etc.)
- Pushes them to your Convex Cloud project `neat-cod-843`
- Runs any pending Convex schema migrations
- Takes ~10–30 seconds

### Verify the deployment

Go to [dashboard.convex.dev](https://dashboard.convex.dev) → your project → **Functions** tab. You should see:

- `liveRetros`
- `liveEstimates`
- `liveNotifications`
- `liveReports`
- `rateLimits`
- `server`

If any are missing or show errors, check the **Logs** tab for deployment errors.

---

## Step 2 — Set Convex Environment Variable in Dashboard

Convex Cloud functions may need to call the Better Auth API to validate tokens. Since Convex Cloud runs in the cloud, it cannot reach your `localhost` — it must point to the deployed production API URL.

Go to:

> [dashboard.convex.dev](https://dashboard.convex.dev) → your project → **Settings** → **Environment Variables**

Add or verify this variable:

| Key | Value |
|---|---|
| `CONVEX_BETTER_AUTH_URL` | `https://retro-tool-production-api.azurewebsites.net/api/auth` |

> This only needs to be set once. It persists in the Convex Cloud project across deployments.

---

## Step 3 — Configure `.env.local`

`retro-tool-api/.env.local` already exists with the three overrides needed:

```env
# ── Local overrides for cloud testing ─────────────────────────────────────────
# This file overrides .env. Gitignored. Delete or empty when done testing.

DATABASE_URL=postgresql://pgadmin:KeOG85CjrC7j4Ou0QziMsSSaHUW3yPFF3VwemKX51nw=@retro-tool-production-pg.postgres.database.azure.com:5432/retro_tool_db?sslmode=require
CONVEX_SYNC_URL=https://neat-cod-843.eu-west-1.convex.cloud
CONVEX_SYNC_ADMIN_KEY=dev:neat-cod-843|eyJ2MiI6ImI4MzBjOWQ3Y2I4YTQ2MGM5ODFmMWZjYmJiMGJkNDk4In0=
```

If it doesn't exist or is empty, create it with those three lines. All other config (auth, OAuth, email, VAPID, ports, etc.) continues to load from `.env`.

---

## Step 4 — Start the API

From the repo root:

**Bash:**

```bash
pnpm --filter retro-tool-api start:dev
```

**PowerShell:**

```powershell
pnpm --filter retro-tool-api start:dev
```

The API starts on `http://localhost:8000`. You will see in the startup logs:

```
[NestApplication] Nest application successfully started
```

At this point the API is:
- Accepting requests at `http://localhost:8000`
- Reading and writing to **production PostgreSQL** (`retro-tool-production-pg.postgres.database.azure.com`)
- Calling **Convex Cloud** for real-time sync (`neat-cod-843.eu-west-1.convex.cloud`)

---

## Step 5 — Verify Everything Is Connected

### Health check

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{ "status": "ok" }
```

### Database connection

Hit any authenticated endpoint. If the DB connection fails you'll see a connection refused or SSL error in the terminal. Common causes:

- `DATABASE_URL` is wrong or the password contains special characters not URL-encoded
- Your IP is not in the Azure PostgreSQL firewall rules (see below)

### Convex connection

The API connects to Convex on startup via the admin key. If the key is wrong you'll see a 401 or connection error in the logs when the first Convex call is made. Check the **Logs** tab in the Convex Dashboard — function invocations appear there in near real-time.

---

## Firewall: Allowing Your Local IP on Azure PostgreSQL

Azure PostgreSQL has a firewall. By default only Azure services are allowed. To connect from your machine:

**Azure Portal:**

> PostgreSQL server → **Networking** → **Firewall rules** → **Add current client IP address** → Save

**Azure CLI:**

```bash
MY_IP=$(curl -s https://api.ipify.org)
az postgres flexible-server firewall-rule create \
  --resource-group retro-tool-production-rg \
  --name retro-tool-production-pg \
  --rule-name local-dev \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP
```

**PowerShell:**

```powershell
$MY_IP = (Invoke-RestMethod -Uri "https://api.ipify.org").Trim()
az postgres flexible-server firewall-rule create `
  --resource-group retro-tool-production-rg `
  --name retro-tool-production-pg `
  --rule-name local-dev `
  --start-ip-address $MY_IP `
  --end-ip-address $MY_IP
```

> Remove this rule when you're done testing to avoid leaving your IP permanently open:
>
> ```bash
> az postgres flexible-server firewall-rule delete \
>   --resource-group retro-tool-production-rg \
>   --name retro-tool-production-pg \
>   --rule-name local-dev
> ```

---

## Running the UI Locally (Optional)

If you also want to test the UI against your local API:

```bash
pnpm --filter retro-tool-ui dev
```

The UI reads `VITE_API_URL` from `retro-tool-ui/.env`. Make sure it points to your local API:

```env
VITE_API_URL=http://localhost:8000
VITE_CONVEX_URL=https://neat-cod-843.eu-west-1.convex.cloud
```

The UI will then talk to your local API, which in turn talks to the production DB and Convex Cloud.

---

## Reverting to Local Dev

When you're done cloud testing, stop the API and empty `.env.local` to restore normal local dev behaviour:

**Bash:**

```bash
echo "" > retro-tool-api/.env.local
```

**PowerShell:**

```powershell
"" | Set-Content retro-tool-api/.env.local
```

Or delete the file entirely — the API gracefully ignores a missing `.env.local`.

Next time you run `pnpm --filter retro-tool-api start:dev` it will be back to your local PostgreSQL and local Convex.

---

## Safety Notes

| Risk | Mitigation |
|---|---|
| **Writes go to production data** | This is intentional. Be careful with mutations — any data you create, update, or delete is real. |
| **Migrations run against prod** | Do not run `node dist/migrate.js` locally with this `.env.local` unless you intend to migrate production. |
| **Cron jobs fire** | `ENABLE_CRON_JOBS=true` is set in `.env`. Weekly digests and retro reminders will run if the scheduled time passes. Set `ENABLE_CRON_JOBS=false` in `.env.local` if this is a concern. |
| **Emails send to real users** | `RESEND_API_KEY` is the production key. Real emails will be sent. Use `EMAIL_SANDBOX_TO=your@email.com` in `.env.local` to redirect all outbound email to yourself. |

---

## Troubleshooting

### `ECONNREFUSED` or SSL error on startup

PostgreSQL firewall is blocking your IP. Follow the firewall steps in the section above.

### `401 Unauthorized` from Convex

The `CONVEX_SYNC_ADMIN_KEY` is wrong or expired. Verify it matches the key in the [Convex Dashboard](https://dashboard.convex.dev) → **Settings** → **Deploy Keys**.

### Functions not found / `404` on Convex calls

Functions haven't been deployed. Re-run Step 1.

### `CONVEX_SYNC_ADMIN_KEY` starts with `dev:` warning

Your current key is a dev/preview deployment key. For the production Convex project you should generate a key starting with `prod:` from the Convex Dashboard → **Settings** → **Deploy Keys** → **Generate Production Key**. Update `.env.local`, `retro-tool-api/.env.production`, and the GitHub secret `CONVEX_SYNC_ADMIN_KEY`.

### Changes in Convex functions not reflecting

You need to re-deploy after every change to Convex functions (Step 1). Unlike `convex dev` (which watches for changes), `pnpm deploy` is a one-shot push.

### Port conflict on `localhost:8000`

Another process is using the port. Either kill it or change `PORT` in `.env.local`:

```env
PORT=8001
```

---

## Related Docs

- [Deployment Guide](deployment-guide.md) — full production deploy walkthrough
- [Azure Cloud Resources](azure-cloud-resources.md) — resource inventory and costs
- [Convex Components](convex-components.md) — Convex function architecture
