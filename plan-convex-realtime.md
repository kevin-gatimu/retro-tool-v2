# Convex Realtime Plan for Retro and Story Estimate

Date: March 27, 2026

## Goal

Improve speed and collaboration responsiveness for retrospective and story estimate features by introducing low-latency realtime capabilities with Convex, while running both NestJS and Convex on Azure containers with AKS ingress and preserving PostgreSQL compatibility through separate databases.

## Executive Summary

This plan formalizes a dual-backend architecture and delivery model:

- NestJS remains the durable business backend.
- Convex becomes the realtime subscription and fanout backend.
- One Azure PostgreSQL Flexible Server is shared, with separate databases per backend and per environment.
- Delivery follows a develop to staging and main to production branch promotion strategy.
- Infrastructure is managed with Bicep for Azure staging and production.

The migration starts with Option A (Postgres-primary plus Convex projection) to reduce risk and allow staged rollout with rollback.

Your current stack already supports realtime with Socket.IO and cache-aside patterns, but active collaboration flows still pay a latency penalty from:

- Multi-query detail reads.
- Cache invalidation overhead.
- Polling fallback loops.
- Full-detail refetches after some mutations.

Convex is a strong fit for reducing perceived and actual latency in collaboration-heavy screens because:

- Query subscriptions are realtime by default.
- Query results are automatically cached.
- Mutations are transactional.
- Function boundaries support explicit auth and validation.

## Findings

### 1. Current architecture is realtime-capable but query-heavy

- API: NestJS + Drizzle + PostgreSQL, Socket.IO gateways, Redis adapter/cache.
- UI: TanStack Query + socket listeners + optimistic updates in some paths.
- Hottest collaboration features:
  - Retro detail board.
  - Story estimate live session.

### 2. Main latency contributors

- Detail endpoints compose many reads per refresh.
- Active views still rely on short refetch intervals as fallback.
- Several flows still invalidate and reload full query payloads.
- Under concurrent users, query fanout and repeated refetch amplify DB pressure.

### 3. Convex fit for this codebase

- Realtime subscriptions are built into query functions.
- Mutations run with transaction guarantees.
- Index design is essential for predictable performance.
- Actions should be reserved for external side effects, not core state transitions.

### 4. Self-hosted Convex plus PostgreSQL is viable

- Self-hosted Convex supports PostgreSQL-backed persistence.
- Regional co-location of Convex backend and PostgreSQL is critical for latency.
- The chosen Azure architecture supports local development, staging, and production with one consistent runtime model.

## Architecture Decision

### Option A: PostgreSQL Primary, Convex Realtime Projection (Recommended First)

#### Design

- PostgreSQL is the system of record for retros, estimates, reporting, and RBAC-driven domain state.
- Convex stores active collaboration projections for low-latency subscriptions (presence, votes, active board/session state).
- NestJS mutations write to Postgres first and publish projection updates to Convex through an idempotent sync contract.

#### Pros

- Lowest migration risk.
- Minimal disruption to existing APIs and reports.
- Clear rollback path by disabling Convex feature flags.

#### Cons

- Dual-write orchestration complexity.
- Requires outbox/retry and reconciliation safeguards.

### Option B: Convex Primary for Active Session State (Future Evaluation)

#### Design

- Convex owns active retro and estimate session state.
- Postgres remains durable store for history, analytics, and long-term records.

#### Pros

- Best realtime ergonomics and lowest collaboration latency.

#### Cons

- Larger rewrite scope and migration complexity.

## Recommendation

Start with Option A, measure outcomes in staging and production behind feature flags, then decide if selected active-session flows should move further toward Option B.

## Branching Strategy

### Branch Model

- main: production branch.
- develop: integration and staging branch.
- feature/*: short-lived feature branches from develop.
- hotfix/*: emergency branches from main, merged back to main and propagated to develop.

### Promotion Flow

1. feature/* to develop via PR.
2. Automatic deployment to staging on develop.
3. develop to main via PR after staging validation.
4. Automatic deployment to production on main after approval gate.

### Protected Branch Policy

#### develop required checks

- Lint, unit tests, integration tests.
- Build validation for retro-tool-api, retro-tool-ui, and convex-backend.
- Security/dependency checks.

#### main required checks

- All develop checks.
- Staging smoke tests pass.
- Migration readiness check passes.
- Manual release approval.

### Release and rollback policy

- Tag releases from main using semantic versioning.
- Keep image tags immutable for rollback.
- Require documented rollback steps for application and schema changes.
- For emergency fixes, use hotfix branches from main and merge back into develop after production stabilization.

## DevOps Delivery Plan

## Local: Docker Compose

Use local containers for parity and onboarding.

### Services

- postgres
- redis
- nest-api
- convex-backend
- convex-dashboard
- ui (optional containerized frontend)

### Database model

- One postgres server instance.
- Separate databases:
  - app_local
  - convex_local

### Note

Bicep is not used for local runtime. Docker Compose is the local infrastructure definition.

## Azure Staging: AKS + PostgreSQL Flexible Server

### Runtime

- AKS namespace: staging.
- Container images from ACR.
- Ingress host routing for UI, Nest API, Convex API, Convex site/actions, Convex dashboard.

### Database model

- Shared Azure PostgreSQL Flexible Server.
- Separate databases:
  - app_staging
  - convex_staging

### Secrets and observability

- Azure Key Vault for secrets.
- Log Analytics + Application Insights.

## Production: AKS + Key Vault + Private Networking

### Runtime

- AKS namespace: production.
- Same ingress pattern as staging with hardened policies.

### Database model

- Shared Azure PostgreSQL Flexible Server.
- Separate databases:
  - app_prod
  - convex_prod

### Security and reliability

- Key Vault secret delivery.
- Private networking and private endpoints where applicable.
- Same-region placement for AKS and PostgreSQL.
- Strict rollout and rollback runbooks.

### Environment mapping summary

- Local: developer workstations using Docker Compose.
- Staging: develop branch deployed to AKS staging namespace.
- Production: main branch deployed to AKS production namespace.

## AKS Ingress Plan

### Routing

- app.<env>.domain -> frontend service
- api.<env>.domain -> NestJS service
- convex-api.<env>.domain -> Convex API endpoint
- convex-site.<env>.domain -> Convex HTTP actions/site endpoint
- convex-dashboard.<env>.domain -> Convex dashboard endpoint

### Requirements

- TLS termination and certificate automation.
- Websocket upgrade support.
- Extended proxy timeout configuration for long-lived realtime connections.
- Restricted dashboard exposure in production.
- CORS-compatible forwarding and origin preservation.
- Stable service naming for UI, Nest API, Convex API, Convex site, and Convex dashboard.

## Bicep Plan

## Folder Structure

```
infra/
  bicep/
    modules/
      aks.bicep
      acr.bicep
      postgres-flexible-server.bicep
      keyvault.bicep
      log-analytics.bicep
      app-insights.bicep
      managed-identity.bicep
      role-assignments.bicep
      network.bicep
      private-dns.bicep
      private-endpoint.bicep
    environments/
      staging/
        main.bicep
        parameters.json
      production/
        main.bicep
        parameters.json
```

## Module Scope

- AKS cluster and node pools.
- ACR for image storage.
- PostgreSQL Flexible Server.
- Key Vault and managed identities.
- Networking, private DNS, and private endpoint modules.
- Monitoring stack.

### Expected environment files

- infra/bicep/environments/staging/main.bicep
- infra/bicep/environments/staging/parameters.json
- infra/bicep/environments/production/main.bicep
- infra/bicep/environments/production/parameters.json

## Deployment Pipeline Expectations

1. what-if validation.
2. deploy.
3. post-deploy health and smoke validation.

### CI/CD expectations by branch

#### On pull requests to develop

- Run lint, tests, and builds for retro-tool-api, retro-tool-ui, and convex-backend.
- Validate Docker builds for containerized services.
- Run infrastructure lint and optional Bicep validation if infra changes are present.

#### On merge to develop

- Build and push images to ACR.
- Deploy to AKS staging.
- Run database migrations against app_staging.
- Run staging smoke tests.

#### On merge to main

- Require release approval.
- Build and push production-tagged images.
- Deploy to AKS production.
- Run migrations against app_prod.
- Execute smoke checks and canary verification.

## Backend Rewrite Scope

### NestJS responsibilities

- Durable writes and source-of-truth business state.
- RBAC authority and domain policy.
- Existing integrations, reports, digests.
- Outbox and projection sync publishing.

### Convex responsibilities

- Realtime subscriptions.
- Active collaboration projections.
- Presence and low-latency fanout.

### Sync strategy

- Postgres commit first.
- Projection update to Convex with idempotency key.
- Retry and reconciliation for drift correction.

### Data ownership model

- NestJS owns durable domain state, reports, permissions, and business workflows.
- Convex owns active collaboration projections, presence, and low-latency subscription reads.
- PostgreSQL remains the system of record during the first migration phase.

## Frontend Change Plan

1. Add Convex client/provider behind feature flags.
2. Migrate story estimate active read path to subscriptions first.
3. Migrate retro active board read path second.
4. Keep HTTP mutation path initially.
5. Introduce subscription-first with fallback to existing API refresh on Convex outage.

### Migration sequence recommendation

- Start with Story Estimate voting because it has high realtime value and lower migration complexity.
- Move to Retro board subscriptions after estimate flow stabilizes.
- Retire Socket.IO channels only after feature-level parity and fallback coverage are confirmed.

## Target Repository Structure

```
Retro-Tool/
  retro-tool-api/
  retro-tool-ui/
  convex-backend/
  packages/
    shared/
      contracts/
  infra/
    bicep/
  deploy/
    aks/
  docker/
  docs/
    architecture/
    devops/
```

### Responsibilities by folder

- retro-tool-api/: existing NestJS backend, plus new convex-sync and outbox/retry logic.
- retro-tool-ui/: existing frontend, plus Convex provider wiring, subscription hooks, and feature flags.
- convex-backend/: new self-hosted Convex app including schema, queries, mutations, auth config, and generated artifacts.
- packages/shared/contracts/: shared contracts between NestJS, Convex, and frontend.
- infra/bicep/: Azure infrastructure definitions for staging and production.
- deploy/aks/: manifests, Helm values, or deployment overlays for AKS runtime resources.

## Implementation Phases

### Phase 1: Governance and pipelines

1. Implement branch protections and required checks.
2. Add develop-to-staging and main-to-production workflows.

### Phase 2: Infrastructure baseline

3. Create Bicep modules and environment entry points.
4. Provision staging AKS, ACR, Key Vault, PostgreSQL, ingress prerequisites.

### Phase 3: Runtime setup

5. Add local docker compose stack.
6. Add convex-backend package and shared contracts package.

### Phase 4: Baseline and SLO definition

7. Define measurable targets for active retro and estimate sessions:
- p95 board/session initial load.
- p95 mutation-to-visible-update.
- DB query count per key interaction.
- Concurrent-user target per session.
8. Instrument current flows for baseline comparison.

### Phase 5: Convex data model and indexes

9. Create Convex schema for active collaboration entities only:
- Live retro snapshot.
- Live estimate snapshot.
- Presence state.
- Live vote state.
10. Define indexes for high-frequency access paths before rollout.
11. Define retention and archival boundaries back to Postgres.

### Phase 6: Backend sync contract

12. Implement deterministic projection sync contract:
- Commit in Postgres first.
- Publish projection update to Convex.
- Use idempotency keys per mutation.
13. Add retry-safe outbox or equivalent reliability mechanism for projection sync.
14. Add reconciliation job to detect and fix projection drift.

### Phase 7: Feature migration

15. Replace polling-heavy Story Estimate detail reads with Convex subscriptions first.
16. Migrate retro board active read path second.
17. Keep existing HTTP mutations initially and migrate the highest-frequency actions only after validation.
18. Run Socket.IO and Convex in parallel during transition and retire channels feature by feature after parity.

### Phase 8: Auth and RBAC parity

19. Integrate Convex auth with the existing token flow.
20. Mirror RBAC checks at function boundaries for org, team, and retro scopes.
21. Enforce secure JWT audience and issuer validation.

### Phase 9: Hardening and production rollout

22. Run performance, security, and failover drills.
23. Promote to main and production with canary and rollback readiness.
24. Roll out behind feature flags by organization or team.

## Verification Checklist

- Branch governance and CI checks enforce promotion policy.
- Staging and production ingress routing works for all endpoints.
- Websocket behavior is stable behind ingress.
- Migrations target correct databases per environment.
- Convex fallback path functions during outage drills.
- p95 session load and mutation-to-visible-update improve versus baseline.
- Security posture validated (Key Vault only secrets, restricted dashboard, private networking).

### Additional validation scenarios

- Correctness under concurrency for votes, comments, merges, and presence churn.
- Resilience under partial outages such as Convex sync failure or temporary ingress disruption.
- Drift reconciliation tests between durable Postgres state and Convex projections.
- Production rollback drill using previous image tags and documented procedures.

## Risks and Mitigations

### Risk: Dual-write inconsistency

Mitigation:

- Idempotency keys.
- Outbox + retry worker.
- Reconciliation jobs.

### Risk: Runtime routing issues for realtime

Mitigation:

- Explicit ingress websocket settings.
- Timeout tuning and staged load testing.

### Risk: Auth drift between backends

Mitigation:

- Shared claim model.
- RBAC checks at function boundaries.
- JWT issuer/audience validation.

### Risk: Slow Convex queries from poor indexing

Mitigation:

- Index-first query design.
- Avoid broad scans on high-churn tables.
- Validate with load tests before full rollout.

### Risk: Duplicate event handling during transition

Mitigation:

- Feature-gated ownership of realtime channels.
- Strict handoff rules between Socket.IO and Convex per feature.

## Key Decisions

- Container platform: AKS for staging and production.
- Database topology: one postgres server, separate databases by backend and environment.
- Branch strategy: develop for staging, main for production.
- Migration strategy: Option A first, evaluate Option B later.

## Suggested First Slice

Implement the first production slice on Story Estimate voting:

- Highest collaboration frequency.
- Clear measurable latency improvements.
- Lower migration complexity than the full retro board.

After this is stable, migrate retro discussion and active board updates.

## Source Material Referenced

- Convex documentation covering tutorial, quickstarts, functions, validation, realtime, auth, database, indexes, hosting, and self-hosting.
- Self-hosted Convex guidance for PostgreSQL-backed persistence.
- Existing project plans and deployment assumptions already present in this repository.

## Expected Outcome

This plan delivers low-latency collaboration capabilities with controlled risk through phased migration, clear branch governance, AKS-based container operations, and Bicep-managed Azure infrastructure for staging and production.

It also preserves the stronger technical detail from the earlier integration plan so the document can be used as both an architecture decision record and an execution roadmap.
