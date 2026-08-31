# CI/CD Workflows

This directory contains all GitHub Actions workflows for the Retro Tool monorepo.

## Overview

Deploys currently target a single **staging** environment on Azure. Pushing to the
`staging` branch runs the orchestrator (`release-staging.yml`), which chains the
Convex, API, and UI deploy workflows in order. Pushing to `main` runs
release-please, which maintains the release PR and tags versions.

```
feature/* ──PR──▶ staging ──────────────▶ deploy (Convex → API → UI)
                    (release-staging.yml orchestrator)

              main ─────────────────────▶ release-please (changelog + version tags)
```

| Workflow                             | File                                | Trigger                                              | Target                          |
| ------------------------------------ | ----------------------------------- | ---------------------------------------------------- | ------------------------------- |
| [CI](#ci)                            | `workflows/ci.yml`                  | PR to `develop` / `staging` / `main`; manual         | Validate workspace              |
| [Release Staging](#release-staging)  | `workflows/release-staging.yml`     | Push to `staging` (path-filtered); manual            | Orchestrates the three deploys  |
| [Deploy Convex](#deploy-convex)      | `workflows/deploy-convex.yml`       | `workflow_call`; manual                              | Azure App Service (self-hosted) |
| [Deploy API](#deploy-api)            | `workflows/deploy-api.yml`          | `workflow_call`; manual                              | Azure App Service               |
| [Deploy UI](#deploy-ui)              | `workflows/deploy-ui.yml`           | `workflow_call`; manual                              | Azure Static Web App            |
| [Release Please](#release-please)    | `workflows/release-please.yml`      | Push to `main`                                       | GitHub Release + version tags   |

All jobs run on **Node 24** and use the pnpm version declared by the root
`package.json` `packageManager` field. Deploy jobs authenticate to Azure with
**OIDC federated credentials** — no stored passwords.

---

## CI

**File:** `workflows/ci.yml`

Runs on every pull request targeting `develop`, `staging`, or `main`. Can also be
triggered manually via `workflow_dispatch`.

### What it does

Two jobs run in parallel:

- **`audit`** — `pnpm audit --prod --audit-level high`, failing the build on known
  High/Critical advisories in production dependencies (scoped to `--prod` so
  devDependency-only advisories don't block merges).
- **`validate`** — installs with `--frozen-lockfile`, then lints, type-checks, and
  tests the workspace.

### Concurrency

Grouped by branch/PR ref (`ci-<head_ref|ref_name>`). A new push to the same PR
branch cancels any in-progress run to save runner minutes.

### Permissions

Read-only (`contents: read`). No secrets needed.

---

## Release Staging

**File:** `workflows/release-staging.yml`

The staging deploy orchestrator. It is the only workflow with a branch push
trigger for deploys — the three `deploy-*` workflows are reusable and are called
from here (or run manually).

### Trigger

- **Automatic:** push to `staging` when files change in `convex-backend/**`,
  `infra/**`, `packages/shared/contracts/**`, `retro-tool-api/**`,
  `retro-tool-ui/**`, or any of the `deploy-*.yml` / `release-staging.yml`
  workflow files.
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

Group `staging-release`, `cancel-in-progress: false` — overlapping staging
releases queue rather than cancel, so a deploy is never interrupted mid-flight.

---

## Deploy Convex

**File:** `workflows/deploy-convex.yml`

Provisions and updates the **single self-hosted Convex staging backend on Azure
App Service** (not Convex Cloud, not Azure Container Apps), then deploys the
Convex functions. The open-source Convex backend is single-instance, so backend
image changes are applied **stop-first** — scale-out/slots against live Convex
state are unsafe.

### Trigger

`workflow_call` (from Release Staging) or `workflow_dispatch`.

### Fixed environment constants

Defined in the workflow `env`: resource group `retrotool-staging-rg`, ACR
`retrotoolstagingacr`, web app `retrotool-staging-convex`, API base
`https://retrotool-staging-api.azurewebsites.net`.

### Jobs

```
validate ──▶ deploy
```

#### 1. Validate

- Type-checks and lints `convex-backend`.
- Validates `convex-backend/compatibility.json`: the staging image must be pinned
  by `@sha256:` digest, and the manifest's `convexSdkVersion` must match the
  `convex` dependency in `convex-backend/package.json`.
- Logs into Azure (OIDC) and validates `infra/convex-staging.bicep`
  (`az bicep build`).

#### 2. Deploy

Runs in the `staging` GitHub environment. Key steps:

1. Verifies the required staging secrets are present (`CONVEX_INSTANCE_SECRET`,
   `CONVEX_POSTGRES_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`).
2. Resolves the desired digest-pinned image from `compatibility.json`.
3. Enforces the single-instance invariant — refuses to deploy if the app has more
   than one worker.
4. Detects whether the backend image is changing by comparing the app's
   `linuxFxVersion` to the desired `DOCKER|<image>`.
5. **When the image is changing:** takes a verified `convex export` (uploaded as a
   30-day retained artifact), then pauses the projection outbox (via the API,
   using `API_ADMIN_TOKEN`) and stops the web app (stop-first upgrade).
6. Provisions `infra/convex-staging.bicep` (`az deployment group create`) with the
   image, instance secret, and Postgres URL.
7. Starts the web app and waits for `/version` readiness (up to 60 attempts).
8. Verifies exactly one running instance.
9. Sets the Convex function env for JWT auth (`JWT_ISSUER`, `JWT_AUDIENCE=convex`,
   `JWT_JWKS_URL=<API_URL>/api/auth/jwks`) and runs `convex deploy`.
10. Re-checks `/version` health.
11. **After an image change:** resumes the projection outbox (replaying buffered
    events) and triggers a full projection reconciliation, both via the API's
    `/api/convex-admin` endpoints.

The outbox pause/resume and reconcile calls hit
`POST /api/convex-admin/outbox/pause`, `.../outbox/resume`, and
`.../reconcile-projections`. They require a super-admin bearer token
(`API_ADMIN_TOKEN`); if it is unset the steps warn and continue (events still
buffer durably).

### Concurrency

Group `deploy-convex-staging`, `cancel-in-progress: false`.

---

## Deploy API

**File:** `workflows/deploy-api.yml`

Builds and pushes the API image to ACR, migrates and seeds the database, then
deploys the container to **Azure App Service**.

### Trigger

`workflow_call` (from Release Staging) or `workflow_dispatch`. There is no branch
push trigger here — the push trigger lives in `release-staging.yml`.

### Environment

The `set-env` job hard-codes the target to `staging`; all deploy jobs run in the
`staging` GitHub environment.

### Jobs

```
validate → set-env → build → migrate → seed → deploy
```

#### 1. Validate

Lint, type-check, `test:ci`, and build for `retro-tool-api`.

#### 2. Set Environment

Emits `environment=staging`.

#### 3. Build

- Azure login (OIDC), then `az acr login`.
- Builds the API image from `retro-tool-api/Dockerfile` (workspace-root context).
- Tags with `staging-<sha8>`, `staging-latest`, and `staging-v<package.json version>`
  (the version tag makes rollbacks read as `v1.1.0 → v1.0.3` instead of SHA
  archaeology), and pushes all three.

#### 4. Migrate

- Installs and builds the API, verifies `dist/main.js` exists.
- Runs a DNS preflight against the `DATABASE_URL` host (fails early with guidance
  if the Flexible Server FQDN doesn't resolve from GitHub-hosted runners).
- Runs `pnpm db:migrate` against `DATABASE_URL`.

#### 5. Seed

Runs the idempotent seeders from `dist/seed/`: retro templates, estimate
templates, and team roles.

#### 6. Deploy

- Validates required deploy config (resource group, web app name, ACR, image tag,
  frontend URL, Convex sync URL, email-from, `DATABASE_URL`, `BETTER_AUTH_SECRET`)
  and warns on commonly-missing optional secrets (Convex admin key, VAPID keys).
  Also validates that the Microsoft OAuth client-id/secret pair is complete.
- Azure login (OIDC), then sets App Service app settings (non-secret env such as
  `NODE_ENV`, `PORT=8080`, CORS origins, `CONVEX_SYNC_URL`, cron flags,
  `MICROSOFT_TENANT_ID`, `EMAIL_FROM`) and secret app settings (`DATABASE_URL`,
  `BETTER_AUTH_SECRET`/`_URL`, Microsoft client id/secret, `RESEND_API_KEY`,
  `CONVEX_SYNC_ADMIN_KEY`, VAPID keys).
- Verifies the web app pulls from ACR via managed identity
  (`acrUseManagedIdentityCreds`), failing with a pointer to the Bicep
  provisioning command if not.
- Sets the container image (`az webapp config container set`) and restarts the app.
- Polls `/health/ready` until HTTP 200 (up to 60 attempts).
- On failure, collects Kudu Docker logs (with Azure CLI log fallbacks).

### Concurrency

Group `deploy-api-<ref_name>`, `cancel-in-progress: false` — deploys queue rather
than cancel to avoid mid-deploy conflicts.

---

## Deploy UI

**File:** `workflows/deploy-ui.yml`

Builds the Vite SPA and deploys it to an **Azure Static Web App**.

### Trigger

`workflow_call` (from Release Staging) or `workflow_dispatch`.

### Environment

`set-env` hard-codes `staging`; the deploy job runs in the `staging` GitHub
environment.

### Jobs

```
validate → set-env → deploy
```

#### 1. Validate

Lint, type-check, and test for `retro-tool-ui`.

#### 2. Deploy (build + upload)

- Validates the required UI build variables (see below), including that every
  realtime backend flag is `socket-io` or `convex`, that `VITE_APP_ENV` is one of
  `local|development|staging|production`, and — if any realtime backend is
  `convex` — that `VITE_CONVEX_URL` is set. URLs are parsed to confirm validity.
- Resolves the app version from `retro-tool-ui/package.json`.
- Builds with `pnpm --filter retro-tool-ui build`, passing all Vite build-time env.
- Deploys the built `retro-tool-ui/dist` via `Azure/static-web-apps-deploy@v1`
  (`skip_app_build` / `skip_api_build` — the build already ran).

#### Vite build variables (all required)

| Variable                                | Source (GitHub Actions variable)      |
| --------------------------------------- | ------------------------------------- |
| `VITE_APP_VERSION`                      | `v<retro-tool-ui package version>`    |
| `VITE_APP_TITLE`                        | `vars.VITE_APP_TITLE`                 |
| `VITE_APP_ENV`                          | `vars.VITE_APP_ENV`                   |
| `VITE_API_URL`                          | `vars.VITE_API_URL`                   |
| `VITE_CONVEX_URL`                       | `vars.VITE_CONVEX_URL`                |
| `VITE_ESTIMATES_REALTIME_BACKEND`       | `vars.VITE_ESTIMATES_REALTIME_BACKEND`      |
| `VITE_RETROS_REALTIME_BACKEND`          | `vars.VITE_RETROS_REALTIME_BACKEND`         |
| `VITE_ICEBREAKERS_REALTIME_BACKEND`     | `vars.VITE_ICEBREAKERS_REALTIME_BACKEND`    |
| `VITE_STANDUPS_REALTIME_BACKEND`        | `vars.VITE_STANDUPS_REALTIME_BACKEND`       |
| `VITE_NOTIFICATIONS_REALTIME_BACKEND`   | `vars.VITE_NOTIFICATIONS_REALTIME_BACKEND`  |

> **Note — no migration step.** The UI is a static SPA; there's no database to migrate.

### Concurrency

Group `deploy-ui-<ref_name>`, `cancel-in-progress: false`.

---

## Release Please

**File:** `workflows/release-please.yml`

Automated lockstep releases. On every push to `main`, `release-please` parses the
conventional-commit history and maintains a "release PR" that accumulates the
changelog and version bump (`feat` → minor, `fix` → patch, `feat!`/`BREAKING
CHANGE` → major). Merging that PR bumps every `package.json` version in lockstep,
updates `CHANGELOG.md`, tags `vX.Y.Z`, and creates the GitHub Release.

Uses `googleapis/release-please-action@v4` with `release-please-config.json` and
`.release-please-manifest.json`. Needs `contents: write` and
`pull-requests: write`; authenticates with the default `GITHUB_TOKEN`.

---

## Required GitHub Configuration

### Environments

Deploys run in a single GitHub Environment: **staging**. Add a required reviewer
gate on it if you want manual approval before staging deploys.

### Azure OIDC (all deploy workflows)

| Name (secret or variable) | Description               |
| ------------------------- | ------------------------- |
| `AZURE_CLIENT_ID`         | App registration client ID (OIDC login) |
| `AZURE_TENANT_ID`         | Azure AD tenant ID        |
| `AZURE_SUBSCRIPTION_ID`   | Azure subscription ID     |

### Deploy API

| Name                        | Kind          | Description                                   |
| --------------------------- | ------------- | --------------------------------------------- |
| `ACR_LOGIN_SERVER`          | var/secret    | ACR login server (`<name>.azurecr.io`)        |
| `API_IMAGE_REPOSITORY`      | var/secret    | Image repo (default `retro-tool-api`)         |
| `AZURE_RESOURCE_GROUP`      | var/secret    | Resource group of the API web app             |
| `API_WEBAPP_NAME`           | var/secret    | API App Service name                          |
| `FRONTEND_URL` / `SWA_URL`  | var/secret    | Frontend origin (CORS + Better Auth)          |
| `CONVEX_SYNC_URL`           | var/secret    | Convex admin URL for projection writes        |
| `EMAIL_FROM`                | var/secret    | Sender address                                |
| `DATABASE_URL`              | secret/var    | Postgres connection string (migrate + deploy) |
| `BETTER_AUTH_SECRET`        | secret/var    | Session signing secret                        |
| `MICROSOFT_CLIENT_ID`       | secret/var    | Better Auth Microsoft provider (falls back to `AZURE_CLIENT_ID`) |
| `MICROSOFT_CLIENT_SECRET`   | secret/var    | Better Auth Microsoft provider                |
| `MICROSOFT_TENANT_ID`       | var/secret    | Falls back to `AZURE_TENANT_ID`               |
| `RESEND_API_KEY`            | secret/var    | Transactional email                           |
| `CONVEX_SYNC_ADMIN_KEY`     | secret/var    | Convex admin key (warns if unset)             |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | var/secret | Web push (warns if unset) |

### Deploy Convex

| Name                          | Kind   | Description                                          |
| ----------------------------- | ------ | ---------------------------------------------------- |
| `CONVEX_INSTANCE_SECRET`      | secret | Convex backend instance secret                       |
| `CONVEX_POSTGRES_URL`         | secret | Postgres URL backing the Convex backend              |
| `CONVEX_SELF_HOSTED_ADMIN_KEY`| secret | Admin key for `convex export` / `convex deploy`      |
| `API_ADMIN_TOKEN`             | secret | Super-admin bearer for outbox pause/resume + reconcile (optional; warns if unset) |

> Resource group, ACR name, web app name, and API base URL for Convex are fixed
> constants in the workflow `env`, not repo configuration.

### Deploy UI

| Name                    | Kind   | Description                                    |
| ----------------------- | ------ | ---------------------------------------------- |
| `SWA_DEPLOYMENT_TOKEN`  | secret | Azure Static Web App deployment token          |
| `VITE_*` (table above)  | var    | Build-time Vite variables                      |

`GITHUB_TOKEN` (auto-provided) is used by both the UI deploy action and
release-please.

---

## Path Filters

Only `release-staging.yml` filters by path; the reusable `deploy-*` workflows have
no push trigger of their own. CI runs on any PR.

| Workflow        | Monitored paths                                                                 |
| --------------- | ------------------------------------------------------------------------------- |
| CI              | All PRs to `develop` / `staging` / `main`                                        |
| Release Staging | `convex-backend/**`, `infra/**`, `packages/shared/contracts/**`, `retro-tool-api/**`, `retro-tool-ui/**`, the `deploy-*.yml` + `release-staging.yml` files |
| Deploy Convex / API / UI | Reusable (`workflow_call`) or manual — no path filter                   |
| Release Please  | Push to `main` — no path filter                                                  |

---

## Visual Pipeline Flow

### Pull request (CI only)

```
┌──────────────────────────────────────────┐
│                 ci.yml                     │
│  audit (pnpm audit --prod)                 │
│  validate (install → lint → type-check     │
│            → test)                         │
└──────────────────────────────────────────┘
```

### Push to staging (staging deploy)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    convex    │──▶ │     api      │──▶ │      ui      │
│ (App Service │    │ (App Service │    │ (Static Web  │
│  stop-first) │    │  + migrate/  │    │  App build   │
│              │    │  seed)       │    │  + upload)   │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Push to main (release automation)

```
┌───────────────────────────────────────────────┐
│               release-please.yml                │
│  parse commits → maintain release PR →          │
│  (on merge) bump versions, changelog, tag       │
└───────────────────────────────────────────────┘
```
