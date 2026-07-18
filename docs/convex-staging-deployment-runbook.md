# Convex Self-Hosting — Staging Deployment Runbook

> Companion to [CONVEX-AZURE-SELF-HOSTING-PLAN.md](./CONVEX-AZURE-SELF-HOSTING-PLAN.md).
> This is the concrete, step-by-step procedure to get the self-hosted Convex
> backend running on Azure **App Service** in the `staging` environment and to
> cut the API + UI over to it, with a clean rollback to Convex Cloud.

## What you are deploying

One dedicated Linux **App Service (Web App for Containers)** running the official
Convex backend, alongside the existing staging ACR, PostgreSQL Flexible Server,
API App Service, and Static Web App. PostgreSQL through NestJS stays the system
of record; Convex holds only the reconstructable realtime projection layer.

| Resource | Name (staging) |
|---|---|
| Convex Web App | `retrotool-staging-convex` |
| Convex App Service plan | `retrotool-staging-convex-plan` (B1 Basic) |
| Convex instance name | `retrotool-convex-staging` |
| Convex PostgreSQL database | `retrotool_convex_staging` |
| Azure Files share (mounted `/convex/data`) | `convex-data` |
| Key Vault | `retrotool-staging-cvx-<hash>` |
| Public URL | `https://retrotool-staging-convex.azurewebsites.net` |

Infra: [infra/convex-staging.bicep](../infra/convex-staging.bicep) +
[infra/modules/](../infra/modules/). Deploy workflow:
[.github/workflows/deploy-convex.yml](../.github/workflows/deploy-convex.yml),
orchestrated by [.github/workflows/release-staging.yml](../.github/workflows/release-staging.yml).

---

## Phase A — one-time prerequisites (manual)

These are data-plane / bootstrap steps the Bicep and workflow deliberately do
**not** perform. Do them once, before the first release.

### A1. Mirror the pinned backend image into ACR

The workflow references `retrotoolstagingacr.azurecr.io/convex-backend@sha256:…`
but nothing pushes it. Mirror the upstream digest recorded in
[convex-backend/compatibility.json](../convex-backend/compatibility.json)
(`az acr import` preserves the digest, so the pin resolves):

```bash
az acr import \
  --name retrotoolstagingacr \
  --source ghcr.io/get-convex/convex-backend@sha256:1738f1673f8d63161043a7859710d2301b1e9d6271e06afbb7af31594ea3a58f \
  --image convex-backend@sha256:1738f1673f8d63161043a7859710d2301b1e9d6271e06afbb7af31594ea3a58f
```

> When you bump the image, update `compatibility.json` **and** re-run this import
> for the new digest.

### A2. Create the Convex PostgreSQL role and database

Bicep declares the database resource, but the least-privilege login role is
data-plane work. Run from **Azure Cloud Shell** (covered by the existing
`AllowAzureServices` firewall rule) or temporarily allow your IP. Connect as the
server admin (`pgadmin`):

```bash
psql "host=retrotool-staging-db.postgres.database.azure.com port=5432 dbname=postgres user=pgadmin sslmode=require"
```

```sql
-- Least-privilege Convex owner role, scoped to its own database only.
CREATE ROLE convex_staging LOGIN PASSWORD '<STRONG_PASSWORD>';
CREATE DATABASE retrotool_convex_staging OWNER convex_staging;

-- Hard boundary: the Convex role must never reach the API's system of record.
REVOKE ALL ON DATABASE retro_tool_db FROM convex_staging;
REVOKE ALL ON DATABASE retro_tool_db FROM PUBLIC;
```

> The database name **must** be `retrotool_convex_staging`. Convex derives it from
> `INSTANCE_NAME` (`retrotool-convex-staging`) by replacing hyphens with
> underscores. The Bicep `convexDatabase` resource then reconciles idempotently.

### A3. Generate the instance secret and Postgres URL

```bash
openssl rand -hex 32     # → CONVEX_INSTANCE_SECRET
```

Build `CONVEX_POSTGRES_URL` **without a database name and without a query
string** — Convex appends the database itself, and TLS is enforced by the app
setting `DO_NOT_REQUIRE_SSL=false`, not by `?sslmode=`:

```
postgresql://convex_staging:<STRONG_PASSWORD>@retrotool-staging-db.postgres.database.azure.com
```

### A4. Generate the Convex admin key

The admin key is a **signed token derived from `INSTANCE_SECRET`** — it is *not*
deterministic. `generate_admin_key.sh` mints a **new, different token on every
run**, and each one is independently valid: the backend accepts any token
correctly signed by its `INSTANCE_SECRET`, and generating a new key does **not**
invalidate previously issued keys. So you cannot reproduce a specific key later
— **generate it once, then persist that exact value** (you re-read it from the
secret store, you don't re-derive it). Generate from the **exact pinned image**:

```bash
docker run --rm --entrypoint ./generate_admin_key.sh \
  -e INSTANCE_NAME=retrotool-convex-staging \
  -e INSTANCE_SECRET=<hex secret from A3> \
  ghcr.io/get-convex/convex-backend@sha256:1738f1673f8d63161043a7859710d2301b1e9d6271e06afbb7af31594ea3a58f
```

Mask/store the output immediately. **Persist this exact value and reuse it in
two places** (do not regenerate a separate key per consumer):

- `CONVEX_SELF_HOSTED_ADMIN_KEY` — Convex CLI / function deploy (Convex job).
- `CONVEX_SYNC_ADMIN_KEY` — the API's projection writes (API job, Phase C).

> Fallback if the offline `docker run` is awkward: provision first (Phase B via
> manual `az deployment group create`), then
> `az webapp ssh -n retrotool-staging-convex -g retrotool-staging-rg` and run
> `./generate_admin_key.sh` inside the running container. The `INSTANCE_SECRET`
> (not the key) is the stable root: restarting/recreating the container with the
> same secret keeps every already-issued key valid, so a stored key survives a
> restart — you only lose a key if you fail to persist it or you rotate
> `INSTANCE_SECRET`.

### A5. Populate the GitHub `staging` environment

In the repository's **staging** environment (Settings → Environments → staging):

| Name | Kind | Value |
|---|---|---|
| `CONVEX_INSTANCE_SECRET` | Secret | from A3 |
| `CONVEX_POSTGRES_URL` | Secret | from A3 |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | Secret | from A4 |
| `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` | Var/Secret | existing OIDC federated identity |

### A6. Grant the deploy principal role-assignment rights ⚠️

The Bicep creates **three role assignments** — AcrPull for the Convex runtime
identity ([convex-staging.bicep](../infra/convex-staging.bicep) `acrPullAssignment`),
and Key Vault Secrets User + Secrets Officer on the vault
([modules/convex-key-vault.bicep](../infra/modules/convex-key-vault.bicep)
`runtimeSecretsUser` / `bootstrapSecretsOfficer`). Every `az deployment group
create` re-asserts them, so ARM checks `Microsoft.Authorization/roleAssignments/write`
**on every run, even when the assignments already exist and are unchanged** —
plain **Contributor is not enough** and idempotency does not save you.

Grant the GitHub OIDC deployment principal the **least-privilege role that can
assign roles**, scoped to the resource group only (not the subscription):

```bash
# Role Based Access Control Administrator — can write role assignments but
# nothing else, unlike the broader Owner / User Access Administrator.
az role assignment create \
  --assignee-object-id <CI_SP_OBJECT_ID> \
  --assignee-principal-type ServicePrincipal \
  --role "Role Based Access Control Administrator" \
  --scope "/subscriptions/<SUB_ID>/resourceGroups/retrotool-staging-rg"
```

> The CI principal's object id is the one that appears in the failure message
> (`The client '…' with object id '<GUID>'`). Get it directly with
> `az ad sp show --id <AZURE_CLIENT_ID> --query id -o tsv`.
>
> **This is the most common first-deploy failure.** Symptom in the `convex /
> deploy` job at the **"Deploy staging Convex infrastructure"** step:
> `InvalidTemplateDeployment … Authorization failed … does not have permission
> to perform action 'Microsoft.Authorization/roleAssignments/write'`. The stack
> can already be fully deployed and healthy and this still fails — it is purely a
> permission gap on the CI principal, not a template error. Fix once with the
> grant above; no code change and no re-provision is needed.

---

## Phase B — first automated deploy (provision + functions)

Trigger `release-staging` via **workflow_dispatch** (cleaner than a push for the
first run). The `convex` job ([deploy-convex.yml](../.github/workflows/deploy-convex.yml)):

1. **validate** — type-check + lint `convex-backend`, assert the manifest is
   digest-pinned and the SDK version matches, and `az bicep build`.
2. **single-instance invariant** — refuses to proceed if the Web App already runs
   more than one worker (skipped on first run).
3. **stop-first** — on an image change, stops the Web App before updating (skipped
   on first run).
4. **`az deployment group create`** — provisions the runtime identity, Key Vault
   (with the two secrets), Log Analytics, the Azure Files share, and the Convex
   Web App with the `/convex/data` mount and `WEBSITES_PORT=3210`.
5. **start + wait** — polls `https://retrotool-staging-convex.azurewebsites.net/version`
   for up to 10 minutes (first boot runs DB migrations).
6. **auth + functions** — `convex env set` for `JWT_ISSUER`, `JWT_AUDIENCE`,
   `JWT_JWKS_URL`, then `convex deploy`.

**If `/version` never comes up**, check, in order:
- Key Vault references not yet resolved → restart the Web App once.
- The Convex role cannot own its database → re-verify A2.
- The image digest is not in ACR → re-run A1.

---

## Phase C — cut the API and UI over to self-hosted Convex

Convex is running, but the API and UI still point at Convex Cloud. Update the
**staging** environment, then the `api` and `ui` jobs (which run after `convex`
in the same release) redeploy them against self-hosted Convex.

**API** (`deploy-api.yml` reads these):
- `CONVEX_SYNC_URL` = `https://retrotool-staging-convex.azurewebsites.net`
- `CONVEX_SYNC_ADMIN_KEY` = admin key from A4

**UI** (`deploy-ui.yml` — compiled into the bundle at build time):
- `VITE_CONVEX_URL` = `https://retrotool-staging-convex.azurewebsites.net`
- The five realtime flags (`VITE_{ESTIMATES,RETROS,ICEBREAKERS,STANDUPS,NOTIFICATIONS}_REALTIME_BACKEND`)
  are already validated by the workflow. Leave any not ready on `socket-io`.

> `VITE_CONVEX_URL` only takes effect on a UI **rebuild**. Changing the Azure
> setting alone does nothing — the value is baked into the JavaScript bundle.

**Keep the previous Convex Cloud `CONVEX_SYNC_URL` / key and the prior UI artifact
recorded** — that is your rollback until stabilization completes.

### C1. Reconcile projections from PostgreSQL

Immediately after the API points at self-hosted Convex, rebuild every projection
from the system of record into the fresh (empty) deployment. Membership/security
is reconciled first. Two ways to run it:

```bash
# CLI — from a build with staging DATABASE_URL + CONVEX_SYNC_URL/KEY in env.
# Exits non-zero on any partial failure (safe as a deploy gate).
node retro-tool-api/dist/convex-admin/reconcile-projections.js
```

or, authenticated as a super-admin: `POST /api/convex-admin/reconcile-projections`.

Both run [`ProjectionReconciliationService.reconcileAll()`](../retro-tool-api/src/convex-admin/projection-reconciliation.service.ts):
idempotent, batched, mark-and-sweeps stale rows (via the Convex
`admin:pruneStaleByUpdatedAt` mutation), and reports per-projection
`{ scanned, deletedStale, failed, durationMs }` with a run ID. If any projection
reports `failed`, the run's `ok` is false and the CLI exits non-zero — **do not
proceed** past a failed reconciliation.

### C2. Projection outbox

Business mutations no longer push to Convex fire-and-forget. Each enqueues a
durable **projection intent** in the same PostgreSQL transaction as its write
([`projection_outbox`](../retro-tool-api/drizzle/0027_projection_outbox.sql)); a
dispatcher (immediate best-effort + a per-minute advisory-locked cron on the
serving API slot) delivers them, recomputing current state from PostgreSQL so
delivery is idempotent and converges to truth.

Super-admin endpoints ([convex-admin.controller.ts](../retro-tool-api/src/convex-admin/convex-admin.controller.ts)):

| Endpoint | Purpose |
|---|---|
| `GET /convex-admin/outbox/status` | pending/failed counts, oldest-pending age, paused flag |
| `POST /convex-admin/outbox/pause` | stop delivery (events keep buffering durably) |
| `POST /convex-admin/outbox/resume` | resume + replay everything buffered, in order |
| `POST /convex-admin/outbox/replay` | drain the pending queue now |

The stop-first upgrade flow (below) pauses before stopping Convex and
resumes + reconciles after it is healthy again.

---

## Phase D — verify

1. `curl https://retrotool-staging-convex.azurewebsites.net/version` → `200`.
2. Sign in via Entra; open a retro in two browsers → live updates flow both ways.
3. Convex logs show it fetching `…/api/auth/jwks`; an unauthenticated
   subscription is rejected.
4. **Two-tenant isolation:** a user in team A cannot see team B's board.
5. **Persistence:** restart the Web App
   (`az webapp restart -n retrotool-staging-convex -g retrotool-staging-rg`),
   re-open a board — deployed functions on `/convex/data` survive the restart.
6. Projection freshness: a new card/vote appears in the other browser within the
   expected latency budget.

---

## Backend image upgrades (stop-first)

A backend **image** change cannot be zero-downtime on this single-instance
topology. The workflow already stops the Web App before updating. For a
data-bearing upgrade, the full maintenance sequence is:

1. Switch affected UI features to their Socket.IO / REST fallback (flip the
   `VITE_*_REALTIME_BACKEND` flags and redeploy the UI), keeping API writes live.
2. Pause Convex projection dispatch (the API buffers projection events durably —
   see the outbox in [CONVEX-AZURE-SELF-HOSTING-PLAN.md](./CONVEX-AZURE-SELF-HOSTING-PLAN.md)).
3. Verify PostgreSQL PITR + Azure Files backup, then take a logical export:
   `pnpm --dir convex-backend exec convex export --path convex-staging-<date>.zip`
   (with `CONVEX_SELF_HOSTED_URL` / `CONVEX_SELF_HOSTED_ADMIN_KEY` set).
4. Let the workflow stop → deploy the new pinned digest → start → wait for
   `/version` + migration-complete logs.
5. `convex deploy` the compatible functions; resume the outbox dispatcher and
   replay; run full reconciliation.
6. Restore primary traffic (flip the flags back) only after reconciliation and an
   authenticated WSS smoke test pass.

An older container digest is **not** a safe rollback after an in-place migration.
The recovery path is restore/export-import plus the known-compatible image.

---

## Rollback to Convex Cloud

Trigger for sustained subscription/auth failures, projection drift, DB
saturation, repeated restarts, mount/module loss, or failed reconciliation:

1. Restore the API's Convex Cloud `CONVEX_SYNC_URL` / `CONVEX_SYNC_ADMIN_KEY`.
2. Redeploy the previous Cloud-configured UI artifact
   (`VITE_CONVEX_URL` = Cloud URL).
3. Verify Cloud writes/subscriptions.
4. Reconcile Cloud from PostgreSQL for the self-hosted interval.
5. Preserve the self-hosted Web App, logs, and file share for diagnosis.

Do **not** remove the Cloud escape hatch until at least **30 stable days, two
successful backend upgrades, and one full restore drill** have passed.

---

## Cost posture (staging)

Deliberately lean per the "be cost-effective" constraint:

- **B1 Basic** App Service plan for Convex — the cheapest tier with Always On +
  WebSockets. One fixed worker (no scale-out — the backend is single-instance).
- **No VNet / private endpoints** on day one. Convex reaches PostgreSQL over the
  public endpoint with TLS, exactly as the API does today. Private networking is
  an intentional later step in the plan.
- Standard_LRS storage; Log Analytics `PerGB2018` with 30-day retention.
- Reassess against Convex Cloud pricing once real usage is measured — if managed
  Cloud is cheaper than the compute + on-call cost, self-hosting may not be worth
  it.
