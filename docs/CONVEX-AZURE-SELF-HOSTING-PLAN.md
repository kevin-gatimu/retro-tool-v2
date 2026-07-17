# Convex Self-Hosting on Azure — Architecture and Migration Plan

## Executive decision

Run exactly two cloud deployments—**staging** and **production**—with one self-hosted Convex backend in each as a single-replica Azure Container App. Each deployment should use the environment's existing Azure Database for PostgreSQL Flexible Server through a separate Convex database and least-privilege database role. Keep development local in the existing Docker Compose stack; do not provision a development Convex Container App. Keep the React UI on Azure Static Web Apps and NestJS API on App Service. Store Convex's container-local artifacts on an Azure Files volume mounted at `/convex/data`, keep secrets in Azure Key Vault, and deploy Convex functions from a dedicated GitHub Actions workflow.

Do not deploy the Convex dashboard publicly. Operators should use the self-hosted CLI through a protected GitHub environment or a temporary, access-controlled diagnostic path.

This is the best fit for the current application because:

- PostgreSQL through NestJS is already the authoritative system of record; Convex contains only realtime projections.
- The browser needs long-lived WebSocket connections, which Azure Container Apps HTTP ingress supports.
- Convex self-hosting is currently a single-node operational model. Fix the replica count at one and scale vertically.
- Container Apps provides managed HTTPS ingress, revisions, probes, Log Analytics, Key Vault references, and managed-identity image pulls without introducing an AKS cluster.
- Convex has no `httpAction` routes in this repository, so only backend port `3210` must be public. Do not expose `3211` or the dashboard port `6791`.
- Sharing each environment's PostgreSQL server is appropriate because Convex is a reconstructable projection layer. Database-level isolation is still required, and production server capacity must be upgraded and monitored before both workloads share it.

## Current-state findings

The repository is already close to self-hosting readiness:

- `docker/docker-compose.local.yml` runs `ghcr.io/get-convex/convex-backend` with PostgreSQL and maps ports 3210/3211.
- `docs/convex-self-hosting.md` documents local secrets, the self-hosted admin key, PostgreSQL naming, JWT configuration, and the `/convex/data` durability problem.
- The UI lazily creates an authenticated `ConvexReactClient` from `VITE_CONVEX_URL`; changing the build-time URL moves clients to a new deployment.
- The API sends projections through `CONVEX_SYNC_URL` and `CONVEX_SYNC_ADMIN_KEY` using Convex's `/api/mutation` endpoint.
- `convex/auth.config.ts` validates the API's RS256 JWTs using `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_JWKS_URL` stored in the Convex deployment environment.
- Socket.IO remains an emergency fallback for estimates, retros, icebreakers, standups, and notifications. Polls and surveys fall back to REST polling when Convex is unconfigured.
- The existing Bicep deploys ACR, a user-assigned identity, PostgreSQL Flexible Server, API App Service, and Static Web App. It does not yet deploy Container Apps, Key Vault, private networking, persistent Convex storage, or Convex CI/CD.
- The current PostgreSQL `Standard_B1ms`, public networking, seven-day backups, disabled HA, and `AllowAzureServices` firewall rule are development-grade settings and should not host production Convex.

There is one application-level migration gap: only `liveTeamMembers` currently has a complete PostgreSQL-to-Convex reconciliation operation. The other projection services refresh individual active objects, but there is no single, auditable command that rebuilds every required projection in a new empty Convex deployment.

## Target architecture

```text
Users
  |
  +-- HTTPS ----------> Azure Static Web App (React)
  |                         |
  |                         +-- REST/Socket.IO --> App Service (NestJS API)
  |                         |
  |                         +-- WSS ------------> Container App (Convex :3210)
  |                                                   |
  |                                                   +-- PostgreSQL TLS
  |                                                   |     Existing environment server
  |                                                   |     ├── retro_tool_db
  |                                                   |     └── retrotool_<env>_convex
  |                                                   |
  |                                                   +-- /convex/data
  |                                                         Azure Files
  |
  +-- optional Front Door/WAF before public endpoints

GitHub Actions -- OIDC --> ACR / Container Apps / Convex CLI deployment
Managed identity --------> ACR + Key Vault
Azure Monitor <----------- Container Apps logs, metrics, probes, alerts
```

### Resource layout

Create the following only for `staging` and `prod`. Local development continues to use `docker/docker-compose.local.yml` and its local PostgreSQL/Convex services.

| Resource                   | Decision                                                                                                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container Apps environment | One VNet-integrated environment in `southafricanorth`, with Log Analytics enabled.                                                                                                                                                                                 |
| Convex Container App       | External HTTPS ingress to target port 3210; single revision mode; `minReplicas=1`, `maxReplicas=1`; no Dapr; no scale-to-zero.                                                                                                                                   |
| Convex image               | Mirror an explicitly pinned `ghcr.io/get-convex/convex-backend:<version-or-digest>` into the existing ACR. Never deploy `latest`.                                                                                                                                |
| PostgreSQL                 | Reuse the environment's existing Flexible Server. Upgrade production from Burstable B1ms to a suitable General Purpose SKU, use private access, enable HA where supported, and retain 14–35 days of PITR backups. Monitor API and Convex contention.             |
| Convex database            | Create a separate database and owner role. Derive the database name from a stable `INSTANCE_NAME`, such as `retrotool-prod-convex` -> `retrotool_prod_convex`; pass `POSTGRES_URL` without a database path, as required by Convex.                              |
| Durable filesystem         | StorageV2 account plus Azure Files share mounted read/write at `/convex/data`. Use zone-redundant storage when supported. Validate deployment, search, export, and restore performance before production.                                                          |
| Key Vault                  | Store `INSTANCE_SECRET`, the Convex database role credential/URL, generated Convex admin key, and Azure Files credential if required by the environment storage definition. Use versionless Key Vault references and managed identity.                          |
| Managed identity           | Reuse or create a dedicated user-assigned identity with only ACR Pull and Key Vault Secrets User. Separate the GitHub deployment identity from the runtime identity.                                                                                                 |
| DNS/TLS                    | Use `convex.<environment-domain>` for the public backend. Container Apps terminates TLS 1.2+ and supports WebSockets.                                                                                                                                              |
| Dashboard                  | Not deployed publicly. If later required, deploy it as a separate internal app behind Entra ID and IP/VPN controls.                                                                                                                                                  |

### Why not the alternatives

| Option                       | Assessment                                                                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App Service custom container | Viable, but persistent volume behavior, port routing, deployment slots, and shared plan capacity add more coupling to the API. A separate Container App gives Convex its own lifecycle and clearer probes/revisions. |
| AKS                          | Technically capable, but unjustified operational overhead for one single-replica backend. Revisit only when the platform already operates Kubernetes or Convex publishes a supported clustered topology.             |
| Azure Container Instances    | Lacks the deployment revisions, ingress, autoscaling controls, integrated probes, and operational ergonomics needed for a production service.                                                                        |
| Multiple Convex replicas     | Do not use. The open-source self-hosted guidance does not define an active-active backend topology, and the local filesystem/state model makes uncoordinated replicas unsafe.                                        |

## Infrastructure implementation

### 1. Refactor Bicep into composable modules

Keep `infra/deploy.bicep` as the subscription-scope entry point, but split `infra/main.bicep` into modules for networking, observability, secrets, data, API hosting, and Convex hosting. Provision the Convex cloud module only when `environment` is `staging` or `prod`; the `develop` deployment must not create Container Apps, Azure Files, Convex secrets, or Convex databases. This limits blast radius and makes `what-if` output reviewable.

The Convex module should declare:

- VNet-integrated Container Apps environment and Log Analytics workspace.
- Container App with external HTTP ingress on port 3210, WebSocket-compatible transport, single revision mode, one replica, readiness/liveness/startup probes, controlled CPU/memory, and a termination grace period.
- Azure Files environment storage plus `/convex/data` volume mount.
- ACR registry configuration using the runtime managed identity.
- Key Vault-backed Container App secrets and secret-referenced environment variables.
- Custom-domain/certificate inputs, or outputs for a later DNS binding step.
- Outputs for the public Convex URL, container app name, managed environment name, and PostgreSQL host.

Use environment-specific cloud sizing rather than hard-coded production values:

- Staging: production topology at smaller capacity, including private networking and persistent storage; reuse the staging PostgreSQL server with a separate Convex database and role.
- Production: start the Convex container at 2 vCPU / 4 GiB and size from load tests; upgrade the shared PostgreSQL server to a non-burstable General Purpose SKU with HA. Scale vertically after observing both API and Convex CPU, connections, I/O, query latency, and scheduled-job lag.
- Local: keep the existing Docker Compose topology and local data volumes; no Azure resources or cloud deployment workflow.

### 2. Network and security boundaries

- Put the Container Apps environment and the shared PostgreSQL server in the same region and VNet; Convex explicitly warns that database latency affects every query.
- Create a distinct Convex database role that owns only the environment's Convex database. Do not use the API database role or give Convex access to `retro_tool_db`.
- Use private PostgreSQL access and Private DNS. Remove the broad `0.0.0.0` Azure-services firewall rule after the API and deployment paths have private connectivity.
- Keep port 3210 public because browsers subscribe directly. Do not expose 3211 or 6791.
- Route production traffic through Azure Front Door/WAF only if the product already needs global routing, custom WAF policies, or centralized rate controls. Confirm WebSocket pass-through and do not cache Convex traffic.
- Treat the Convex admin key as equivalent to database-administrator access. Never put it in UI variables, logs, workflow output, or Bicep outputs.
- Use separate secrets and `INSTANCE_NAME` values per environment. Never point two Convex deployments at the same database or storage prefix.
- Keep `JWT_ISSUER` exactly equal to the API token issuer, while `JWT_JWKS_URL` must be network-reachable from the Container App. Preserve `JWT_AUDIENCE=convex`.

### 3. Persistence, backup, and disaster recovery

Convex stores durable records in PostgreSQL but stores deployed modules, search artifacts, snapshot imports/exports, and files under `/convex/data` unless configured for an S3-compatible object store. Azure Blob Storage is not a drop-in S3 endpoint; do not invent an unsupported mapping.

For the first Azure version:

- Mount Azure Files at `/convex/data` and keep the Container App at one replica.
- Enable soft delete, versioning where applicable, storage firewall rules, and a backup policy for the file share.
- Enable PostgreSQL PITR backups and test restore into an isolated server.
- Schedule `npx convex export` to encrypted Azure storage before backend image upgrades and at the recovery-policy frequency. An export is an additional logical recovery artifact, not a replacement for PostgreSQL and file-share backups.
- Document an RPO/RTO target. Recommended initial target for this projection layer: RPO <= 24 hours and RTO <= 2 hours, because PostgreSQL/NestJS can reconstruct business projections; tighten this if Convex begins storing user files or non-reconstructable state.
- Run a quarterly restore drill: new PostgreSQL server, restored file share or fresh `/convex/data`, pinned backend image, environment restore, function deploy, projection reconciliation, and synthetic WebSocket test.

If Azure Files latency is unacceptable in load tests, do not proceed silently. Evaluate a supported S3-compatible managed endpoint or a separately operated MinIO deployment, including its own HA and backup burden, before switching the five official Convex storage buckets.

## Application and deployment changes

### Projection rebuild contract

Add one super-admin/CLI-only reconciliation command that rebuilds all security and active-collaboration projections from PostgreSQL into an empty Convex deployment. It must be idempotent, bounded in batches, observable, and fail the cutover if any required projection fails.

At minimum cover:

- Team membership authorization projection first.
- Active retros, estimates, icebreakers, standups, polls, and surveys.
- User notifications needed by the current UI contract.
- Any rate-limit or presence state should start empty; do not migrate it unless it is explicitly made durable business state.

For each projection, report scanned, written, skipped, failed, and duration. Store a reconciliation run record in PostgreSQL or emit structured logs with a stable run ID. PostgreSQL remains the source, so Cloud-to-self-hosted Convex data export is not the preferred migration mechanism.

### Container and version policy

- Do not maintain a fork of Convex unless an Azure-specific patch is unavoidable.
- Mirror the official GHCR image into ACR by immutable digest. Record the upstream version/digest in source control and release notes.
- Add a scheduled dependency check that opens a PR for new upstream images; do not auto-deploy them.
- Before each upgrade, read upstream migration notes, export Convex, deploy to staging, wait for migration-complete logs, run smoke/load tests, then promote the same digest to production.
- Keep the previous digest available for rollback. Database migrations may prevent a direct image rollback, so the actual recovery path may be restore-from-export/PITR rather than container-only rollback.

### CI/CD workflow order

Create a dedicated `deploy-convex.yml` using GitHub OIDC and only the protected `staging` and `production` GitHub environments. It must not accept or infer a `develop` cloud target:

1. Validate Bicep and run `what-if`.
2. Resolve and mirror the approved upstream Convex image digest into ACR.
3. Deploy/update infrastructure without changing UI/API endpoints.
4. Wait for the backend readiness probe.
5. Execute `generate_admin_key.sh` in the running replica on first bootstrap; store the result in Key Vault and restart references safely. Never print the value.
6. Run `convex deploy` with `CONVEX_SELF_HOSTED_URL` and the admin key from the protected environment/Key Vault.
7. Set and verify function-runtime variables with `convex env set`: `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_JWKS_URL`.
8. Run a server-side mutation/query smoke test and authenticated browser WebSocket test.
9. Run the full projection reconciliation against the new target.
10. Publish a deployment summary containing only non-secret resource names, image digest, revision, test results, and reconciliation counts.

Keep Convex infrastructure/function deployment separate from API and UI deployment. Coordinate endpoint changes through environment promotion, not by rebuilding everything in one job.

## Migration and cutover runbook

### Phase 0 — readiness

- Add full reconciliation support and validate it against a fresh local self-hosted instance.
- Add health endpoints/probes and synthetic authenticated subscription checks.
- Pin the Convex SDK and backend image versions to a tested compatibility pair; upgrade the currently loose/stale SDK declaration before migration if required by the chosen backend image.
- Confirm no business-critical state exists only in Convex Cloud. If it does, classify it and add a specific export/import or PostgreSQL reconstruction path.
- Establish dashboards, alerts, backup policies, owners, maintenance window, RPO/RTO, and rollback authority.

### Phase 1 — infrastructure and staging

- Provision the staging target with private PostgreSQL, durable `/convex/data`, Key Vault secrets, and a one-replica Container App.
- Deploy functions and JWT environment variables.
- Reconcile from the staging PostgreSQL database.
- Run functional tests for every realtime feature, disconnect/reconnect behavior, token refresh, permissions, scheduled jobs, admin metrics, and container restart persistence.
- Run representative concurrent WebSocket and mutation load tests. Capture p50/p95/p99 function latency, connection stability, PostgreSQL CPU/IO/connections, Container App CPU/memory/restarts, and Azure Files latency.
- Restart the replica and deploy a new revision to prove modules and search artifacts survive.

### Phase 2 — production shadow preparation

- Provision production self-hosted Convex without pointing users or the production API at it.
- Deploy the exact staging-approved image and functions.
- Run the full reconciliation from production PostgreSQL.
- Re-run reconciliation immediately before cutover so the idempotent target is current.
- Keep the Convex Cloud deployment untouched as the rollback target.

Do not implement ongoing dual-write unless the final reconciliation window is operationally unacceptable. The current projection calls are mostly best-effort and duplicating them would increase failure modes. A short controlled cutover with a final rebuild is safer for this reconstructable projection layer.

### Phase 3 — cutover

Use the existing per-feature switches to reduce risk:

1. Pause deployments and announce the maintenance window.
2. Record current Cloud URLs, keys, UI build identifier, and API configuration.
3. Run final reconciliation and verify counts/security membership first.
4. Change API `CONVEX_SYNC_URL` and admin key to self-hosted; restart API and verify projection writes.
5. Build/deploy the UI with the self-hosted `VITE_CONVEX_URL` while retaining the same feature flags.
6. Move one lower-risk feature first if the release process permits per-feature builds, then estimates/retros/standups and notifications; polls/surveys move with the URL because they are Convex-only when configured.
7. Verify authenticated reads, writes, WebSocket reconnects, RBAC isolation, and multiple simultaneous users.
8. Observe for at least one normal peak-usage period before declaring migration complete.

Because `VITE_CONVEX_URL` is compiled into the static UI, URL rollback requires redeploying a previous UI artifact. Keep that artifact ready; do not rely on editing a runtime setting.

### Phase 4 — rollback

Rollback triggers include sustained subscription failure, authorization errors, unexplained projection drift, database saturation, repeated replica restarts, or failed persistence after a revision/restart.

Rollback steps:

1. Restore the API's Cloud `CONVEX_SYNC_URL` and admin key.
2. Redeploy the last Cloud-configured UI artifact.
3. Verify Cloud subscriptions and projection mutations.
4. Keep the self-hosted resources isolated for evidence; do not destroy or mutate them until the incident review and data comparison finish.
5. Reconcile Cloud from PostgreSQL if writes were missed during the transition.

Do not delete the Cloud deployment until self-hosting has completed at least two successful upgrades, one restore drill, and an agreed stabilization period (recommended 30 days).

## Observability and operational controls

Create Azure Monitor dashboards and alerts for:

- Container availability, revision health, replica restarts, OOM/exit 137, CPU, memory, and filesystem capacity.
- HTTP 5xx, WebSocket connection failures/disconnect spikes, request latency, and ingress saturation.
- Convex function call rate, p50/p95/p99 latency, cache hit rate, scheduled-job lag, concurrency, and table rates using the admin metrics already exposed by `ConvexAdminService`.
- PostgreSQL CPU, memory, storage/IOPS, active connections, failed connections, transaction latency, replica/HA state, and backup failures.
- Reconciliation failures, count drift, JWT/JWKS failures, stale admin key errors, and failed function deployments.
- Azure Files capacity, throttling, availability, and backup failures.

Send actionable alerts to the team's established notification channel and define severity/ownership. At minimum, page on backend unavailability, repeated restart, PostgreSQL unavailable/storage-critical, failed backup, and authorization-wide failures.

Use structured logs and correlation IDs from API projection calls through the Convex mutation response. Avoid logging payloads that can contain card text, survey responses, user identifiers, JWTs, connection strings, or admin keys.

## Acceptance criteria

The migration is ready for production only when all of the following pass:

- Bicep `what-if` shows isolated, environment-scoped resources and no unintended replacement of API/UI resources.
- Only ports 443 -> 3210 are externally reachable; ports 3211 and 6791 are closed.
- A signed-out query is rejected and signed-in queries enforce team membership across two test tenants.
- Every realtime feature updates two browsers without refresh and reconnects after network interruption/token refresh.
- API projection writes succeed with the self-hosted admin key and fail with an invalid key.
- Full reconciliation against an empty target produces expected counts, is repeatable without duplicates, and reports partial failures.
- A container restart and a Container App revision replacement preserve deployed modules and usable data.
- PostgreSQL PITR, Azure Files restore, and `convex export/import` recovery have each been exercised in staging.
- Load testing meets an agreed latency/error budget at expected peak concurrency with at least 50% CPU/memory headroom.
- Rollback to Convex Cloud is rehearsed using the retained API configuration and previous UI artifact.
- Runbooks identify owner, RPO/RTO, escalation, secret rotation, upgrade, backup verification, restore, and rollback procedures.

## Known risks and mitigations

| Risk                                                         | Mitigation                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Open-source Convex is not the managed cloud's scaled service | Single replica, vertical sizing, realistic load tests, documented capacity ceiling, Cloud rollback retained.                               |
| Container filesystem loss invalidates module references      | Persist `/convex/data` on Azure Files and test revision replacement; keep logical exports.                                               |
| Azure Files latency affects modules/search                   | Benchmark staging; alert on latency; evaluate an explicitly supported S3-compatible provider only if necessary.                            |
| Admin key bootstrap/rotation is awkward                      | Automate non-printing generation, Key Vault storage, dependent app restart, and verification.                                              |
| One replica creates restart downtime                         | Readiness-controlled single revisions, durable state, quick restart, monitored maintenance; accept this until supported clustering exists. |
| Shared API/Convex server resource contention                 | Separate databases/roles, upgrade production to General Purpose, monitor both workloads, and move Convex to a dedicated server only if measured contention or isolation requirements justify it.       |
| Static UI embeds the backend URL                             | Retain previous UI artifact and make URL promotion/rollback an explicit deployment step.                                                   |
| Projections are incomplete on a fresh deployment             | Implement and gate cutover on full idempotent reconciliation, with membership first.                                                       |
| Upstream image migration blocks rollback                     | Pin digests, export before upgrades, rehearse restore, and promote staging-tested versions only.                                           |

## Recommended delivery sequence

1. Implement full projection reconciliation and its tests.
2. Refactor Bicep and add Container Apps, private data plane, Key Vault, Azure Files, probes, and monitoring.
3. Add immutable image mirroring and the Convex deployment workflow.
4. Deploy and harden staging; complete persistence, security, load, and recovery tests.
5. Provision production shadow, reconcile, and execute the feature-controlled cutover.
6. Stabilize for 30 days, perform an upgrade and restore drill, then decommission Convex Cloud.

## Sources

- [Convex self-hosting](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Convex with PostgreSQL/MySQL](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/postgres_or_mysql.md)
- [Convex S3 storage configuration](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/s3_storage.md)
- [Upgrading self-hosted Convex](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/upgrading.md)
- [Azure Container Apps ingress and WebSockets](https://learn.microsoft.com/azure/container-apps/ingress-overview)
- [Azure Container Apps revisions](https://learn.microsoft.com/azure/container-apps/revisions)
- [Azure Container Apps scaling](https://learn.microsoft.com/azure/container-apps/scale-app)
- [Azure Container Apps storage mounts](https://learn.microsoft.com/azure/container-apps/storage-mounts)
- [Azure Container Apps secrets and Key Vault references](https://learn.microsoft.com/azure/container-apps/manage-secrets)
- [Azure Container Apps alerts](https://learn.microsoft.com/azure/container-apps/alerts)
