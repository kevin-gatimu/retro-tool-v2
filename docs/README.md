# Retro Tool documentation

Project-wide documentation, organized by domain. File names are **kebab-case**; each doc opens with a
one-line summary. When a doc and the code disagree, trust the code — and please update the doc (the
[`doc-maintainer`](../.claude/agents/doc-maintainer.md) agent exists for exactly this).

## guidelines/ — how we write code

| Doc | What it covers |
|---|---|
| [coding-guidelines.md](guidelines/coding-guidelines.md) | The numbered rulebook: folders, naming, TypeScript, readability, React, NestJS, checks, scripts, versioning |
| [file-naming-conventions.md](guidelines/file-naming-conventions.md) | UI file naming (kebab-case files, idiomatic export names, route-file exception) |

## architecture/ — how the system is built

| Doc | What it covers |
|---|---|
| [overview.md](architecture/overview.md) | System architecture design document — components, data flow, tech stack, module tree |
| [cloud.md](architecture/cloud.md) | Azure cloud architecture — every resource by environment, topology diagram, SKUs, cost posture, which workflow deploys what |
| [convex.md](architecture/convex.md) | How the app uses Convex: topology, keys/secrets, projection schema, NestJS→Convex sync, UI consumption, deploy workflow |
| [convex-concurrency.md](architecture/convex-concurrency.md) | How the projection layer stays correct under concurrent writes (OCC, point reads, idempotency) |
| [caching.md](architecture/caching.md) | TanStack Query config/invalidation, Convex as the realtime read-reduction layer, no server-side cache (Redis not used) |

## security/ — frontend, backend, database, auth, RBAC

| Doc | What it covers |
|---|---|
| [frontend.md](security/frontend.md) | UI security posture: token storage, what's exposed to the browser, XSS/CSP, route/RBAC gating, residual risk |
| [backend-api.md](security/backend-api.md) | API hardening: Helmet, rate limiting, CORS, CSRF posture |
| [database.md](security/database.md) | DB security: TLS/SSL to Azure Postgres, credential injection, SQL-injection posture, no-RLS reality, residual risk |
| [authentication.md](security/authentication.md) | Every sign-in method (password, email-OTP, passkey, Microsoft OAuth), the credential model, and the file-level flow map |
| [convex-nestjs-auth.md](security/convex-nestjs-auth.md) | The Convex↔NestJS trust relationship: RS256 JWT issue/verify, JWKS, config that must line up |
| [authorization-rbac.md](security/authorization-rbac.md) | Full permission matrices (system / org / team / retro), helper signatures, user-status lifecycle |

## database/ — tables, keys, schemas, relationships

| Doc | What it covers |
|---|---|
| [schema.md](database/schema.md) | Every table by domain (columns, keys, FKs, indexes), all enums, and the core entity-relationship diagram |

## infra/ — Azure Bicep IaC (raw templates & commands)

| Doc | What it covers |
|---|---|
| [provisioning.md](infra/provisioning.md) | Command reference for the [`infra/`](../infra/) Bicep templates: login/deploy/what-if/destroy, GitHub environment secrets & variables, post-provisioning checklist, resources created, self-hosted Convex (staging + production) |
| [oidc.md](infra/oidc.md) | GitHub Actions OIDC federated-credential setup (`setup-oidc-credentials.ps1`), troubleshooting |

## deployment/ — Azure & Convex self-hosting

| Doc | What it covers |
|---|---|
| [azure-resources.md](deployment/azure-resources.md) | Azure resource inventory and architecture snapshot (legacy pre-Bicep production names); cross-links to [infra/provisioning.md](infra/provisioning.md) for the Bicep commands |
| [convex-self-hosting.md](deployment/convex-self-hosting.md) | Running Convex in Docker (local + production): env vars, admin key, ports, troubleshooting |
| [convex-staging-runbook.md](deployment/convex-staging-runbook.md) | Phase-by-phase staging Convex self-hosting deploy + rollback runbook |
| [convex-production-runbook.md](deployment/convex-production-runbook.md) | Phase-by-phase production Convex self-hosting deploy + rollback runbook |
| [convex-azure-self-hosting-plan.md](deployment/convex-azure-self-hosting-plan.md) | Architecture & decision plan for self-hosting Convex on Azure App Service |
| [new-azure-subscription.md](deployment/new-azure-subscription.md) | End-to-end deploy of Retro Tool to a brand-new Azure subscription |
| [release-and-branch-strategy.md](deployment/release-and-branch-strategy.md) | Branch model, release-please lockstep versioning, conventional commits, and deployment triggers (including the staging-only gap for production) |

## workflows/ — operational & product flows

| Doc | What it covers |
|---|---|
| [running-the-app.md](workflows/running-the-app.md) | Running the app locally, against staging, and against production |
| [invitations-and-onboarding.md](workflows/invitations-and-onboarding.md) | Invitation system (org + team), accept-invite journey, acceptance logic, onboarding & password rules |
| [app-flows.md](workflows/app-flows.md) | Every major user-facing flow (auth, org, team, retro, estimates, notifications) |
| [email.md](workflows/email.md) | Email-triggered UI flows: verification, password reset, org invite, team join request, retro report |

## Root

| Doc | What it covers |
|---|---|
| [future-roadmap.md](future-roadmap.md) | Planned features: AI summaries, Jira/ADO export, SAML, Team Spaces |

## End-user guide

The user-facing guide is **not** under `docs/` — it lives in `retro-tool-ui/docs/` and is built
with VitePress. It is served same-origin at `/docs` from the Azure Static Web App.
Full maintainer reference (architecture, how to run it, adding pages/images, deploy):
[guidelines/user-guide-docs.md](guidelines/user-guide-docs.md).
Do not edit `retro-tool-ui/docs/` from here — that tree is the guide's own content.
