# Deploying Retro Tool to a Brand-New Azure Subscription

An ordered, top-to-bottom runbook for standing up the **entire** Retro Tool stack —
NestJS API + React UI + self-hosted Convex + PostgreSQL — from scratch in a fresh
Azure subscription. A competent engineer should be able to follow this without
prior knowledge of the project's history.

> This document is the **end-to-end order** and the **core commands**. For the
> deep Convex-specific mechanics it links to
> [convex-staging-deployment-runbook.md](./convex-staging-deployment-runbook.md)
> (concrete steps) and [CONVEX-AZURE-SELF-HOSTING-PLAN.md](./CONVEX-AZURE-SELF-HOSTING-PLAN.md)
> (design/rationale). Read those for anything this guide summarizes.

---

## 0. Overview

### Architecture in one paragraph

PostgreSQL is the **system of record** — all durable state lives there, written
only by the NestJS API. The React UI (Azure Static Web App) talks to the API
(Azure App Service container) over REST + Socket.IO, and subscribes to a
**self-hosted Convex** backend (a second App Service container) for realtime
projections. After every business mutation the API pushes a projection intent to
Convex; Convex never owns business logic. Convex authenticates each subscription
by verifying an RS256 JWT the API issues, fetching the API's public JWKS. The
image the Convex container runs is digest-pinned via
[`convex-backend/compatibility.json`](../convex-backend/compatibility.json).

### Resource inventory (per environment)

Core stack — `infra/deploy.bicep` → `infra/main.bicep` (subscription scope, creates the RG):

| Resource | Bicep name pattern | Notes |
|---|---|---|
| Container Registry (ACR) | `retrotool<env>acr` (hyphens stripped) | Standard, admin disabled, managed-identity pull |
| User-Assigned Managed Identity | `retrotool-<env>-identity` | AcrPull on the ACR |
| PostgreSQL Flexible Server | `retrotool-<env>-db` | Burstable B1ms, 32 GiB, PG **17**, DB `retro_tool_db`, `AllowAzureServices` firewall rule |
| API App Service Plan | `retrotool-<env>-plan` | P0v3 (PremiumV3), Linux |
| API App Service (container) | `retrotool-<env>-api` | WebSockets, HTTPS-only, Always On, min TLS 1.2 |
| Static Web App (UI) | `retrotool-<env>-ui` | Standard, deployed to **westeurope** |

Self-hosted Convex stack — `infra/convex-staging.bicep` + `infra/modules/*` (resource-group scope, deploys **into the existing RG**, reuses the ACR + PostgreSQL server):

| Resource | Bicep name pattern | Notes |
|---|---|---|
| Convex App Service Plan | `retrotool-<env>-convex-plan` | B1 Basic, single worker |
| Convex App Service (container) | `retrotool-<env>-convex` | Port 3210, `/version` health check, `/convex/data` Azure Files mount |
| Convex runtime identity | `retrotool-<env>-convex-identity` | AcrPull + Key Vault Secrets User |
| Key Vault | `retrotool-<env>-cvx-<hash>` | Holds `convex-instance-secret` + `convex-postgres-url`; **version-pinned** secret URIs |
| Storage account + Files share | `convex-data` share | Durable Convex state, survives restarts/image swaps |
| Log Analytics workspace | `retrotool-<env>-convex-logs` | PerGB2018, 30-day retention |
| Convex PostgreSQL database | `retrotool_convex_<env>` | Separate DB on the shared server, own least-privilege role |

### Prerequisites (local tooling)

- **Node.js 22**, **pnpm 9+** (CI pins pnpm `11.13.0`)
- **Docker Desktop** (to mint the Convex admin key from the pinned image)
- **Azure CLI** v2.20+ (`az bicep upgrade` to get the bundled Bicep)
- **`psql`** client (Cloud Shell has it) and `openssl`
- An **Azure subscription** where you hold **Owner** (or at least **User Access
  Administrator**) at subscription scope — the Bicep creates role assignments and
  Contributor cannot grant them (see gotcha #7).
- A **Resend** account (email), and a way to run `npx web-push generate-vapid-keys`.

### Names you'll choose — and a critical caveat

The core stack derives all names from a single `environment` parameter
(`prod` / `staging` / `develop` → `retrotool-<env>-*`). **But the Convex stack's
params are hardcoded to the staging names** — `acrName` defaults to
`retrotoolstagingacr`, `postgresServerName` to `retrotool-staging-db`,
`convexInstanceName` to `retrotool-convex-staging`, and its `environment` param is
`@allowed(['staging'])`. If you deploy a **non-staging** environment (or reuse
these files under a new name) you must **override those params explicitly** on the
`az deployment group create` call — or relax the `@allowed` list first. This guide
calls out every override.

Decide up front and keep a scratch file:

| Placeholder | Meaning | Example |
|---|---|---|
| `<ENV>` | Environment token in Bicep (`prod`/`staging`/`develop`) | `staging` |
| `<NEW_RG>` | Resource group | `retrotool-staging-rg` |
| `<ACR_NAME>` | ACR name (no hyphens) | `retrotoolstagingacr` |
| `<ACR_LOGIN_SERVER>` | ACR login server | `retrotoolstagingacr.azurecr.io` |
| `<PG_SERVER>` | PostgreSQL server name | `retrotool-staging-db` |
| `<API_WEBAPP>` | API App Service name | `retrotool-staging-api` |
| `<CONVEX_WEBAPP>` | Convex App Service name | `retrotool-staging-convex` |
| `<CONVEX_INSTANCE_NAME>` | Convex instance / DB stem | `retrotool-convex-staging` |
| `<API_ORIGIN>` | Public API https origin | `https://retrotool-staging-api.azurewebsites.net` |
| `<CONVEX_ORIGIN>` | Public Convex https origin | `https://retrotool-staging-convex.azurewebsites.net` |

> **Mark of caution:** the automated GitHub workflow path
> (`release-staging.yml` → `deploy-convex.yml`) is **staging-only** and hardcodes
> `retrotool-staging-rg` / `retrotoolstagingacr` / `retrotool-staging-convex` in
> its `env:` block. For a new subscription that is *also* named `staging`, the
> workflows work as-is once secrets/vars are set. For a differently-named
> environment, use the **manual `az` commands** in this guide (steps 5–9) and/or
> edit those workflow `env:` values.

---

## 1. One-time: Azure login and subscription setup

```bash
az login
az account set --subscription "<SUBSCRIPTION_ID>"
az account show --query "{tenantId:tenantId, subscriptionId:id}" -o table
```

Register the resource providers the stack uses (idempotent — safe to re-run):

```bash
for ns in Microsoft.Web Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL \
          Microsoft.ManagedIdentity Microsoft.KeyVault Microsoft.Storage \
          Microsoft.OperationalInsights Microsoft.Insights Microsoft.Authorization; do
  az provider register --namespace "$ns"
done
```

Upgrade Bicep so the templates build:

```bash
az bicep upgrade
```

---

## 2. One-time: GitHub OIDC federated identity

So the workflows can deploy without stored credentials. Full guide:
[infra/README-oidc.md](../infra/README-oidc.md).

1. Create (or reuse) an **App Registration** in Entra ID (the OIDC guide defaults
   to display name `retro-tool`).
2. Create the GitHub environment(s) whose names **exactly** match the ones your
   workflows use (`staging` here — the workflows are hardcoded to `staging`).
3. Create the federated credential(s):

   ```powershell
   .\infra\setup-oidc-credentials.ps1 -Environment staging
   ```

   or the CLI equivalent (see README-oidc.md "Manual Alternative"). The subject
   must be `repo:<owner>/<repo>:environment:<env>`.

4. Grant the App Registration's service principal a subscription/RG role that can
   **write role assignments** — see step 3 and gotcha #7.

You'll capture `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` into
GitHub in step 8.

---

## 3. Provision core infrastructure (subscription scope)

This creates the RG, ACR, identity, PostgreSQL, API App Service, and Static Web App.

```bash
az deployment sub create \
  --location southafricanorth \
  --name retrotool-core-<ENV> \
  --template-file infra/deploy.bicep \
  --parameters \
      environment=<ENV> \
      postgresAdminPassword='<STRONG_PG_ADMIN_PASSWORD>'
```

Optional param defaults you can override: `location` (`southafricanorth`),
`staticWebAppLocation` (`westeurope` — do **not** move to southafricanorth, see
gotcha #8), `postgresAdminLogin` (`pgadmin`), `dockerImageName`
(`retro-tool-api`), `dockerImageTag` (`latest`), `apiAppSettings` (`{}`).

**Preview first** if you like: swap `create` for `what-if`.

**Grant the deploy principal role-assignment rights on the RG** (needed before the
Convex stack in step 6, and any workflow deploy). Contributor is insufficient:

```bash
az role assignment create \
  --assignee <APP_REGISTRATION_CLIENT_ID> \
  --role "Owner" \
  --scope /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<NEW_RG>
```

**Capture the outputs** — you'll need them repeatedly:

```bash
az deployment sub show --name retrotool-core-<ENV> \
  --query "properties.outputs" -o json
```

| Output | Use |
|---|---|
| `acrLoginServer` | GitHub `ACR_LOGIN_SERVER`; image pushes |
| `acrName` | `az acr login`, `az acr import` |
| `staticWebAppName` | fetch the SWA deploy token |
| `apiUrl` | `<API_ORIGIN>`; `BETTER_AUTH_URL`, JWT issuer, CORS |
| `uiUrl` | `FRONTEND_URL` / `VITE_API_URL` origin |
| `databaseUrl` | `DATABASE_URL` template — **replace `<password>`** |
| `appServiceName` | `<API_WEBAPP>` for `az webapp` commands |
| `managedIdentityClientId` | already wired to the API App Service |

---

## 4. Bootstrap PostgreSQL

### 4a. Migrate + seed the API database (`retro_tool_db`)

Migrations and prod-safe seeds (retro + estimate + icebreaker templates and team
roles) are idempotent. Run them from your machine with the real `DATABASE_URL`
(admin password substituted into the step-3 `databaseUrl` output):

```bash
export DATABASE_URL='postgresql://pgadmin:<PW>@<PG_SERVER>.postgres.database.azure.com:5432/retro_tool_db?sslmode=require'

pnpm --dir retro-tool-api db:migrate       # applies Drizzle migrations
pnpm --dir retro-tool-api db:seed:templates # retro + estimate + icebreaker templates
# team roles are covered by the workflow's seed job; locally use seed:prod-safe:
# node scripts/db.mjs seed:prod-safe  (via the :staging/:prod wrappers if using env files)
```

> The `deploy-api.yml` workflow performs the same migrate + seed automatically
> against the `staging` `DATABASE_URL` secret (it runs
> `seed-retro-templates.js`, `seed-estimate-templates.js`, `seed-team-roles.js`).
> Running it here first is only needed if you want the DB ready before the first
> pipeline run, or you are deploying a non-staging env manually.
>
> **Never** run `db:seed` / `seed:roles` / `seed:users` against a remote env —
> `scripts/db.mjs` marks those `localOnly` (demo users must never be seeded
> remotely).

### 4b. Create the Convex database + least-privilege role

Bicep declares the Convex database resource, but the login **role** is data-plane
work you do once. From **Azure Cloud Shell** (covered by `AllowAzureServices`) or a
temporarily-allowlisted IP, connect as the server admin and run:

```bash
psql "host=<PG_SERVER>.postgres.database.azure.com port=5432 dbname=postgres user=pgadmin sslmode=require"
```

```sql
CREATE ROLE convex_<ENV> LOGIN PASSWORD '<STRONG_CONVEX_DB_PASSWORD>';
CREATE DATABASE retrotool_convex_<ENV> OWNER convex_<ENV>;

-- Hard boundary: the Convex role must never touch the API's system of record.
REVOKE ALL ON DATABASE retro_tool_db FROM convex_<ENV>;
REVOKE ALL ON DATABASE retro_tool_db FROM PUBLIC;
```

> The database name **must** equal `<CONVEX_INSTANCE_NAME>` with hyphens replaced
> by underscores (Convex derives it from `INSTANCE_NAME`). For the default
> `retrotool-convex-staging` that is `retrotool_convex_staging`. The Bicep
> `convexDatabase` resource then reconciles this idempotently.

---

## 5. Mirror the pinned Convex image into the new ACR

The Convex App Service runs a **digest-pinned** image; nothing pushes it for you.
Import the digest recorded in
[`convex-backend/compatibility.json`](../convex-backend/compatibility.json)
(`az acr import` preserves the digest, so the pin resolves). As of this writing the
manifest digest is `sha256:1738f1673f8d63161043a7859710d2301b1e9d6271e06afbb7af31594ea3a58f`
— **read the file for the current value** rather than trusting this copy:

```bash
DIGEST=$(node -p "require('./convex-backend/compatibility.json').backend.manifestDigest")

az acr import \
  --name <ACR_NAME> \
  --source ghcr.io/get-convex/convex-backend@${DIGEST} \
  --image convex-backend@${DIGEST}
```

Your `convexImage` reference is then
`<ACR_LOGIN_SERVER>/convex-backend@${DIGEST}`. When you bump Convex, update
`compatibility.json` **and** re-import the new digest.

---

## 6. Provision the self-hosted Convex stack

### 6a. Generate the instance secret (MUST be hex) and the Postgres URL

```bash
CONVEX_INSTANCE_SECRET=$(openssl rand -hex 32)   # HEX — not base64 (gotcha #1)
```

Build `CONVEX_POSTGRES_URL` with **host only** — **no database name, no query
string** (gotcha #5). Convex appends the DB itself; TLS is enforced by the app
setting `DO_NOT_REQUIRE_SSL=false`, not by `?sslmode=`:

```
postgresql://convex_<ENV>:<STRONG_CONVEX_DB_PASSWORD>@<PG_SERVER>.postgres.database.azure.com
```

### 6b. Deploy the Convex Bicep (resource-group scope)

```bash
az deployment group create \
  --resource-group <NEW_RG> \
  --name convex-<ENV>-provision \
  --template-file infra/convex-staging.bicep \
  --parameters \
      environment=staging \
      acrName='<ACR_NAME>' \
      postgresServerName='<PG_SERVER>' \
      convexInstanceName='<CONVEX_INSTANCE_NAME>' \
      convexImage='<ACR_LOGIN_SERVER>/convex-backend@'"${DIGEST}" \
      convexInstanceSecret="${CONVEX_INSTANCE_SECRET}" \
      convexPostgresUrl='postgresql://convex_<ENV>:<PW>@<PG_SERVER>.postgres.database.azure.com'
```

> **Param overrides for a new sub / non-staging env:**
> - `environment` is `@allowed(['staging'])` — for any other env you must first
>   relax that allow-list in `infra/convex-staging.bicep`.
> - `acrName` / `postgresServerName` / `convexInstanceName` default to the staging
>   names; **always pass them explicitly** so the stack binds to the resources you
>   created in steps 3–4.
> - Optionally pass `bootstrapPrincipalObjectId` (+ `bootstrapPrincipalType`) to
>   grant yourself Key Vault Secrets Officer so you can read/rotate the KV secrets.

This creates the Key Vault (with **version-pinned** secret URIs — gotcha #2), the
storage account + `convex-data` share, Log Analytics, the runtime identity (with
AcrPull + KV Secrets User), and the Convex Web App with the `/convex/data` mount,
`INSTANCE_NAME`, and the two KV-referenced secrets. It also reconciles the
`retrotool_convex_<ENV>` database.

Wait for `/version` to answer 200 (first boot runs Convex's own DB migrations —
give it up to ~10 minutes):

```bash
curl -fsS <CONVEX_ORIGIN>/version && echo OK
```

If it never comes up, check in order: KV references unresolved → `az webapp restart`
once; Convex role can't own its DB → re-verify 4b; digest not in ACR → re-run 5.

---

## 7. Post-provision Convex config (manual — the infra deploy does NOT do this)

Provisioning the Web App does **not** set the JWT function env vars and does **not**
upload the Convex functions. If you skip this, browser subscriptions get
`Unauthenticated` and function calls get "Could not find public function"
(gotcha #3).

### 7a. Generate + persist the admin key

The admin key is a **signed token derived from `INSTANCE_SECRET`** — not
deterministic. Each run of `generate_admin_key.sh` mints a new, independently-valid
token; rotating `INSTANCE_SECRET` invalidates all prior keys (gotcha #4). Generate
**once** from the exact pinned image and persist that value:

```bash
docker run --rm --entrypoint ./generate_admin_key.sh \
  -e INSTANCE_NAME=<CONVEX_INSTANCE_NAME> \
  -e INSTANCE_SECRET="${CONVEX_INSTANCE_SECRET}" \
  ghcr.io/get-convex/convex-backend@${DIGEST}
```

> Fallback if offline `docker run` is awkward: `az webapp ssh -n <CONVEX_WEBAPP>
> -g <NEW_RG>` and run `./generate_admin_key.sh` inside the running container.

Persist this exact value and reuse it in **both** places (do not mint a separate
key per consumer):

- `CONVEX_SELF_HOSTED_ADMIN_KEY` — the Convex CLI / function deploy.
- `CONVEX_SYNC_ADMIN_KEY` — the API's projection writes (step 8).

### 7b. Set the JWT function env + deploy functions

These three vars are read via `process.env` **inside Convex functions**
(`convex/auth.config.ts`) — they live on the **Convex deployment**, not the API's
App Service. On Azure both API and Convex are public, so `JWT_JWKS_URL` is simply
the API's public origin + `/api/auth/jwks` (gotcha #6 — the
`host.docker.internal` form is a **local-dev-only** quirk):

```bash
cd convex-backend
export CONVEX_SELF_HOSTED_URL='<CONVEX_ORIGIN>'
export CONVEX_SELF_HOSTED_ADMIN_KEY='<admin key from 7a>'

pnpm exec convex env set JWT_ISSUER   '<API_ORIGIN>'
pnpm exec convex env set JWT_AUDIENCE convex
pnpm exec convex env set JWT_JWKS_URL '<API_ORIGIN>/api/auth/jwks'
pnpm exec convex env list   # verify

pnpm exec convex deploy --typecheck enable --message "initial <ENV> deploy"
```

`JWT_ISSUER` must match the API's `BETTER_AUTH_URL` **byte-for-byte** (scheme, host,
no trailing slash) — a mismatch silently breaks all Convex auth.

> The `deploy-convex.yml` workflow performs 7b automatically on every staging run.
> This manual step is required only when you provision Convex outside that workflow
> (new sub / non-staging env / first manual bring-up).

---

## 8. Configure API app settings + GitHub environment secrets

### 8a. Azure App Registration for Microsoft OAuth

In Entra ID → App Registrations, add **Redirect URIs** (Authentication → Web):

```
<API_ORIGIN>/api/auth/callback/microsoft
http://localhost:8000/api/auth/callback/microsoft
```

Create a client secret. Note the Application (client) ID and Directory (tenant) ID.

### 8b. GitHub environment secrets + variables

Populate the GitHub environment (Settings → Environments → `staging`). The names
below are the **actual** ones read by the workflows (they accept either a Secret or
a Variable of the same name via `secrets.X || vars.X`).

**Secrets (sensitive):**

| Name | Consumed by | Value |
|---|---|---|
| `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` | all (OIDC login) | from OIDC setup (step 2) |
| `DATABASE_URL` | deploy-api (migrate/seed/deploy) | step-3 `databaseUrl` with real password |
| `BETTER_AUTH_SECRET` | deploy-api | `openssl rand -base64 32` |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | deploy-api | step 8a (falls back to `AZURE_CLIENT_ID`) |
| `RESEND_API_KEY` | deploy-api | Resend dashboard |
| `VAPID_PRIVATE_KEY` | deploy-api | `npx web-push generate-vapid-keys` |
| `CONVEX_SYNC_ADMIN_KEY` | deploy-api | admin key from 7a |
| `CONVEX_INSTANCE_SECRET` | deploy-convex | hex secret from 6a |
| `CONVEX_POSTGRES_URL` | deploy-convex | host-only URL from 6a |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | deploy-convex | admin key from 7a (same value) |
| `API_ADMIN_TOKEN` | deploy-convex (optional) | super-admin bearer for outbox pause/resume/reconcile |
| `SWA_DEPLOYMENT_TOKEN` | deploy-ui | `az staticwebapp secrets list --name <staticWebAppName> --query "properties.apiKey" -o tsv` |

**Variables (non-sensitive):**

| Name | Consumed by | Example |
|---|---|---|
| `ACR_LOGIN_SERVER` | deploy-api | `<ACR_LOGIN_SERVER>` |
| `API_IMAGE_REPOSITORY` | deploy-api | `retro-tool-api` (default if unset) |
| `API_WEBAPP_NAME` | deploy-api | `<API_WEBAPP>` |
| `AZURE_RESOURCE_GROUP` | deploy-api | `<NEW_RG>` |
| `CONVEX_SYNC_URL` | deploy-api | `<CONVEX_ORIGIN>` |
| `EMAIL_FROM` | deploy-api | `Retro-Tool <info@retro-tool.com>` |
| `FRONTEND_URL` (or `SWA_URL`) | deploy-api | UI origin (`uiUrl`) |
| `MICROSOFT_TENANT_ID` | deploy-api | tenant ID (falls back to `AZURE_TENANT_ID`) |
| `VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` | deploy-api | from web-push; subject e.g. `<API_ORIGIN>` |
| `VITE_APP_TITLE` / `VITE_APP_ENV` | deploy-ui | `Retro Tool (Staging)` / `staging` |
| `VITE_API_URL` | deploy-ui | `<API_ORIGIN>` |
| `VITE_CONVEX_URL` | deploy-ui | `<CONVEX_ORIGIN>` |
| `VITE_RETROS_REALTIME_BACKEND` | deploy-ui | `convex` or `socket-io` |
| `VITE_ESTIMATES_REALTIME_BACKEND` | deploy-ui | `convex` or `socket-io` |
| `VITE_ICEBREAKERS_REALTIME_BACKEND` | deploy-ui | `convex` or `socket-io` |
| `VITE_STANDUPS_REALTIME_BACKEND` | deploy-ui | `convex` or `socket-io` |
| `VITE_NOTIFICATIONS_REALTIME_BACKEND` | deploy-ui | `convex` or `socket-io` |

> `deploy-ui.yml` requires **all five** `VITE_*_REALTIME_BACKEND` flags to be set
> and validates each is `socket-io|convex`; if any is `convex`, `VITE_CONVEX_URL`
> is mandatory. `VITE_*` values are **baked into the bundle at build time** — a
> change only takes effect on a UI rebuild.
>
> Do **not** add `PORT`, `NODE_ENV`, `ENABLE_CRON_JOBS`, `WEEKLY_DIGEST_SEND_HOUR`,
> `BETTER_AUTH_SESSION_EXPIRES_IN`, `ALLOWED_ORIGINS`, `BETTER_AUTH_URL`,
> `LOCAL_SERVER_URL`, or `DEPLOYED_SERVER_URL` as GitHub vars — `deploy-api.yml`
> computes and pushes those to the App Service on every deploy, and duplicates
> cause conflicts.

The full env-var surface each app supports (beyond what the pipeline sets) is in
[`retro-tool-api/.env.example`](../retro-tool-api/.env.example),
[`retro-tool-ui/.env.example`](../retro-tool-ui/.env.example), and
[`convex-backend/.env.example`](../convex-backend/.env.example).

---

## 9. Build + deploy the apps

### Option A (recommended): the orchestrated pipeline

`release-staging.yml` runs on push to `staging` (or via **workflow_dispatch**) and
chains the three deploy workflows **in dependency order**: `convex` → `api` → `ui`
(`secrets: inherit`). Each sub-workflow validates, then:

- **deploy-convex.yml** — validates the digest-pin manifest, enforces the
  single-worker invariant, does a stop-first upgrade on image change, runs the
  Convex Bicep, sets the JWT env, and `convex deploy`s the functions (i.e. it
  performs steps 6b + 7b for you on staging).
- **deploy-api.yml** — lints/tests, builds & pushes the API image to ACR (tags
  `<env>-<sha8>`, `<env>-latest`, `<env>-v<version>`), runs migrations + seeds,
  sets App Service settings/secrets, deploys the container, and health-checks
  `/health/ready`.
- **deploy-ui.yml** — builds the Vite bundle with the `VITE_*` vars and uploads to
  the Static Web App.

For a **first automated run**, prefer **workflow_dispatch** on `release-staging`
(cleaner than a push). Ensure steps 1–8 are done first (especially the OIDC role
grant and the Convex one-time bootstrap 4b/5/7a).

### Option B: manual `az` commands (non-staging env, or no pipeline)

**API image → ACR → App Service:**

```bash
az acr login --name <ACR_NAME>
IMAGE=<ACR_LOGIN_SERVER>/retro-tool-api:<ENV>-latest
docker build --file retro-tool-api/Dockerfile --tag "$IMAGE" .
docker push "$IMAGE"

az webapp config container set \
  --resource-group <NEW_RG> --name <API_WEBAPP> \
  --docker-custom-image-name "$IMAGE" \
  --docker-registry-server-url "https://<ACR_LOGIN_SERVER>"
az webapp restart --resource-group <NEW_RG> --name <API_WEBAPP>
```

Set the API app settings/secrets that the workflow would otherwise push (see the
`az webapp config appsettings set` blocks in
[`.github/workflows/deploy-api.yml`](../.github/workflows/deploy-api.yml) for the
exact list — `NODE_ENV`, `PORT=8080`, `FRONTEND_URL`, `ALLOWED_ORIGINS`,
`CONVEX_SYNC_URL`, `BETTER_AUTH_URL`, `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`CONVEX_SYNC_ADMIN_KEY`, VAPID, Microsoft OAuth, `RESEND_API_KEY`, `EMAIL_FROM`,
etc.).

**UI → Static Web App:**

```bash
VITE_APP_ENV=staging VITE_API_URL=<API_ORIGIN> VITE_CONVEX_URL=<CONVEX_ORIGIN> \
VITE_RETROS_REALTIME_BACKEND=convex VITE_ESTIMATES_REALTIME_BACKEND=convex \
VITE_ICEBREAKERS_REALTIME_BACKEND=convex VITE_STANDUPS_REALTIME_BACKEND=convex \
VITE_NOTIFICATIONS_REALTIME_BACKEND=convex VITE_APP_TITLE='Retro Tool' \
  pnpm --filter retro-tool-ui build

SWA_TOKEN=$(az staticwebapp secrets list --name <staticWebAppName> \
  --query "properties.apiKey" -o tsv)
npx @azure/static-web-apps-cli deploy retro-tool-ui/dist \
  --deployment-token "$SWA_TOKEN" --env production
```

### 9c. Reconcile projections from PostgreSQL

Immediately after the API points at self-hosted Convex, rebuild every projection
from the system of record into the fresh (empty) Convex deployment:

```bash
# From a build with the staging DATABASE_URL + CONVEX_SYNC_URL/KEY in env.
node retro-tool-api/dist/convex-admin/reconcile-projections.js
```

or, authenticated as super-admin: `POST /api/convex-admin/reconcile-projections`.
It is idempotent and exits non-zero on any partial failure — **do not proceed past
a failed reconciliation**. See the runbook's
[Phase C](./convex-staging-deployment-runbook.md) for details.

---

## 10. Verification checklist

1. `curl -fsS <CONVEX_ORIGIN>/version` → **200**.
2. `curl -fsS <API_ORIGIN>/health/ready` → **200**.
3. `curl -fsS <API_ORIGIN>/api/auth/jwks` → **200** with a JWK set, and confirm
   Convex logs show it fetching that URL (it must be publicly reachable).
4. Convex functions resolve (no "Could not find public function"); an
   **unauthenticated** subscription is rejected with `Unauthenticated`.
5. Sign in via Entra; open a retro in **two browsers** → live updates flow both
   ways within the latency budget (a new card/vote appears in the other session).
6. **Tenant isolation:** a user in team A cannot see team B's board.
7. **Persistence:** `az webapp restart -n <CONVEX_WEBAPP> -g <NEW_RG>`, re-open a
   board — deployed functions on `/convex/data` survive the restart.
8. Projection freshness: `GET /api/convex-admin/outbox/status` shows a healthy
   (draining) queue, and reconcile (9c) reported `ok: true`.

---

## 11. Troubleshooting — the gotchas that bit the real deploy

| Symptom | Cause | Fix |
|---|---|---|
| Convex crash-loops with `Couldn't hexdecode key` | `INSTANCE_SECRET` was base64 | Regenerate as **hex**: `openssl rand -hex 32`; update the KV secret + `CONVEX_INSTANCE_SECRET`; note this invalidates prior admin keys (re-run 7a) |
| Rotated a KV secret but the app still serves the old value | App Service caches `@Microsoft.KeyVault` references; a plain restart does not re-fetch | The Bicep emits **version-pinned** URIs (`secretUriWithVersion`) so a rotation changes the app-setting value; re-run the Convex Bicep, then **re-save the app setting** (or redeploy) to force an immediate refresh |
| Browser subscriptions all say `Unauthenticated`; calls say "Could not find public function" | JWT function env not set and/or functions never deployed — infra deploy does neither | Run step 7b: `convex env set` the three `JWT_*` vars, then `convex deploy` |
| Convex auth silently broken even though JWKS is reachable | `JWT_ISSUER` doesn't match the token `iss` byte-for-byte (trailing slash / scheme / port) | Set `JWT_ISSUER` to exactly the API's `BETTER_AUTH_URL` (`<API_ORIGIN>`, no trailing slash) |
| Admin key stopped working after a secret change | Admin key is signed by `INSTANCE_SECRET`; rotating it invalidates all keys | Regenerate (7a) and update **both** `CONVEX_SYNC_ADMIN_KEY` and `CONVEX_SELF_HOSTED_ADMIN_KEY` |
| Convex can't connect to Postgres / picks the wrong DB | `POSTGRES_URL` had a database name or `?sslmode=` query string | Use **host:port only**; Convex derives the DB from `INSTANCE_NAME` (hyphens→underscores); TLS is enforced by `DO_NOT_REQUIRE_SSL=false` |
| Works locally, JWKS fetch fails on Azure (or vice-versa) | Local dev uses `host.docker.internal` because the container can't reach the host via `localhost`; on Azure both are public | On Azure, `JWT_JWKS_URL` = `<API_ORIGIN>/api/auth/jwks` (public https) |
| Bicep deploy fails `AuthorizationFailed` on a `roleAssignments` write | Deploy principal has Contributor, not enough to create role assignments | Grant **Owner** or **User Access Administrator** on the RG (step 3) |
| Static Web App deploy fails / region error | SWA isn't available in `southafricanorth` | Leave `staticWebAppLocation=westeurope` (everything else stays southafricanorth) |
| API 504 Gateway Timeout | `WEBSITES_PORT` wrongly set on the API app | The API workflow sets `PORT=8080` and Azure auto-detects — do not set `WEBSITES_PORT` on the API |
| ACR pull fails (503) | Managed-identity pull not configured | `az webapp config show --name <API_WEBAPP> --query acrUseManagedIdentityCreds` must be `true` (re-run core Bicep) |

---

## 12. Ongoing operations

- **Backend image upgrades (stop-first).** The open-source Convex backend is
  single-instance, so an image change cannot be zero-downtime. Follow the
  stop-first maintenance sequence (export → pause outbox → stop → deploy new pinned
  digest → start → wait `/version` → `convex deploy` → resume + reconcile) in the
  runbook's [Backend image upgrades](./convex-staging-deployment-runbook.md#backend-image-upgrades-stop-first)
  section. An older digest is **not** a safe rollback after an in-place migration.
- **Secret rotation.** To rotate `INSTANCE_SECRET`: generate a new hex value,
  update the KV `convex-instance-secret` (re-run the Convex Bicep so the
  version-pinned URI changes), re-save the Convex app settings to force a KV
  re-fetch, **regenerate the admin key** (7a), and update both admin-key secrets.
  All prior admin keys are invalidated.
- **App rollback.** API images are tagged `<env>-v<version>` and `<env>-latest`;
  roll the API back with `az webapp config container set` pointing at a prior tag.
  For the UI, redeploy a prior artifact (remember `VITE_*` is compile-time).
- **Convex Cloud escape hatch.** The runbook documents a full
  [Rollback to Convex Cloud](./convex-staging-deployment-runbook.md#rollback-to-convex-cloud)
  path — keep the previous `CONVEX_SYNC_URL`/key and UI artifact recorded until the
  self-hosted backend is proven stable.

---

## Reference index

- Design & rationale: [CONVEX-AZURE-SELF-HOSTING-PLAN.md](./CONVEX-AZURE-SELF-HOSTING-PLAN.md)
- Convex phase-by-phase bootstrap + rollback: [convex-staging-deployment-runbook.md](./convex-staging-deployment-runbook.md)
- Core infra commands + GitHub env config: [../infra/README.md](../infra/README.md)
- OIDC federated identity: [../infra/README-oidc.md](../infra/README-oidc.md)
- Convex ↔ NestJS JWT auth deep dive: [convex-nestjs-auth.md](./convex-nestjs-auth.md)
- Convex architecture (topology, secrets, sync layer): [convex-architecture.md](./convex-architecture.md)
```
