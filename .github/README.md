# Retro Tool

**Retro Tool** brings every recurring team ceremony into one place: retrospectives, story estimates,
async standups, icebreakers, polls, and surveys.

Every board is live — add a card, cast a vote, or advance a phase and all participants see it
immediately, with no refresh. Unresolved action items carry forward into the next retro, and reports
track completion rates and action-item health over time. Access is scoped end to end by system,
organization, and team roles.

It runs on infrastructure you control: PostgreSQL as the system of record, self-hosted Convex for
realtime. Convex Cloud is not used in any environment.

---

## Features

The table structure mirrors the app's sidebar navigation groups.

### Dashboard

| Feature | What it does | Convex live function | Route |
|---|---|---|---|
| **Dashboard** | Home screen: stat cards (total retros, teams, cards created, total votes), recent retros list, active survey and poll counts, quick-action links. | — | `/dashboard` |

### Ceremonies

| Feature | What it does | Convex live function | Route |
|---|---|---|---|
| **Retrospectives** | Phased boards moving through `draft → waiting → active → grouping → voting → discussing → completed`. Cards, threaded comments, voting, carry-forward across sessions, templates (Start/Stop/Continue, 4Ls, Mad/Sad/Glad, and more), action items, emailed reports. | `liveRetros` | `/retros` |
| **Story Estimate** | Real-time story estimate sessions: rounds, participant votes, reveal, consensus tracking, per-story revote, built-in timer, emailed reports. Fully templated (Fibonacci, T-shirt sizes, and custom). | `liveEstimates` | `/estimate` |
| **Standups** | Async daily standup cadence per team: entries and submissions by date, skip days, comments on submissions, emoji reactions, send-report, team activity view. | `liveStandups` | `/standups` |

### Engagement

| Feature | What it does | Convex live function | Route |
|---|---|---|---|
| **Icebreakers** | Facilitated icebreaker sessions: prompt-based swipe/advance flow with a built-in timer. A session either picks an icebreaker template or uses host-authored one-off prompts. Icebreaker templates are managed in the Admin Panel (`/admin/templates`), not `/templates`. | `liveIcebreakers` | `/icebreakers` |
| **Polls** | Quick-vote polls with a voting lifecycle (open → voted → closed) and email distribution. | `livePolls` | `/polls` |
| **Surveys** | Team or org-scoped surveys with typed questions (multiple-choice, open text). Create, distribute, collect responses, close, and email results. | `liveSurveys` | `/surveys` |

### Library

| Feature | What it does | Convex live function | Route |
|---|---|---|---|
| **Templates** | Browse and manage retro templates and estimate templates — both built-in and org-custom. Retro templates define card columns; estimate templates define point scales. Icebreaker templates live in the Admin Panel (`/admin/templates`) instead. | — | `/templates` |
| **Reports** | Analytics dashboards: retro completion rates, card/vote counts, action-item health, and more. | — | `/reports` |

### Account

| Feature | What it does | Convex live function | Route |
|---|---|---|---|
| **Organizations** | Top-level multi-tenant boundary. Org-owners and org-admins manage members and settings. | — | `/organizations` |
| **Teams** | Teams within an org. Team-leads and members; fine-grained team roles. | `liveTeamMembers` | `/teams` |
| **Profile** | User profile, password/security settings, notification preferences, and active session management. | — | `/profile` |

### Admin Panel

Visible only to `super-admin` and `system-admin` roles. Route `/admin`. Includes the Convex projection health tools described in Platform Capabilities below.

---

### Platform Capabilities

Supporting modules that power the nav features above — not direct sidebar entries.

| Capability | What it does | Notes |
|---|---|---|
| **Action Items** | Per-retro action items with carry-forward so unresolved items surface in the next session. | Surfaces inside `/retros/:id`; tracked via `liveRetros` |
| **Notifications** | In-app notification centre + browser push notifications (VAPID via `web-push`). | Bell icon in header; `liveNotifications` |
| **Email** | Transactional email via Resend: invites, OTP verification, password reset, weekly digest, retro / standup reports. | — |
| **Auth & Sessions** | Email + password, email OTP, passkey, and Microsoft OAuth — all via Better Auth with multi-session support. | `/auth` |
| **Invitations** | Org and team invitations by email; accept-invite journey with onboarding. | — |
| **User Preferences** | Per-user notification preferences and appearance settings. | Accessible from `/profile` |
| **Convex Admin** | Projection outbox management (pause / resume / replay), full reconciliation, cron config, usage metrics. Super-admin only. | Under `/admin` (Admin Panel) |

---

## Monorepo Layout

```
retro-tool/
├── retro-tool-api/        # NestJS 11 REST backend (all durable state)
│   ├── src/               # One subfolder per module (controller, service, schema, dto, types)
│   └── drizzle/           # Postgres migrations
├── retro-tool-ui/         # React 19 + TanStack Router SPA
│   ├── src/routes/        # File-based routing
│   └── docs/              # VitePress end-user guide (served at /docs)
├── convex-backend/        # Self-hosted Convex realtime projection layer
│   └── convex/            # live*.ts functions + schema + rateLimits
├── packages/
│   └── shared/contracts/  # Shared TypeScript contracts (UI ↔ Convex)
├── infra/                 # Azure Bicep templates (CLI-only; not in CI)
├── docker/                # docker-compose.local.yml for local dev
├── .github/workflows/     # CI/CD (see workflows/README.md)
└── docs/                  # Internal maintainer documentation (this tree)
```

---

## Architecture in Brief

**PostgreSQL is the system of record.** All durable writes go to Postgres via the NestJS API.
Convex holds only active collaboration snapshots — the API pushes a projection after each mutation.
No business logic lives in Convex mutations; Convex is purely a real-time read layer.

```
Browser ──REST──▶ NestJS API ──Drizzle──▶ PostgreSQL
           │                     │
     Convex SDK              projection
           │                   push
           └──subscribe──▶  Convex (snapshot)
```

Every deployed environment (staging, production, and local Docker) runs its own self-hosted Convex
instance — Convex Cloud is not used anywhere.

Full detail: [`../docs/architecture/overview.md`](../docs/architecture/overview.md) and
[`../docs/architecture/convex.md`](../docs/architecture/convex.md).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Router (file-based), TanStack Query / Form / Table |
| Styling | TailwindCSS 4, Radix UI, shadcn/ui pattern |
| Auth client | Better Auth |
| Realtime (UI) | Convex React SDK (self-hosted) |
| API | NestJS 11, TypeScript |
| Database | PostgreSQL 16 via Drizzle ORM |
| Auth server | Better Auth + `@thallesp/nestjs-better-auth` |
| Realtime projection | Self-hosted Convex (Docker locally, Azure App Service for staging + production) |
| Email | Resend |
| Push notifications | `web-push` (VAPID) |
| Scheduler | `@nestjs/schedule` |
| Validation | `class-validator` + Zod |
| Infrastructure | Azure Bicep (CLI-only; no IaC in CI) |
| CI/CD | GitHub Actions |

---

## Quick Start

```bash
# Install all workspace dependencies
pnpm install

# Full local stack (Docker: Postgres + self-hosted Convex + apps)
pnpm local:up

# Or: start only infra, then run apps natively
pnpm local:infra
pnpm dev:api       # NestJS on :8000
pnpm dev:ui        # Vite on :3000
pnpm dev:convex    # Convex function watcher
```

Local service URLs:

| Service | URL |
|---|---|
| UI | `http://localhost:3000` |
| API | `http://localhost:8000` |
| Swagger | `http://localhost:8000/api/docs` |
| Convex Admin API | `http://localhost:3210` |
| Convex Dashboard | `http://localhost:6791` |
| PostgreSQL | `localhost:5432` |

Full instructions (env files, staging/prod local dev, seed workflow):
[`../docs/workflows/running-the-app.md`](../docs/workflows/running-the-app.md).

---

## CI/CD

| Branch | Automatic deploy | Manual dispatch available |
|---|---|---|
| `staging` | Convex → API → UI to staging (via `release-staging.yml`) | Yes |
| `main` | Release Please only (changelog + version tag) | `deploy-api`, `deploy-ui`, `deploy-convex-production` → production |

Full workflow reference (all jobs, secrets, environment constants, path filters):
[`workflows/README.md`](workflows/README.md).

---

## Documentation Index

### Guidelines

| Doc | What it covers |
|---|---|
| [`../docs/guidelines/ai-agent-guidelines.md`](../docs/guidelines/ai-agent-guidelines.md) | Vendor-neutral workflow and safety checklist for AI-assisted changes |
| [`../docs/guidelines/coding-guidelines.md`](../docs/guidelines/coding-guidelines.md) | Numbered rulebook: folders, naming, TypeScript, readability, React, NestJS, checks, scripts, versioning |
| [`../docs/guidelines/file-naming-conventions.md`](../docs/guidelines/file-naming-conventions.md) | UI file naming: kebab-case files, idiomatic export names, route-file exception |
| [`../docs/guidelines/user-guide-docs.md`](../docs/guidelines/user-guide-docs.md) | How the VitePress end-user guide (`retro-tool-ui/docs/`) is built and run |

### Architecture

| Doc | What it covers |
|---|---|
| [`../docs/architecture/overview.md`](../docs/architecture/overview.md) | System architecture: components, data flow, tech stack, module tree |
| [`../docs/architecture/cloud.md`](../docs/architecture/cloud.md) | Azure cloud architecture: every resource by environment, topology, SKUs, cost posture, deploy workflows |
| [`../docs/architecture/convex.md`](../docs/architecture/convex.md) | Convex topology, keys/secrets, projection schema, NestJS→Convex sync, UI consumption, deploy workflow |
| [`../docs/architecture/convex-concurrency.md`](../docs/architecture/convex-concurrency.md) | How the projection layer stays correct under concurrent writes (OCC, point reads, idempotency) |
| [`../docs/architecture/caching.md`](../docs/architecture/caching.md) | TanStack Query config/invalidation; Convex as the realtime read-reduction layer; no server-side cache |

### Security

| Doc | What it covers |
|---|---|
| [`../docs/security/frontend.md`](../docs/security/frontend.md) | UI security: token storage, what's in the browser, XSS/CSP posture, route/RBAC gating, residual risk |
| [`../docs/security/backend-api.md`](../docs/security/backend-api.md) | API hardening: Helmet, rate limiting (throttler + Better Auth), CORS, CSRF posture |
| [`../docs/security/database.md`](../docs/security/database.md) | DB security: TLS to Azure Postgres, credential injection, SQL-injection posture, no-RLS reality |
| [`../docs/security/authentication.md`](../docs/security/authentication.md) | Every sign-in method (password, email-OTP, passkey, Microsoft OAuth), credential model, flow map |
| [`../docs/security/convex-nestjs-auth.md`](../docs/security/convex-nestjs-auth.md) | Convex↔NestJS trust: RS256 JWT issue/verify, JWKS exchange, config alignment |
| [`../docs/security/authorization-rbac.md`](../docs/security/authorization-rbac.md) | Full permission matrices (system / org / team / retro), helper signatures, user-status lifecycle |

### Database

| Doc | What it covers |
|---|---|
| [`../docs/database/schema.md`](../docs/database/schema.md) | Every table by domain (columns, keys, FKs, indexes), all enums, entity-relationship diagram |

### Infrastructure (Azure Bicep)

| Doc | What it covers |
|---|---|
| [`../docs/infra/provisioning.md`](../docs/infra/provisioning.md) | Command reference for `infra/` Bicep templates: login/deploy/what-if/destroy, secrets checklist |
| [`../docs/infra/oidc.md`](../docs/infra/oidc.md) | GitHub Actions OIDC federated-credential setup, troubleshooting |

### Deployment

| Doc | What it covers |
|---|---|
| [`../docs/deployment/azure-resources.md`](../docs/deployment/azure-resources.md) | Azure resource inventory (legacy pre-Bicep production names); links to provisioning commands |
| [`../docs/deployment/convex-self-hosting.md`](../docs/deployment/convex-self-hosting.md) | Running Convex in Docker (local + production): env vars, admin key, ports, troubleshooting |
| [`../docs/deployment/convex-staging-runbook.md`](../docs/deployment/convex-staging-runbook.md) | Phase-by-phase staging Convex self-hosting deploy and rollback runbook |
| [`../docs/deployment/convex-production-runbook.md`](../docs/deployment/convex-production-runbook.md) | Phase-by-phase production Convex self-hosting deploy and rollback runbook |
| [`../docs/deployment/convex-azure-self-hosting-plan.md`](../docs/deployment/convex-azure-self-hosting-plan.md) | Architecture and decision plan for self-hosting Convex on Azure App Service |
| [`../docs/deployment/new-azure-subscription.md`](../docs/deployment/new-azure-subscription.md) | End-to-end deploy of Retro Tool to a brand-new Azure subscription |
| [`../docs/deployment/release-and-branch-strategy.md`](../docs/deployment/release-and-branch-strategy.md) | Branch model, release-please lockstep versioning, conventional commits, deployment triggers |
| [`../docs/deployment/scaling-self-hosted-convex.md`](../docs/deployment/scaling-self-hosted-convex.md) | Options when a single self-hosted Convex instance becomes the throughput ceiling (proposed) |

### Workflows

| Doc | What it covers |
|---|---|
| [`../docs/workflows/running-the-app.md`](../docs/workflows/running-the-app.md) | Running locally, against staging, and against production |
| [`../docs/workflows/invitations-and-onboarding.md`](../docs/workflows/invitations-and-onboarding.md) | Org and team invitations, accept-invite journey, onboarding and password rules |
| [`../docs/workflows/app-flows.md`](../docs/workflows/app-flows.md) | Every major user-facing flow: auth, org, team, retro, estimates, notifications |
| [`../docs/workflows/email.md`](../docs/workflows/email.md) | Email-triggered UI flows: verification, password reset, org invite, team join request, retro report |

### Root

| Doc | What it covers |
|---|---|
| [`../docs/future-roadmap.md`](../docs/future-roadmap.md) | Planned features: AI summaries, Jira/ADO export, SAML, Team Spaces |
| [`../docs/README.md`](../docs/README.md) | Full documentation index |

### Package READMEs

| Package | README |
|---|---|
| NestJS API | [`../retro-tool-api/README.md`](../retro-tool-api/README.md) |
| React UI | [`../retro-tool-ui/README.md`](../retro-tool-ui/README.md) |
| Convex backend | [`../convex-backend/README.md`](../convex-backend/README.md) |

### End-user guide

The user-facing guide lives in `retro-tool-ui/docs/` and is built with VitePress. It is served
same-origin at `/docs` from the Azure Static Web App. Do not edit it here — see
[`../docs/guidelines/user-guide-docs.md`](../docs/guidelines/user-guide-docs.md) for the maintainer
reference (architecture, how to run it, adding pages, deploy).
