# Retro Tool

Retro Tool is a monorepo for a collaborative agile retrospective and story-estimation platform.

It currently consists of:

- `retro-tool-ui`: React 19 frontend
- `retro-tool-api`: NestJS API and Socket.IO backend
- `convex-backend`: self-hosted Convex realtime projection layer
- `packages/shared/contracts`: shared realtime contracts used by the UI and Convex integration
- `infra/bicep`: Azure infrastructure scaffold
- `deploy/aks`: AKS manifest scaffold
- `docker/docker-compose.local.yml`: local container stack

## Documentation Index

- [retro-tool-ui/README.md](retro-tool-ui/README.md): frontend module documentation
- [retro-tool-api/README.md](retro-tool-api/README.md): backend API documentation
- [convex-backend/README.md](convex-backend/README.md): Convex backend notes
- [RBAC.md](RBAC.md): role and permission model
- [plan-convex-realtime.md](plan-convex-realtime.md): Convex realtime architecture and rollout plan
- [infra/bicep/README.md](infra/bicep/README.md): Azure Bicep scaffold overview
- [deploy/aks/README.md](deploy/aks/README.md): AKS deployment scaffold overview
- [retro-tool-api/docs/Cache.md](retro-tool-api/docs/Cache.md): backend cache notes
- [retro-tool-api/docs/Email.md](retro-tool-api/docs/Email.md): backend email notes
- [retro-tool-api/docs/RBAC.md](retro-tool-api/docs/RBAC.md): backend RBAC notes
- [retro-tool-ui/docs/Cache.md](retro-tool-ui/docs/Cache.md): frontend cache notes
- [retro-tool-ui/docs/Email.md](retro-tool-ui/docs/Email.md): frontend email notes

## Monorepo Structure

```text
.
├── convex-backend/
├── deploy/
│   └── aks/
├── docker/
│   └── docker-compose.local.yml
├── infra/
│   └── bicep/
├── packages/
│   └── shared/
│       └── contracts/
├── retro-tool-api/
├── retro-tool-ui/
├── package.json
└── pnpm-workspace.yaml
```

## Architecture

### Application runtime

- Frontend: React + TanStack Router + TanStack Query
- Primary backend: NestJS + PostgreSQL + Redis + Socket.IO
- Realtime projection layer: self-hosted Convex
- Shared persistence model: PostgreSQL remains the main system of record

### Realtime model

The current direction is hybrid:

- NestJS remains the authoritative business backend.
- Socket.IO still works as the fallback realtime transport.
- Convex is being added as a subscription-first projection layer for active retro and estimate collaboration.
- Feature flags in the UI decide whether estimates and retros use Socket.IO or Convex-driven invalidation.

## Workspace Commands

Run all commands from the repository root unless noted otherwise.

```bash
pnpm install
pnpm build
pnpm lint
pnpm type-check
pnpm test
```

Useful focused commands:

```bash
pnpm dev:api
pnpm dev:ui
pnpm dev:convex
```

## Prerequisites

- Node.js 22 recommended
- pnpm 9
- Docker Desktop
- Git

Optional but useful:

- Azure CLI for deployment work
- kubectl for AKS deployment work

## Local Development

There are two practical ways to run the project locally.

### Option 1: Full local container stack

This is the fastest way to boot the whole application with one command.

```bash
docker compose -f docker/docker-compose.local.yml up --build
```

Services exposed by the local stack:

| Service | URL / Port | Notes |
| --- | --- | --- |
| UI | `http://localhost:3000` | nginx-served frontend container |
| API | `http://localhost:8000` | NestJS backend |
| Swagger | `http://localhost:8000/api/docs` | API docs |
| PostgreSQL | `localhost:5432` | seeded by `docker/postgres/init` |
| Redis | `localhost:6379` | optional cache layer |
| Convex API | `http://localhost:3210` | self-hosted Convex backend |
| Convex dashboard | `http://localhost:6791` | local Convex dashboard |

Notes:

- The compose file creates a local Postgres server and initializes multiple databases.
- `CONVEX_SYNC_ADMIN_KEY` is empty by default in the API container config. Convex projection sync will not work until you provide a valid admin key.
- This path is best when you want runtime parity with the intended container deployment model.

### Option 2: Hybrid local development with pnpm

This is the better option when you want live reload while still using local infrastructure containers.

Start infrastructure first:

```bash
docker compose -f docker/docker-compose.local.yml up -d postgres redis convex-backend convex-dashboard
```

Then run the apps directly:

```bash
pnpm dev:api
pnpm dev:ui
```

You can also start Convex dev tooling separately if your self-hosted deployment is configured:

```bash
pnpm dev:convex
```

## Environment Setup

### 1. Root workspace

No root `.env` file is required.

Install dependencies once:

```bash
pnpm install
```

### 2. API environment

Create the API env file:

```bash
cd retro-tool-api
cp .env.example .env
```

Minimum values to review in [retro-tool-api/.env.example](retro-tool-api/.env.example):

- `PORT=8000`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `FRONTEND_URL`
- `ALLOWED_ORIGINS`
- `REDIS_URL`

Optional but important for the Convex integration:

- `CONVEX_SYNC_URL`
- `CONVEX_SYNC_ADMIN_KEY`

### 3. UI environment

The UI uses Vite env vars. Create `retro-tool-ui/.env.local` manually.

Recommended local values:

```env
VITE_APP_TITLE=Retro Tool
VITE_APP_ENV=local
VITE_API_URL=http://localhost:8000
VITE_CONVEX_URL=http://localhost:3210
VITE_ESTIMATES_REALTIME_BACKEND=socket-io
VITE_RETROS_REALTIME_BACKEND=socket-io
```

If you want to test Convex-backed invalidation locally, switch one or both feature flags to `convex`.

### 4. Convex environment

Create the Convex env file:

```bash
cd convex-backend
cp .env.example .env.local
```

See [convex-backend/.env.example](convex-backend/.env.example) for the current variables:

- `CONVEX_SELF_HOSTED_URL`
- `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `CONVEX_CLOUD_URL`
- `CONVEX_DEPLOYMENT`

## Recommended Local Run Order

### With Docker only

```bash
docker compose -f docker/docker-compose.local.yml up --build
```

### With pnpm app processes

```bash
pnpm install
docker compose -f docker/docker-compose.local.yml up -d postgres redis convex-backend convex-dashboard
pnpm dev:api
pnpm dev:ui
```

## Validation Commands

Use these before opening a PR:

```bash
pnpm lint
pnpm type-check
pnpm test
```

Package-specific checks:

```bash
pnpm --filter retro-tool-api type-check
pnpm --filter retro-tool-ui type-check
pnpm --filter @retro-tool/contracts type-check
```

## Database and Seed Workflow

For the API package, the most useful DB commands are:

```bash
pnpm --dir retro-tool-api db:generate
pnpm --dir retro-tool-api db:migrate
pnpm --dir retro-tool-api db:seed
pnpm --dir retro-tool-api db:studio
```

If you are using the full Docker stack, the local Postgres server is already started for you.

## Current Deployment Model

The repository is currently scaffolded for Azure container deployment, with:

- Bicep infrastructure under [infra/bicep](infra/bicep)
- AKS manifests under [deploy/aks](deploy/aks)
- GitHub Actions workflows for API and UI image validation and deployment

### Branch model

- `develop` -> staging
- `main` -> production

### Current CI/CD entrypoints

- [retro-tool-api/.github/workflows/main_retro-tool.yml](retro-tool-api/.github/workflows/main_retro-tool.yml)
- [retro-tool-ui/.github/workflows/azure-static-web-apps-gentle-moss-0c353ee03.yml](retro-tool-ui/.github/workflows/azure-static-web-apps-gentle-moss-0c353ee03.yml)

### Important deployment status

The deployment workflows are scaffolds, not finished production automation.

You must replace placeholder values before first deployment, including:

- Azure tenant and subscription values
- ACR name and login server
- AKS resource group and cluster name
- Staging and production API URLs for the UI workflow

### Azure deployment flow

1. Provision or finish the Azure infrastructure definition in [infra/bicep](infra/bicep).
2. Complete or adjust the Kubernetes manifests in [deploy/aks](deploy/aks).
3. Set workflow environment values and secrets in the two GitHub Actions workflow files.
4. Push to `develop` to validate and deploy to staging.
5. Promote to `main` to validate and deploy to production.

### Intended runtime topology

- AKS runs the UI container, API container, and self-hosted Convex services.
- Azure Database for PostgreSQL Flexible Server stores the durable application and Convex data in separate databases.
- Azure Key Vault is intended for secret management.
- Application Insights and Log Analytics are intended for observability.

## Deployment Checklist

Before deploying, verify all of the following:

- Bicep environment files are completed for staging and production.
- AKS namespaces, ingress, deployments, and services are finalized.
- API image builds successfully from [retro-tool-api/Dockerfile](retro-tool-api/Dockerfile).
- UI image builds successfully from [retro-tool-ui/Dockerfile](retro-tool-ui/Dockerfile).
- Postgres connection strings are correct for app and Convex workloads.
- `CONVEX_SYNC_URL` and `CONVEX_SYNC_ADMIN_KEY` are configured where Convex projection sync is expected.
- UI `VITE_API_URL` and Convex feature flags are set correctly per environment.

## Known Project Notes

- Convex is integrated as a realtime projection layer, not a replacement for the NestJS API.
- Socket.IO still exists and remains the fallback realtime path.
- The Convex package in this repo is currently scaffolded for self-hosted usage.
- Convex admin-key-based sync from the API is optional until you enable it in env configuration.

## Where To Start

If you are new to the repo, use this order:

1. Read this file.
2. Read [retro-tool-api/README.md](retro-tool-api/README.md).
3. Read [retro-tool-ui/README.md](retro-tool-ui/README.md).
4. Read [plan-convex-realtime.md](plan-convex-realtime.md) if you are working on realtime or deployment.
5. Start the local stack with Docker Compose or the hybrid pnpm flow.
