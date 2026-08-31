# Convex Self-Hosting — Production Deployment Runbook

> Companion to [convex-azure-self-hosting-plan.md](./convex-azure-self-hosting-plan.md) and
> [convex-staging-runbook.md](./convex-staging-runbook.md). Mirrors the staging
> self-hosting setup for the **production** environment, which previously ran on
> Convex Cloud only.

## What you are deploying

One Linux **App Service (Web App for Containers)** running the official Convex
backend, alongside the existing production ACR, PostgreSQL Flexible Server, API
App Service, and Static Web App — all in the shared `retro_tool` resource
group. Unlike staging, Convex does **not** get a dedicated App Service plan in
production: the API's existing plan (`ASP-retrotoolproductionrg-be95`) is
already `B1 Basic` — the same cheapest tier Convex needs — so sharing it costs
nothing extra. PostgreSQL through NestJS stays the system of record; Convex
holds only the reconstructable realtime projection layer.

| Resource | Name (production) |
|---|---|
| Resource group | `retro_tool` |
| Convex Web App | `retrotool-prod-convex` |
| App Service plan (shared with the API) | `ASP-retrotoolproductionrg-be95` (B1 Basic) |
| Convex instance name | `retrotool-convex-prod` |
| Convex PostgreSQL database | `retrotool_convex_prod` (owner role `convex_prod`) |
| Application database (must stay isolated) | `retro-tool-db` |
| Azure Files share (mounted `/convex/data`) | `convex-data` |
| Key Vault | `retrotool-prod-cvx-<hash>` |
| Public URL | `https://retrotool-prod-convex.azurewebsites.net` |

> **Shared-plan tradeoff:** the staging self-hosting plan's default guidance is
> a dedicated plan so Convex WebSocket load can't starve the API — production
> deliberately overrides that here because the existing API plan was already
> sitting at the cheapest usable tier, making a second plan pure added cost. If
> load testing later shows contention between the API and Convex on the shared
> plan, split Convex back onto its own plan by setting
> `apiAppServicePlanName` to a new dedicated plan and re-running the module
> (see `infra/modules/convex-app-service.bicep`'s `existingPlanResourceId`
> parameter, shared with staging's template).

Infra: [infra/convex-production.bicep](../../infra/convex-production.bicep) +
[infra/modules/](../../infra/modules/) (shared with staging). Deploy workflow:
[.github/workflows/deploy-convex-production.yml](../../.github/workflows/deploy-convex-production.yml) —
**`workflow_dispatch` only**, no auto-trigger. Run it deliberately, after
`deploy-api`/`deploy-ui` have already gone out to `main`.

---

## Phase A — one-time prerequisites (already completed 2026-07-22)

These are data-plane / IAM steps the Bicep and workflow deliberately do **not**
perform. Recorded here so a future re-provision (new subscription, disaster
recovery) can repeat them.

### A1. Grant the production OIDC principal role-assignment rights

The Bicep creates three role assignments (AcrPull for the Convex runtime
identity, Key Vault Secrets User + Secrets Officer). ARM checks
`Microsoft.Authorization/roleAssignments/write` on **every** deployment, even
when the assignments are unchanged — plain `Contributor` is not enough.

```bash
SUB="<subscription-id>"
SP_ID=$(az ad sp show --id <AZURE_CLIENT_ID_of_production_app_registration> --query id -o tsv)

az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role "Contributor" --scope "/subscriptions/${SUB}/resourceGroups/retro_tool"

az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role "Role Based Access Control Administrator" --scope "/subscriptions/${SUB}/resourceGroups/retro_tool"
```

> **Known CLI bug — `MissingSubscription` on `az role assignment create/list`.**
> If your account is the subscription's classic **Account Admin** (common on
> Visual Studio Enterprise / legacy CSP subscriptions), the `az role assignment`
> subcommand can fail with `(MissingSubscription) The request did not have a
> subscription or a valid tenant level resource provider` — on **every** scope,
> including plain reads, regardless of role name vs. GUID. This is a bug in the
> CLI's role-assignment code path, not a real permission gap: verify with a raw
> `az rest` call, which uses the same token but hits the ARM REST API directly
> and works correctly:
>
> ```bash
> ROLE_ID="b24988ac-6180-42a0-ab88-20f7382dd24c"   # Contributor
> ASSIGNMENT_ID=$(node -e "console.log(require('crypto').randomUUID())")
> SCOPE="/subscriptions/${SUB}/resourceGroups/retro_tool"
>
> az rest --method put \
>   --url "https://management.azure.com${SCOPE}/providers/Microsoft.Authorization/roleAssignments/${ASSIGNMENT_ID}?api-version=2022-04-01" \
>   --body "{\"properties\":{\"roleDefinitionId\":\"/subscriptions/${SUB}/providers/Microsoft.Authorization/roleDefinitions/${ROLE_ID}\",\"principalId\":\"${SP_ID}\",\"principalType\":\"ServicePrincipal\"}}"
> ```
>
> Repeat with role GUID `f58310d9-a9f6-439a-9e8d-f62e7b41a168` (Role Based
> Access Control Administrator). See
> [docs/infra/oidc.md](../infra/oidc.md#known-cli-bug-missingsubscription-on-az-role-assignment)
> for the same note in the OIDC setup guide.

### A2. Mirror the pinned backend image into the production ACR

```bash
az acr login --name retrotool

# --repository (not --image/-t) does a manifest-only copy that preserves the
# digest; -t/--image expects a tag and rejects a digest as a target.
az acr import \
  --name retrotool \
  --source ghcr.io/get-convex/convex-backend@sha256:1738f1673f8d63161043a7859710d2301b1e9d6271e06afbb7af31594ea3a58f \
  --repository convex-backend
```

Verify:

```bash
az acr repository show --name retrotool \
  --image convex-backend@sha256:1738f1673f8d63161043a7859710d2301b1e9d6271e06afbb7af31594ea3a58f
```

> When the image is bumped, update
> [convex-backend/compatibility.json](../../convex-backend/compatibility.json)'s
> `backend.productionImage` **and** re-run this import for the new digest.

### A3. Create the Convex PostgreSQL role and database

Run against the production server (`retro-tool-db-server`). The application
database on this server is named **`retro-tool-db`** (hyphenated) — not
`retro_tool_db`; check with `\l` before writing a revoke statement blindly on a
new server.

```bash
docker run --rm -e PGPASSWORD='<pgadmin password>' postgres:17 \
  psql "host=retro-tool-db-server.postgres.database.azure.com port=5432 dbname=postgres user=pgadmin sslmode=require" \
  -c "CREATE ROLE convex_prod LOGIN PASSWORD '<STRONG_PASSWORD>';" \
  -c "CREATE DATABASE retrotool_convex_prod OWNER convex_prod;" \
  -c 'REVOKE ALL ON DATABASE "retro-tool-db" FROM convex_prod;' \
  -c 'REVOKE ALL ON DATABASE "retro-tool-db" FROM PUBLIC;'
```

> The database name **must** be `retrotool_convex_prod`. Convex derives it from
> `INSTANCE_NAME` (`retrotool-convex-prod`) by replacing hyphens with
> underscores.

### A4. Generate the instance secret, Postgres URL, and admin key

```bash
CONVEX_INSTANCE_SECRET=$(openssl rand -hex 32)
CONVEX_POSTGRES_URL="postgresql://convex_prod:<STRONG_PASSWORD>@retro-tool-db-server.postgres.database.azure.com"

az acr login --name retrotool
docker run --rm --entrypoint ./generate_admin_key.sh \
  -e INSTANCE_NAME=retrotool-convex-prod \
  -e INSTANCE_SECRET="${CONVEX_INSTANCE_SECRET}" \
  retrotool.azurecr.io/convex-backend@sha256:1738f1673f8d63161043a7859710d2301b1e9d6271e06afbb7af31594ea3a58f
```

The admin key is a **signed token derived from `INSTANCE_SECRET`** — not
deterministic. Generate it once, persist the exact value, never regenerate
expecting the same string (see
[convex-azure-self-hosting-plan.md](./convex-azure-self-hosting-plan.md#instance-naming-and-admin-key-lifecycle)
for the full rotation model).

### A5. Populate the GitHub `production` environment

```bash
gh secret set CONVEX_INSTANCE_SECRET --env production --repo kevin-gatimu/retro-tool-v2
gh secret set CONVEX_POSTGRES_URL --env production --repo kevin-gatimu/retro-tool-v2
gh secret set CONVEX_SELF_HOSTED_ADMIN_KEY --env production --repo kevin-gatimu/retro-tool-v2
```

(`AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` already exist on
`production` from the initial GitHub environment setup.)

**Status as of 2026-07-22: A1–A5 are complete.** `retrotool_convex_prod` exists
and is isolated from `retro-tool-db`; the image is mirrored; all three secrets
are set.

---

## Phase B — first automated deploy (provision + functions)

Trigger `Deploy Convex Production (App Service)` via **workflow_dispatch**
(Actions tab → select the workflow → Run workflow, branch `main`). The `deploy`
job ([deploy-convex-production.yml](../../.github/workflows/deploy-convex-production.yml)):

1. **validate** — type-check + lint `convex-backend`, assert the manifest's
   `productionImage` is digest-pinned and the SDK version matches, `az bicep
   build` the production template.
2. **single-instance invariant** — refuses to proceed if the Web App already
   runs more than one worker (skipped on first run).
3. **stop-first** — on an image change, stops the Web App before updating
   (skipped on first run).
4. **`az deployment group create`** against `infra/convex-production.bicep` —
   provisions the runtime identity, Key Vault, Log Analytics, the Azure Files
   share, and the Convex Web App with the `/convex/data` mount and
   `WEBSITES_PORT=3210`.
5. **start + wait** — polls `https://retrotool-prod-convex.azurewebsites.net/version`
   for up to 10 minutes.
6. **auth + functions** — `convex env set` for `JWT_ISSUER` (the production API
   URL), `JWT_AUDIENCE`, `JWT_JWKS_URL`, then `convex deploy`.

**If `/version` never comes up**, check, in order:
- Key Vault references not yet resolved → restart the Web App once.
- The Convex role cannot own its database → re-verify A3.
- The image digest is not in ACR → re-run A2.

---

## Phase C — cut the API and UI over to self-hosted Convex

Convex will be running, but the production API and UI still point at Convex
Cloud (`CONVEX_SYNC_URL`, `CONVEX_SYNC_ADMIN_KEY`, `VITE_CONVEX_URL` in the
`production` environment). This is a **separate, deliberate step** — do not cut
over automatically as part of Phase B.

**API** (update the `production` environment, then re-run `deploy-api.yml` via
`workflow_dispatch` on `main`):
- `CONVEX_SYNC_URL` = `https://retrotool-prod-convex.azurewebsites.net`
- `CONVEX_SYNC_ADMIN_KEY` = admin key from A4

**UI** (`VITE_CONVEX_URL` is compiled into the bundle at build time — changing
the Azure setting alone does nothing, a rebuild via `deploy-ui.yml` is
required):
- `VITE_CONVEX_URL` = `https://retrotool-prod-convex.azurewebsites.net`
- All five `VITE_*_REALTIME_BACKEND` flags are already `convex` in production.

**Keep the previous Convex Cloud `CONVEX_SYNC_URL` / key and the prior UI
artifact recorded** — that is your rollback until stabilization completes, per
the same 30-day / two-upgrade / one-restore-drill gate as staging.

### C1. Reconcile projections from PostgreSQL

**This now runs automatically** — `deploy-api.yml`'s `reconcile` job rebuilds
every projection after every successful API deploy (not gated on whether
Convex's image/functions changed), so cutting `CONVEX_SYNC_URL`/
`CONVEX_SYNC_ADMIN_KEY` over and re-running `deploy-api.yml` is sufficient; no
separate manual step is required. To run it out of band (e.g. investigating
drift without a full redeploy), rebuild every projection from the system of
record manually:

```bash
node retro-tool-api/dist/convex-admin/reconcile-projections.js
```

(needs `DATABASE_URL`, `CONVEX_SYNC_URL`, `CONVEX_SYNC_ADMIN_KEY` in env) or
`POST /api/convex-admin/reconcile-projections` as a super-admin. Do **not**
proceed past a failed reconciliation (see
[convex-staging-runbook.md §C1](./convex-staging-runbook.md#c1-reconcile-projections-from-postgresql)
for the full contract — identical for production).

---

## Phase D — verify

Same checklist as staging (see
[convex-staging-runbook.md §Phase D](./convex-staging-runbook.md#phase-d--verify)):
`/version` returns 200, sign-in + two-browser live updates, JWT/JWKS handshake,
two-tenant isolation, restart persistence, projection freshness.

---

## Backend image upgrades, rollback, and cost posture

Identical procedure to staging — see
[convex-staging-runbook.md](./convex-staging-runbook.md#backend-image-upgrades-stop-first)
for the stop-first upgrade sequence, the Convex Cloud rollback path, and the
lean cost posture (B1 Basic plan, no VNet/private endpoints on day one).
Substitute production resource names throughout: `retrotool-prod-convex`,
`retro_tool` resource group, `retrotool` ACR.
