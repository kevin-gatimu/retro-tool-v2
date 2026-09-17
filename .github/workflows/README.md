# CI/CD Workflows

This directory contains all GitHub Actions workflows for the Retro Tool monorepo.

## Overview

Two deploy paths exist:

- **Staging (automated):** push to the `staging` branch triggers `release-staging.yml`, which chains
  the Convex, API, and UI deploy workflows in order.
- **Production (manual):** trigger `deploy-api.yml`, `deploy-ui.yml`, and
  `deploy-convex-production.yml` manually against `main`. There is no automated production pipeline.

Both `deploy-api.yml` and `deploy-ui.yml` pick their target environment dynamically: `main` →
`production`; any other branch → `staging`. `deploy-convex-production.yml` is dispatch-only and
always targets production.

```
feature/* ──PR──▶ staging ──push──▶ release-staging.yml
                                      convex (staging) → api (staging) → ui (staging)

              main ─────────────────▶ release-please (changelog + version tags)
                        manual ──────▶ deploy-api.yml      (main → production)
                        manual ──────▶ deploy-ui.yml       (main → production)
                        manual ──────▶ deploy-convex-production.yml (always production)
```

| Workflow                                        | File                                    | Trigger                                              | Target                          |
| ----------------------------------------------- | --------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| [CI](#ci)                                       | `ci.yml`                                | PR to `develop` / `staging` / `main`; manual         | Validate workspace              |
| [Release Staging](#release-staging)             | `release-staging.yml`                   | Push to `staging` (path-filtered); manual            | Orchestrates the three deploys  |
| [Deploy Convex (staging)](#deploy-convex)       | `deploy-convex.yml`                     | `workflow_call`; manual                              | Azure App Service (staging)     |
| [Deploy API](#deploy-api)                       | `deploy-api.yml`                        | `workflow_call`; manual                              | Azure App Service               |
| [Deploy UI](#deploy-ui)                         | `deploy-ui.yml`                         | `workflow_call`; manual                              | Azure Static Web App            |
| [Deploy Convex Production](#deploy-convex-production) | `deploy-convex-production.yml`    | `workflow_dispatch` only                             | Azure App Service (production)  |
| [Release Please](#release-please)               | `release-please.yml`                    | Push to `main`                                       | GitHub Release + version tags   |

All jobs run on **Node 24** and use the pnpm version declared by the root `package.json`
`packageManager` field. Deploy jobs authenticate to Azure with **OIDC federated credentials** — no
stored passwords.

See [`../../docs/deployment/release-and-branch-strategy.md`](../../docs/deployment/release-and-branch-strategy.md) for the full branch model.

---

## CI

**File:** `ci.yml`

Runs on every pull request targeting `develop`, `staging`, or `main`. Can also be triggered
manually via `workflow_dispatch`.

### What it does

Two jobs run in parallel:

- **`audit`** — `pnpm audit --prod --audit-level high`, failing the build on known High/Critical
  advisories in production dependencies.
- **`validate`** — installs with `--frozen-lockfile`, then lints, type-checks, tests, and builds
  the workspace.

### Concurrency

Grouped by branch/PR ref (`ci-<head_ref|ref_name>`). A new push to the same PR branch cancels any
in-progress run.

### Permissions

Read-only (`contents: read`). No secrets needed.

---

## Release Staging

**File:** `release-staging.yml`

The staging deploy orchestrator. It is the only workflow with a branch push trigger for deploys —
the three `deploy-*` workflows are reusable and are called from here (or run manually).

### Trigger

- **Automatic:** push to `staging` when files change in `convex-backend/**`, `infra/**`,
  `packages/shared/contracts/**`, `retro-tool-api/**`, `retro-tool-ui/**`, or the
  `deploy-*.yml` / `release-staging.yml` workflow files.
- **Manual:** `workflow_dispatch`.

### Jobs

Reusable workflows called in strict order (`secrets: inherit`):

```
convex ──▶ api ──▶ ui
```

- `convex` → `deploy-convex.yml`
- `api` → `deploy-api.yml` (needs `convex`)
- `ui` → `deploy-ui.yml` (needs `api`)

### Concurrency

Group `staging-release`, `cancel-in-progress: false` — overlapping releases queue rather than
cancel, so a deploy is never interrupted mid-flight.

---

## Deploy Convex

**File:** `deploy-convex.yml`

Provisions and updates the **single self-hosted Convex staging backend on Azure App Service** (not
Convex Cloud), then deploys the Convex functions. The open-source Convex backend is
single-instance, so backend image changes are applied **stop-first**.

### Trigger

`workflow_call` (from Release Staging) or `workflow_dispatch`.

### Fixed environment constants

| Constant             | Value                                         |
| -------------------- | --------------------------------------------- |
| Resource group       | `retrotool-staging-rg`                        |
| ACR                  | `retrotoolstagingacr`                         |
| Web app              | `retrotool-staging-convex`                    |
| API base URL         | `https://retrotool-staging-api.azurewebsites.net` |

Image is read from `convex-backend/compatibility.json` → `backend.stagingImage` (must be digest-pinned `@sha256:`).

### Jobs

```
validate ──▶ deploy
```

#### 1. Validate

- Type-checks and lints `convex-backend`.
- Validates `convex-backend/compatibility.json`: the staging image must be pinned by `@sha256:`
  digest, and the manifest's `convexSdkVersion` must match the `convex` dependency in
  `convex-backend/package.json`.
- Installs the Bicep CLI and validates `infra/convex-staging.bicep` (`az bicep build`).

#### 2. Deploy

Runs in the `staging` GitHub environment. Key steps:

1. Verifies `CONVEX_INSTANCE_SECRET`, `CONVEX_POSTGRES_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY` are set.
2. Resolves the digest-pinned image from `compatibility.json`.
3. Enforces the single-instance invariant — refuses to deploy if the app has more than one worker.
4. Detects whether the backend image is changing by comparing `linuxFxVersion` to `DOCKER|<image>`.
5. **If the image is changing:** exports Convex state (uploaded as a 30-day artifact), pauses the
   projection outbox (via `POST /api/convex-admin/outbox/pause` with `API_ADMIN_TOKEN`), and stops
   the web app.
6. Provisions `infra/convex-staging.bicep` (`az deployment group create`).
7. Starts the web app and polls `/version` for readiness (up to 60 attempts).
8. Verifies exactly one running instance.
9. Sets JWT auth env vars (`JWT_ISSUER`, `JWT_AUDIENCE=convex`, `JWT_JWKS_URL`) and runs
   `convex deploy`.
10. Re-checks `/version` health.
11. **After an image change:** resumes the outbox (`POST .../outbox/resume`) and triggers a full
    reconciliation (`POST .../reconcile-projections`).

`API_ADMIN_TOKEN` is optional; if unset, the outbox steps warn and continue (events still buffer
durably in the NestJS outbox table).

### Concurrency

Group `deploy-convex-staging`, `cancel-in-progress: false`.

---

## Deploy API

**File:** `deploy-api.yml`

Builds and pushes the API image to ACR, migrates and seeds the database, deploys the container to
Azure App Service, then runs a projection reconciliation.

### Trigger

`workflow_call` (from Release Staging) or `workflow_dispatch`.

### Environment selection

A `set-env` job picks the target environment dynamically:

| Branch | Environment |
| ------ | ----------- |
| `main` | `production` |
| anything else | `staging` |

All downstream jobs run in the selected GitHub environment.

### Jobs

```
validate ──▶ set-env ──▶ build ──▶ migrate ──▶ seed ──▶ deploy ──▶ reconcile
```

#### 1. Validate

Lint, type-check, `test:ci`, and build for `retro-tool-api`.

#### 2. Set Environment

Emits `environment` output (`staging` or `production`).

#### 3. Build

- Azure login (OIDC), then `az acr login`.
- Builds the API image from `retro-tool-api/Dockerfile` (workspace-root context).
- Tags with `<env>-<sha8>`, `<env>-latest`, and `<env>-v<package.json version>`, and pushes all
  three.

#### 4. Migrate

- Builds the API and verifies `dist/main.js` exists.
- Runs a DNS preflight against the `DATABASE_URL` host.
- Runs `pnpm db:migrate` against `DATABASE_URL`.

#### 5. Seed

Runs idempotent seeders from `dist/seed/`: retro templates, estimate templates, and team roles.

#### 6. Deploy

- Validates required deploy config and warns on commonly-missing optional secrets.
- Sets App Service environment variables (non-secret: `NODE_ENV`, `PORT=8080`, CORS origins,
  `CONVEX_SYNC_URL`, cron flags, `MICROSOFT_TENANT_ID`, `EMAIL_FROM`) and secret settings
  (`DATABASE_URL`, `BETTER_AUTH_SECRET`, Microsoft OAuth, `RESEND_API_KEY`,
  `CONVEX_SYNC_ADMIN_KEY`, VAPID keys).
- Verifies ACR pull via managed identity (`acrUseManagedIdentityCreds`).
- Sets the container image and restarts the app.
- Polls `/health/ready` until HTTP 200 (up to 60 attempts).
- On failure, collects Kudu Docker logs (with Azure CLI fallback).

#### 7. Reconcile

Runs after every successful deploy — not just Convex backend changes — so projections can never
silently drift. Uses the standalone CLI (`node dist/convex-admin/reconcile-projections.js`), which
boots a headless NestJS context talking directly to Postgres and Convex.

### Concurrency

Group `deploy-api-<ref_name>`, `cancel-in-progress: false`.

---

## Deploy UI

**File:** `deploy-ui.yml`

Builds the Vite SPA and deploys it to an **Azure Static Web App**.

### Trigger

`workflow_call` (from Release Staging) or `workflow_dispatch`.

### Environment selection

Same as Deploy API — `main` → `production`; anything else → `staging`.

### Jobs

```
validate ──▶ set-env ──▶ deploy
```

#### 1. Validate

Lint, type-check, and test for `retro-tool-ui`.

#### 2. Set Environment

Emits `environment` output.

#### 3. Deploy (build + upload)

- Validates required UI build variables (see below), including realtime backend flag values
  (`socket-io` or `convex`), `VITE_APP_ENV` (`local|development|staging|production`), and URL
  format.
- Resolves the app version from `retro-tool-ui/package.json`.
- Builds with `pnpm --filter retro-tool-ui build`.
- Deploys `retro-tool-ui/dist` via `Azure/static-web-apps-deploy@v1` (`skip_app_build: true`).

#### Vite build variables

| Variable                                | Source                                    | Required |
| --------------------------------------- | ----------------------------------------- | -------- |
| `VITE_APP_VERSION`                      | `v<retro-tool-ui package version>`        | auto     |
| `VITE_APP_TITLE`                        | `vars.VITE_APP_TITLE`                     | yes      |
| `VITE_APP_ENV`                          | `vars.VITE_APP_ENV`                       | yes      |
| `VITE_API_URL`                          | `vars.VITE_API_URL`                       | yes      |
| `VITE_CONVEX_URL`                       | `vars.VITE_CONVEX_URL`                    | if any backend is `convex` |
| `VITE_ESTIMATES_REALTIME_BACKEND`       | `vars.VITE_ESTIMATES_REALTIME_BACKEND`    | yes      |
| `VITE_RETROS_REALTIME_BACKEND`          | `vars.VITE_RETROS_REALTIME_BACKEND`       | yes      |
| `VITE_ICEBREAKERS_REALTIME_BACKEND`     | `vars.VITE_ICEBREAKERS_REALTIME_BACKEND`  | yes      |
| `VITE_STANDUPS_REALTIME_BACKEND`        | `vars.VITE_STANDUPS_REALTIME_BACKEND`     | yes      |
| `VITE_NOTIFICATIONS_REALTIME_BACKEND`   | `vars.VITE_NOTIFICATIONS_REALTIME_BACKEND`| yes      |

> No migration step — the UI is a static SPA.

### Concurrency

Group `deploy-ui-<ref_name>`, `cancel-in-progress: false`.

---

## Deploy Convex Production

**File:** `deploy-convex-production.yml`

Provisions and updates the **single self-hosted Convex production backend on Azure App Service**,
then deploys Convex functions. Mirrors `deploy-convex.yml` (staging) with production naming.

**Manual dispatch only.** There is no automated production pipeline. Trigger this deliberately
after `deploy-api` and `deploy-ui` have completed against `main`.

### Trigger

`workflow_dispatch` only.

### Fixed environment constants

| Constant       | Value                                              |
| -------------- | -------------------------------------------------- |
| Resource group | `retro_tool`                                       |
| ACR            | `retrotool`                                        |
| Web app        | `retrotool-prod-convex`                            |
| API base URL   | `https://retro-tool-api.azurewebsites.net`         |

Image is read from `convex-backend/compatibility.json` → `backend.productionImage` (must be
digest-pinned `@sha256:`).

### Jobs

```
validate ──▶ deploy
```

#### 1. Validate

- Type-checks and lints `convex-backend`.
- Validates `convex-backend/compatibility.json`: the production image must be pinned by `@sha256:`
  digest, and `convexSdkVersion` must match the `convex` package dependency.
- Installs the Bicep CLI and validates `infra/convex-production.bicep` (`az bicep build`). The
  validate job intentionally does **not** use the `production` GitHub environment — OIDC creds live
  there, but Bicep validation is purely local.

#### 2. Deploy

Runs in the `production` GitHub environment. Steps parallel the staging Convex deploy:

1. Verifies `CONVEX_INSTANCE_SECRET`, `CONVEX_POSTGRES_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY` are
   set.
2. Resolves the digest-pinned image from `compatibility.json`.
3. Enforces single-instance invariant (refuses if `numberOfWorkers != 1`).
4. Detects whether the backend image is changing.
5. **If the image is changing:** exports Convex state (`convex export`) and uploads it as a 30-day
   artifact, then pauses the outbox and stops the web app.
6. Provisions `infra/convex-production.bicep` (`az deployment group create`).
7. Starts the web app and polls `/version` for readiness (up to 60 attempts).
8. Verifies exactly one running instance.
9. Sets JWT auth env vars and runs `convex deploy --typecheck enable`.
10. Re-checks `/version` health.
11. **After an image change:** resumes the outbox and triggers a full reconciliation.

`API_ADMIN_TOKEN` is optional; if unset, the outbox steps warn and continue.

### Concurrency

Group `deploy-convex-production`, `cancel-in-progress: false`.

---

## Release Please

**File:** `release-please.yml`

Automated lockstep releases. On every push to `main`, `release-please` parses the
conventional-commit history and maintains a "release PR" that accumulates the changelog and
version bump (`feat` → minor, `fix` → patch, `feat!`/`BREAKING CHANGE` → major). Merging that PR
bumps every `package.json` version in lockstep, updates `CHANGELOG.md`, tags `vX.Y.Z`, and creates
the GitHub Release.

Uses `googleapis/release-please-action@v5` with `release-please-config.json` and
`.release-please-manifest.json`. Needs `contents: write` and `pull-requests: write`; authenticates
with the default `GITHUB_TOKEN`.

---

## Required GitHub Configuration

### Environments

Two GitHub Environments are used:

| Environment | Used by                                                                |
| ----------- | ---------------------------------------------------------------------- |
| `staging`   | `deploy-convex.yml` (deploy job), `deploy-api.yml`, `deploy-ui.yml` when branch ≠ `main` |
| `production`| `deploy-convex-production.yml` (deploy job), `deploy-api.yml`, `deploy-ui.yml` when branch = `main` |

Add a required-reviewer gate on `production` if you want manual approval before production deploys.

### Azure OIDC (all deploy workflows)

| Name (secret or variable) | Description                          |
| ------------------------- | ------------------------------------ |
| `AZURE_CLIENT_ID`         | App registration client ID (OIDC)    |
| `AZURE_TENANT_ID`         | Azure AD tenant ID                   |
| `AZURE_SUBSCRIPTION_ID`   | Azure subscription ID                |

### Deploy API

| Name                                            | Kind          | Description                                              |
| ----------------------------------------------- | ------------- | -------------------------------------------------------- |
| `ACR_LOGIN_SERVER`                              | var/secret    | ACR login server (`<name>.azurecr.io`)                   |
| `API_IMAGE_REPOSITORY`                          | var/secret    | Image repo (default `retro-tool-api`)                    |
| `AZURE_RESOURCE_GROUP`                          | var/secret    | Resource group of the API web app                        |
| `API_WEBAPP_NAME`                               | var/secret    | API App Service name                                     |
| `FRONTEND_URL` / `SWA_URL`                      | var/secret    | Frontend origin (CORS + Better Auth)                     |
| `CONVEX_SYNC_URL`                               | var/secret    | Convex admin URL for projection writes                   |
| `EMAIL_FROM`                                    | var/secret    | Sender address                                           |
| `DATABASE_URL`                                  | secret        | Postgres connection string (migrate + deploy)            |
| `BETTER_AUTH_SECRET`                            | secret        | Session signing secret                                   |
| `MICROSOFT_CLIENT_ID`                           | secret/var    | Better Auth Microsoft provider (falls back to `AZURE_CLIENT_ID`) |
| `MICROSOFT_CLIENT_SECRET`                       | secret        | Better Auth Microsoft provider                           |
| `MICROSOFT_TENANT_ID`                           | var/secret    | Falls back to `AZURE_TENANT_ID`                          |
| `RESEND_API_KEY`                                | secret        | Transactional email                                      |
| `CONVEX_SYNC_ADMIN_KEY`                         | secret/var    | Convex admin key (warns if unset)                        |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | var/secret | Web push (warns if unset)                   |

### Deploy Convex (staging and production)

| Name                           | Kind   | Description                                                  |
| ------------------------------ | ------ | ------------------------------------------------------------ |
| `CONVEX_INSTANCE_SECRET`       | secret | Convex backend instance secret                               |
| `CONVEX_POSTGRES_URL`          | secret | Postgres URL backing the Convex backend                      |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | secret | Admin key for `convex export` / `convex deploy`              |
| `API_ADMIN_TOKEN`              | secret | Super-admin bearer for outbox pause/resume + reconcile (optional; warns if unset) |

> Resource group, ACR name, web app name, and API base URL for Convex are fixed constants in each
> workflow's `env` block, not repo configuration.

### Deploy UI

| Name                   | Kind   | Description                                  |
| ---------------------- | ------ | -------------------------------------------- |
| `SWA_DEPLOYMENT_TOKEN` | secret | Azure Static Web App deployment token        |
| `VITE_*` (table above) | var    | Build-time Vite variables                    |

`GITHUB_TOKEN` (auto-provided) is used by both the UI deploy action and release-please.

---

## Path Filters

Only `release-staging.yml` filters by path; the reusable `deploy-*` workflows have no push trigger
of their own. CI runs on any PR.

| Workflow                          | Monitored paths                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| CI                                | All PRs to `develop` / `staging` / `main`                                                          |
| Release Staging                   | `convex-backend/**`, `infra/**`, `packages/shared/contracts/**`, `retro-tool-api/**`, `retro-tool-ui/**`, the `deploy-*.yml` + `release-staging.yml` files |
| Deploy Convex / API / UI          | Reusable (`workflow_call`) or manual — no path filter                                               |
| Deploy Convex Production          | Manual only — no path filter                                                                        |
| Release Please                    | Push to `main` — no path filter                                                                     |

---

## Visual Pipeline Flow

### Pull request (CI only)

```
┌──────────────────────────────────────────┐
│                 ci.yml                    │
│  audit (pnpm audit --prod)                │
│  validate (install → lint → type-check   │
│            → test → build)               │
└──────────────────────────────────────────┘
```

### Push to staging (automated staging deploy)

```
            release-staging.yml
┌──────────────┐    ┌─────────────────────────┐    ┌──────────────┐
│    convex    │──▶ │           api            │──▶ │      ui      │
│ (App Service │    │ validate → build →       │    │ (Static Web  │
│  stop-first) │    │ migrate → seed →         │    │  App build   │
│              │    │ deploy → reconcile       │    │  + upload)   │
└──────────────┘    └─────────────────────────┘    └──────────────┘
```

### Push to main (release automation)

```
┌───────────────────────────────────────────────┐
│               release-please.yml               │
│  parse commits → maintain release PR →         │
│  (on merge) bump versions, changelog, tag      │
└───────────────────────────────────────────────┘
```

### Manual production deploy

```
  workflow_dispatch on main branch

  deploy-convex-production.yml   (validate → deploy to production)
  deploy-api.yml                 (validate → set-env=production → build → migrate → seed → deploy → reconcile)
  deploy-ui.yml                  (validate → set-env=production → deploy)
```
