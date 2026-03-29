# CI/CD Workflows

This directory contains all GitHub Actions workflows for the Retro Tool monorepo.

## Overview

```
feature/* ──PR──▶ develop ──PR──▶ main
                   │                 │
                   ▼                 ▼
               staging          production
```

| Workflow                                     | File                           | Trigger                                    | Target                |
| -------------------------------------------- | ------------------------------ | ------------------------------------------ | --------------------- |
| [CI](#ci)                                       | `workflows/ci.yml`           | PR to `develop` / `main`               | Validate all packages |
| [Deploy API](#deploy-api)                       | `workflows/deploy-api.yml`   | Push to `develop` / `main` (API paths) | AKS                   |
| [Deploy UI](#deploy-ui)                         | `workflows/deploy-ui.yml`    | Push to `develop` / `main` (UI paths)  | AKS                   |
| [Deploy Infrastructure](#deploy-infrastructure) | `workflows/deploy-infra.yml` | Manual only                                | Azure (Bicep)         |

---

## CI

**File:** `workflows/ci.yml`

Runs on every pull request targeting `develop` or `main`. Can also be triggered manually via `workflow_dispatch`.

### What it does

```
checkout → install (pnpm) → lint → type-check → test → build
```

All steps run against the **full workspace** — API, UI, and shared contracts are validated together to catch cross-package breakage early.

### Concurrency

Grouped by branch name. A new push to the same PR branch cancels any in-progress run to save runner minutes.

### Permissions

Read-only (`contents: read`). No secrets needed.

---

## Deploy API

**File:** `workflows/deploy-api.yml`

### Trigger

- **Automatic:** push to `develop` or `main` when files change in:
  - `retro-tool-api/**`
  - `packages/shared/contracts/**`
  - `.github/workflows/deploy-api.yml`
- **Manual:** `workflow_dispatch` with an environment selector (`staging` / `production`)

### Environment mapping

| Branch          | Environment          |
| --------------- | -------------------- |
| `develop`     | staging              |
| `main`        | production           |
| Manual dispatch | whichever you select |

### Jobs

```
validate → set-env → build-and-push → migrate → deploy
```

#### 1. Validate

Runs lint, type-check, tests (serial via `--runInBand`), and build for the `retro-tool-api` package.

#### 2. Set Environment

Determines the target environment (`staging` or `production`) based on the branch or manual input.

#### 3. Build & Push

- Logs into Azure via OIDC (federated credentials — no stored passwords)
- Logs into Azure Container Registry (ACR)
- Builds the API Docker image from `retro-tool-api/Dockerfile`
- Tags with `{env}-{short-sha}` and `{env}-latest`
- Pushes to ACR with GitHub Actions build cache (`type=gha`)

#### 4. Migrate

- Connects to the target AKS cluster
- Creates an ephemeral Kubernetes Job from the same image to run `node dist/migrate.js`
- Injects `DATABASE_URL` and other env vars from the `retro-tool-api-secrets` K8s Secret
- Waits up to 5 minutes for completion, then prints logs and cleans up the Job

#### 5. Deploy

- Uses `kubectl set image` to update the `retro-tool-api` Deployment with the new image
- Waits for the rollout to complete (3 min timeout)

### Concurrency

Grouped by branch. Concurrent deploys are **not** cancelled — they queue to avoid mid-deploy conflicts.

---

## Deploy UI

**File:** `workflows/deploy-ui.yml`

### Trigger

- **Automatic:** push to `develop` or `main` when files change in:
  - `retro-tool-ui/**`
  - `packages/shared/contracts/**`
  - `.github/workflows/deploy-ui.yml`
- **Manual:** `workflow_dispatch` with environment selector

### Environment mapping

Same as Deploy API (`develop` → staging, `main` → production).

### Jobs

```
validate → set-env → build-and-push → deploy
```

#### 1. Validate

Runs lint, type-check, tests, and build for the `retro-tool-ui` package.

#### 2. Set Environment

Same logic as the API workflow.

#### 3. Build & Push

- Logs into Azure via OIDC + ACR
- Builds from the **workspace root context** (the UI Dockerfile needs monorepo files: root `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packages/shared/contracts`)
- Passes Vite build-time variables as Docker `build-args`:| Build Arg                               | Source                                     |
  | --------------------------------------- | ------------------------------------------ |
  | `VITE_APP_ENV`                        | `staging` or `production`              |
  | `VITE_API_URL`                        | GitHub environment variable `API_URL`    |
  | `VITE_APP_TITLE`                      | `Retro Tool`                             |
  | `VITE_CONVEX_URL`                     | GitHub environment variable `CONVEX_URL` |
  | `VITE_ESTIMATES_REALTIME_BACKEND`     | Defaults to `socket-io`                  |
  | `VITE_RETROS_REALTIME_BACKEND`        | Defaults to `socket-io`                  |
  | `VITE_NOTIFICATIONS_REALTIME_BACKEND` | Defaults to `socket-io`                  |
- Tags and pushes to ACR with GHA build cache

#### 4. Deploy

- Updates the `retro-tool-ui` Deployment image on AKS
- Waits for rollout (3 min timeout)

> **Note — no migration step.** The UI is a static SPA; there's no database to migrate.

---

## Deploy Infrastructure

**File:** `workflows/deploy-infra.yml`

### Trigger

Manual only (`workflow_dispatch`). You choose the target environment.

### Jobs

```
login → validate Bicep → what-if preview → deploy
```

#### Steps

1. **Azure login** — OIDC federated credentials
2. **Validate** — `az bicep build` to catch syntax errors
3. **What-If** — `az deployment group what-if` to preview changes (no resources modified)
4. **Deploy** — `az deployment group create` to apply the Bicep template

### Parameters passed

| Parameter                 | Source                                    |
| ------------------------- | ----------------------------------------- |
| `environmentName`       | Selected environment                      |
| `postgresAdminPassword` | GitHub secret `POSTGRES_ADMIN_PASSWORD` |

---

## Required GitHub Configuration

### Environments

Create two GitHub Environments: **staging** and **production**.
Optionally add a required reviewer gate on `production`.

### Secrets (per environment)

| Secret                      | Description                                   |
| --------------------------- | --------------------------------------------- |
| `AZURE_CLIENT_ID`         | App registration client ID (for OIDC)         |
| `AZURE_TENANT_ID`         | Azure AD tenant ID                            |
| `AZURE_SUBSCRIPTION_ID`   | Azure subscription ID                         |
| `POSTGRES_ADMIN_PASSWORD` | Postgres admin password (infra workflow only) |

### Variables (per environment)

| Variable                           | Example                                  | Used by       |
| ---------------------------------- | ---------------------------------------- | ------------- |
| `ACR_NAME`                       | `retrotoolstgacr`                      | API, UI       |
| `ACR_LOGIN_SERVER`               | `retrotoolstgacr.azurecr.io`           | API, UI       |
| `AKS_RESOURCE_GROUP`             | `retro-tool-staging`                   | API, UI       |
| `AKS_CLUSTER_NAME`               | `retro-tool-staging-aks`               | API, UI       |
| `AZURE_RESOURCE_GROUP`           | `retro-tool-staging`                   | Infra         |
| `API_URL`                        | `https://api.staging.retrotool.dev`    | UI            |
| `CONVEX_URL`                     | `https://convex.staging.retrotool.dev` | UI            |
| `ESTIMATES_REALTIME_BACKEND`     | `socket-io`                            | UI (optional) |
| `RETROS_REALTIME_BACKEND`        | `socket-io`                            | UI (optional) |
| `NOTIFICATIONS_REALTIME_BACKEND` | `socket-io`                            | UI (optional) |

---

## Path Filters

Workflows only trigger when relevant files change, saving runner minutes:

| Workflow     | Monitored paths                                         |
| ------------ | ------------------------------------------------------- |
| CI           | All files (any PR)                                      |
| Deploy API   | `retro-tool-api/**`, `packages/shared/contracts/**` |
| Deploy UI    | `retro-tool-ui/**`, `packages/shared/contracts/**`  |
| Deploy Infra | Manual only — no path filter                           |

> Shared contracts (`packages/shared/contracts/**`) trigger both API and UI deploys because either service may depend on contract changes.

---

## Visual Pipeline Flow

### Pull Request (CI only)

```
┌──────────────────────────────────┐
│         ci.yml (PR gate)         │
│  install → lint → type-check     │
│  → test → build                  │
└──────────────────────────────────┘
```

### Merge to develop (staging deploy)

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     validate     │     │  build & push    │     │     migrate      │
│   (lint/test/    │─▶ │ (Docker → ACR)    │──▶│    (K8s Job)     │
│     build)       │     │                  │     │                  │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │      deploy      │
                                                  │ (kubectl rollout)│
                                                  │                  │
                                                  └──────────────────┘
```

### Manual infra deploy

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  validate Bicep  │────▶│  what-if preview │────▶│    deploy    │
│  (syntax check)  │     │  (dry run)       │     │ (az deploy)  │
└─────────────────┘     └──────────────────┘     └──────────────┘
```
