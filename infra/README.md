# Retro Tool — Azure Infrastructure (Bicep)

Provisions all Azure resources for Retro Tool via CLI. Each environment gets an isolated set of resources — the Bicep `environment` parameter takes `prod`, `staging`, or `develop`, while the corresponding GitHub environments are named `production`, `staging`, and `develop` (these names must match exactly for environment secrets/vars and OIDC federated credentials).

## Prerequisites

1. **Azure CLI** (v2.20+): `winget install -e --id Microsoft.AzureCLI`
2. **Bicep CLI** (bundled): `az bicep upgrade`
3. **Azure subscription** with **Owner** or **User Access Administrator** at subscription scope — both `main.bicep` and `convex-staging.bicep` create role assignments (AcrPull, Key Vault Secrets User), which Contributor cannot grant. The **CI deploy principal** (GitHub OIDC) does not need subscription Owner: grant it **Role Based Access Control Administrator** scoped to the target resource group so `convex-staging.bicep` can re-assert its role assignments on every run (see [Troubleshooting](#troubleshooting))

## File Structure

```
infra/
├── deploy.bicep              # Core stack entry point (subscription scope — creates resource group)
├── main.bicep                # Core resources: ACR, identity, PostgreSQL, API App Service, Static Web App
├── main.json                 # Compiled ARM template for main.bicep
├── convex-staging.bicep      # Self-hosted Convex on App Service (resource-group scope, staging only)
├── modules/
│   ├── convex-app-service.bicep  # Linux Web App for Containers running the Convex backend
│   ├── convex-storage.bicep      # Azure Files share mounted at /convex/data
│   ├── convex-key-vault.bicep    # Key Vault + role assignments for Convex secrets
│   └── convex-monitoring.bicep   # Log Analytics workspace for Convex diagnostics
├── setup-oidc-credentials.ps1  # OIDC federated credential automation
├── README.md                 # This file
└── README-oidc.md            # OIDC setup guide
```

Two independent stacks live here:

- **Core app stack** (`deploy.bicep` → `main.bicep`) — provisioned per environment (`prod`, `staging`, `develop`).
- **Self-hosted Convex stack** (`convex-staging.bicep` + `modules/`) — **staging only**, deployed into the existing `retrotool-staging-rg`. See [Self-hosted Convex (staging)](#self-hosted-convex-staging).

## Commands

### Login

```powershell
az login
az account set --subscription "<subscription-id>"
```

### Deploy an environment

```powershell
# Production (branch: main)
az deployment sub create --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters environment=prod postgresAdminPassword='<prod-password>'

# Staging (branch: staging)
az deployment sub create --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters environment=staging postgresAdminPassword='<staging-password>'

# Development (branch: develop)
az deployment sub create --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters environment=develop postgresAdminPassword='<dev-password>'
```

### Preview changes (what-if / dry run)

```powershell
az deployment sub what-if --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters environment=staging postgresAdminPassword='<staging-password>'
```

### View outputs after deployment

```powershell
az deployment sub show --name deploy --location southafricanorth `
  --query "properties.outputs" --output table
```

### Destroy an environment

```powershell
az group delete --name retrotool-<env>-rg --yes --no-wait
```

> The core app stack is provisioned from the CLI only — there is no
> infrastructure-provisioning GitHub workflow. GitHub Actions handle app
> **deployment** (`deploy-api.yml`, `deploy-ui.yml`) and the self-hosted Convex
> stack (`deploy-convex.yml`), not core-resource provisioning.

---

## Environment -> Branch Mapping

| Environment | Parameter              | Branch    | Resource Group          |
| ----------- | ---------------------- | --------- | ----------------------- |
| Production  | `environment=prod`     | `main`    | `retrotool-prod-rg`    |
| Staging     | `environment=staging`  | `staging` | `retrotool-staging-rg` |
| Development | `environment=develop`  | `develop` | `retrotool-develop-rg` |

---

## GitHub Environment Configuration

Each GitHub environment (`production`, `staging`, `develop`) needs secrets and variables. The deploy workflow (`deploy-api.yml`) reads these to build, push, and configure the App Service.

> **GitHub is the source of truth for App Service config.** `deploy-api.yml` rewrites
> the API's App Service settings from these GitHub secrets/variables on **every**
> deploy (e.g. `CONVEX_SYNC_URL: ${{ vars.CONVEX_SYNC_URL || secrets.CONVEX_SYNC_URL }}`).
> Editing an App Service setting by hand in the Azure Portal is **transient** — the
> next deploy overwrites it with the GitHub value. Always change the value in GitHub,
> then redeploy.

### Bulk-sync GitHub env config (recommended)

Setting keys one at a time in the GitHub UI is how config drifts (a stale
`CONVEX_SYNC_URL` secret silently reverted an App Service change). Instead, keep
all values in one git-ignored file and push them together:

```powershell
# 1. Copy the template and fill in real values (git-ignored — never committed):
cp .github-env.example .github-env.staging.local

# 2. Preview, then apply, then redeploy so App Service picks them up:
pnpm gh:env:sync staging -- --dry-run          # show what would change
pnpm gh:env:sync staging                        # apply to the GitHub 'staging' environment
pnpm gh:env:sync staging -- --only CONVEX_SYNC_URL,VITE_CONVEX_URL   # sync a subset
pnpm gh:env:sync staging -- --prune             # report GitHub keys missing from the manifest
```

- **`scripts/github-env-manifest.json`** (committed) classifies every key as a
  `secret` (encrypted, set via stdin so it never hits the process list) or a
  `variable` (plain). When a workflow starts reading a new `secrets.X` / `vars.X`,
  add it here.
- **`.github-env.<env>.local`** (git-ignored) holds the values. Keys you omit are
  left untouched, so you can safely sync just the few that changed.
- Requires the `gh` CLI authenticated with repo admin rights.

### Secrets (sensitive — you must add these manually)

| Secret | Description | How to get it |
| --- | --- | --- |
| `AZURE_CLIENT_ID` | App Registration client ID | Entra ID -> App Registrations -> Overview |
| `AZURE_TENANT_ID` | Entra ID tenant ID | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | `az account show --query id -o tsv` |
| `DATABASE_URL` | PostgreSQL connection string | Bicep output `databaseUrl` (replace `<password>`) |
| `BETTER_AUTH_SECRET` | Session signing secret | `openssl rand -base64 32` |
| `MICROSOFT_CLIENT_ID` | OAuth app client ID | Entra ID -> App Registration -> Overview |
| `MICROSOFT_CLIENT_SECRET` | OAuth app client secret | Entra ID -> App Registration -> Certificates & secrets |
| `RESEND_API_KEY` | Transactional email API key | Resend dashboard |
| `CONVEX_SYNC_ADMIN_KEY` | Convex admin key | Convex dashboard |
| `VAPID_PRIVATE_KEY` | Push notification private key | `npx web-push generate-vapid-keys` |
| `SWA_DEPLOYMENT_TOKEN` | Static Web App deploy token | `az staticwebapp secrets list --name <name> --query "properties.apiKey" -o tsv` |

### Variables (non-sensitive — you must add these manually)

| Variable | Description | Example (staging) |
| --- | --- | --- |
| `ACR_LOGIN_SERVER` | ACR login server URL | `retrotoolstagingacr.azurecr.io` |
| `API_WEBAPP_NAME` | App Service name | `retrotool-staging-api` |
| `AZURE_RESOURCE_GROUP` | Resource group name | `retrotool-staging-rg` |
| `CONVEX_SYNC_URL` | Convex deployment URL (self-hosted App Service for staging) | `https://retrotool-staging-convex.azurewebsites.net` |
| `EMAIL_FROM` | Sender address for emails | `Retro-Tool <info@retro-tool.com>` |
| `FRONTEND_URL` | UI URL (for CORS + redirects) | `https://calm-sky-095099503.7.azurestaticapps.net` |
| `MICROSOFT_TENANT_ID` | OAuth tenant (if different from infra tenant) | Same as `AZURE_TENANT_ID` unless multi-tenant |
| `VAPID_PUBLIC_KEY` | Push notification public key | From `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | Push notification contact URL | `https://retrotool-staging-api.azurewebsites.net` |

#### UI-only variables (used by `deploy-ui.yml`)

| Variable | Description | Example (staging) |
| --- | --- | --- |
| `VITE_API_URL` | API base URL for the frontend | `https://retrotool-staging-api.azurewebsites.net` |
| `VITE_APP_ENV` | Environment label | `staging` |
| `VITE_APP_TITLE` | Browser tab title | `Retro Tool (Staging)` |
| `VITE_CONVEX_URL` | Convex URL for realtime (self-hosted App Service for staging) | `https://retrotool-staging-convex.azurewebsites.net` |
| `VITE_ESTIMATES_REALTIME_BACKEND` | Realtime backend for estimates | `convex` |
| `VITE_NOTIFICATIONS_REALTIME_BACKEND` | Realtime backend for notifications | `convex` |
| `VITE_RETROS_REALTIME_BACKEND` | Realtime backend for retros | `convex` |

### Automated by the deploy pipeline (do NOT add as GitHub vars)

The `deploy-api.yml` workflow computes and pushes these to App Service automatically on every deploy. Adding them as GitHub environment variables causes conflicts.

| Setting | Value | How it's set |
| --- | --- | --- |
| `PORT` | `8080` | Hardcoded in workflow |
| `NODE_ENV` | `production` | Hardcoded in workflow |
| `ENABLE_CRON_JOBS` | `true` | Hardcoded in workflow |
| `WEEKLY_DIGEST_SEND_HOUR` | `6` | Hardcoded in workflow |
| `BETTER_AUTH_SESSION_EXPIRES_IN` | `604800` | Hardcoded in workflow |
| `ALLOWED_ORIGINS` | `{FRONTEND_URL},{API_URL}` | Computed from `FRONTEND_URL` + `API_WEBAPP_NAME` |
| `BETTER_AUTH_URL` | `https://{API_WEBAPP_NAME}.azurewebsites.net` | Computed from `API_WEBAPP_NAME` |
| `LOCAL_SERVER_URL` | `https://{API_WEBAPP_NAME}.azurewebsites.net` | Computed from `API_WEBAPP_NAME` |
| `DEPLOYED_SERVER_URL` | `https://{API_WEBAPP_NAME}.azurewebsites.net` | Computed from `API_WEBAPP_NAME` |

---

## Post-Provisioning Checklist

### 1. Azure App Registration

Create (or verify) an App Registration in **Entra ID -> App Registrations** with these settings:

| Field | Value |
| --- | --- |
| Name | `Retro-tool-prod` |
| Home page URL | `https://retro-tool.com` |
| Terms of service URL | `https://retro-tool.com/termsofservice` |
| Privacy statement URL | `https://retro-tool.com/privacystatement` |
| Publisher domain | `retro-tool.com` |

**Redirect URIs** (under Authentication -> Web):

```
https://retrotool-prod-api.azurewebsites.net/api/auth/callback/microsoft
https://retrotool-staging-api.azurewebsites.net/api/auth/callback/microsoft
https://retrotool-develop-api.azurewebsites.net/api/auth/callback/microsoft
http://localhost:8000/api/auth/callback/microsoft
```

**Client secret** (under Certificates & secrets):

- Create a new client secret and save as `MICROSOFT_CLIENT_SECRET` in each GitHub environment

**IDs to note**:

- `Application (client) ID` -> use as `AZURE_CLIENT_ID` and `MICROSOFT_CLIENT_ID` in GitHub secrets
- `Directory (tenant) ID` -> use as `AZURE_TENANT_ID` in GitHub secrets

### 2. OIDC Federated Credentials

See [README-oidc.md](README-oidc.md) for the full guide, or run:

```powershell
.\infra\setup-oidc-credentials.ps1
```

### 3. Push First Docker Image

```powershell
az acr login --name retrotool<env>acr
docker build -t retrotool<env>acr.azurecr.io/retro-tool-api:latest ./retro-tool-api
docker push retrotool<env>acr.azurecr.io/retro-tool-api:latest
```

### 4. Run Database Migrations

```powershell
$env:DATABASE_URL = "<databaseUrl-with-real-password>"
pnpm --dir retro-tool-api db:migrate
```

### 5. Seed Templates (first deploy only)

```powershell
$env:DATABASE_URL = "<databaseUrl-with-real-password>"
pnpm --dir retro-tool-api db:seed:templates
```

### 6. Generate VAPID Keys

```powershell
npx web-push generate-vapid-keys
```

Save as `VAPID_PUBLIC_KEY` (variable) and `VAPID_PRIVATE_KEY` (secret) in the GitHub environment.

### 7. Configure Convex JWT auth (required for realtime)

Convex verifies the RS256 JWTs the API issues (`GET /api/auth/token`, keys at
`GET /api/auth/jwks`) before serving any projection query. Convex reads three
variables via `process.env` **inside its functions** (`convex/auth.config.ts`),
so they must be set **on the Convex deployment** — they are NOT read from the
API's App Service settings or any `.env` file.

Set them once per Convex deployment (CLI with `CONVEX_DEPLOY_KEY` set, or
dashboard → Deployment Settings → Environment Variables):

```powershell
# Values shown for production; use the matching API host per environment.
convex env set JWT_ISSUER   https://retrotool-prod-api.azurewebsites.net
convex env set JWT_AUDIENCE convex
convex env set JWT_JWKS_URL https://retrotool-prod-api.azurewebsites.net/api/auth/jwks
convex env list   # verify
```

| Variable | Must equal | Notes |
| --- | --- | --- |
| `JWT_ISSUER` | the API's `BETTER_AUTH_URL` (`https://{API_WEBAPP_NAME}.azurewebsites.net`, computed by `deploy-api.yml`) | **Byte-for-byte** identity match against the token `iss`. A trailing-slash / scheme / port mismatch silently breaks all Convex auth. Not fetched over the network. |
| `JWT_AUDIENCE` | the API's `BETTER_AUTH_JWT_AUDIENCE` (default `convex`) | Matched against the token `aud`. |
| `JWT_JWKS_URL` | `${JWT_ISSUER}/api/auth/jwks` | **Fetched** by Convex Cloud over the public internet, so the API host must be publicly reachable. |

> The API side needs no extra config: `BETTER_AUTH_JWT_ISSUER` defaults to
> `BETTER_AUTH_URL` and `BETTER_AUTH_JWT_AUDIENCE` defaults to `convex`. Only set
> those overrides if you change the values here.
>
> **Staging (self-hosted Convex):** the `deploy-convex.yml` workflow sets
> `JWT_ISSUER` / `JWT_AUDIENCE` / `JWT_JWKS_URL` on the self-hosted deployment
> automatically on every run, so this manual step is only needed for any Convex
> deployment provisioned outside that workflow.
>
> **Verify:** open the app signed-in and confirm a board/notifications load with
> no `Unauthenticated` errors in the Convex logs. If every query throws
> `Unauthenticated`, re-check `JWT_ISSUER` against a decoded token's `iss`.

### 8. Custom Domain (optional)

```powershell
# App Service
az webapp config hostname add --resource-group retrotool-prod-rg `
  --webapp-name retrotool-prod-api --hostname api.yourdomain.com

# Static Web App
az staticwebapp hostname set --name retrotool-prod-ui --hostname app.yourdomain.com
```

> If you set a custom API domain, update the Convex `JWT_ISSUER` / `JWT_JWKS_URL`
> (step 7) and the API's `BETTER_AUTH_URL` to the new host — the issuer must keep
> matching the token `iss` byte-for-byte.

---

## Resources Created (per environment)

Core stack (`deploy.bicep` → `main.bicep`):

- **Container Registry** — Standard, admin disabled
- **User-Assigned Managed Identity** — with AcrPull role on ACR
- **PostgreSQL Flexible Server** — Burstable B1ms, 32 GiB, PostgreSQL 17 (database `retro_tool_db`, `AllowAzureServices` firewall rule)
- **App Service Plan** — P0v3 (PremiumV3), Linux
- **App Service (Container)** — WebSockets, HTTPS-only, Always On, min TLS 1.2, FTPS disabled
- **Static Web App** — Standard (West Europe)

---

## Self-hosted Convex (staging)

Staging additionally runs a **self-hosted Convex backend on Azure App Service**
(the open-source Convex binary in a container). Self-hosting is scoped to
**staging only** (plus local Docker for development) — this plan deliberately
provisions no other Azure Convex deployment. This stack is defined by
`convex-staging.bicep` + the `modules/` files and deploys **into the existing
`retrotool-staging-rg`**, reusing the staging ACR and PostgreSQL server.

> Full design: [docs/deployment/convex-azure-self-hosting-plan.md](../docs/deployment/convex-azure-self-hosting-plan.md).
> Step-by-step runbook (one-time bootstrap + rollback): [docs/deployment/convex-staging-runbook.md](../docs/deployment/convex-staging-runbook.md).

### Resources created

- **Web App for Containers** (`retrotool-staging-convex`) — Linux container running the Convex backend on `WEBSITES_PORT=3210`, HTTPS-only, WebSockets on, `/version` health check, **exactly one worker**. Runs on the API's existing App Service plan (`retrotool-staging-plan`, B1 Basic) rather than a dedicated plan — both are the same tier, so sharing costs nothing extra (`existingPlanResourceId` param in `modules/convex-app-service.bicep`; pass empty to provision a dedicated plan instead). Convex secrets (`INSTANCE_SECRET`, `POSTGRES_URL`) are injected as `@Microsoft.KeyVault(...)` references resolved by the runtime managed identity.
- **User-Assigned Managed Identity** (`retrotool-staging-convex-identity`) — holds AcrPull on the ACR and Key Vault Secrets User on the vault.
- **Storage account + Azure Files share** (`convex-data`) — mounted at `/convex/data` for durable Convex state (survives restarts, image swaps, plan resizes).
- **Key Vault** (`retrotool-staging-cvx-<hash>`) — stores the Convex instance secret and Postgres URL; RBAC-authorized, soft-delete on.
- **Convex PostgreSQL database** (`retrotool_convex_staging`) — a separate database on the existing staging Flexible Server, with its own dedicated role scoped to that database only (never `retro_tool_db`).
- **Log Analytics workspace** (`retrotool-staging-convex-logs`) — App Service diagnostic logs/metrics, PerGB2018, 30-day retention.

### Design constraints

- **Single instance only.** The open-source Convex backend is single-instance, so there is **no scale-out, autoscale, or deployment slots** — the plan is pinned to one worker and the deploy workflow refuses to proceed if it finds more than one.
- **No VNet / private endpoints on day one.** The Web App, Storage, and Key Vault are public + TLS-protected; VNet integration and private endpoints are deferred as future work.
- **Image is digest-pinned.** The backend image must be referenced by `@sha256:` digest (enforced by the deploy workflow and the `convex-backend/compatibility.json` manifest).

### Deploy

Deployed by the **Deploy Convex (App Service)** workflow
(`.github/workflows/deploy-convex.yml`), which is called by
`release-staging.yml` and can also be run via **workflow_dispatch**. It performs
a stop-first upgrade (export → pause outbox → stop → deploy → start → verify
`/version` → set Convex `JWT_*` env → `convex deploy` → resume + reconcile).

To deploy manually with the CLI (after the one-time bootstrap in the runbook):

```powershell
az deployment group create --resource-group retrotool-staging-rg `
  --template-file infra/convex-staging.bicep `
  --parameters `
    environment=staging `
    convexImage='retrotoolstagingacr.azurecr.io/convex-backend@sha256:<digest>' `
    convexInstanceSecret='<high-entropy-secret>' `
    convexPostgresUrl='<dedicated-convex-role-url>'
```

> `convexImage`, `convexInstanceSecret`, and `convexPostgresUrl` are required (no
> defaults). The pinned image must first be mirrored into ACR and the dedicated
> Convex Postgres role created — see the runbook for both one-time steps.

---

## Troubleshooting

| Issue | Fix |
| ----- | --- |
| `ResourceGroupNotFound` | Use `az deployment sub create` not `group create` |
| ACR push 401 | Run `az acr login --name <acrName>` first |
| App Service 504 Gateway Timeout | Check that `WEBSITES_PORT` is NOT set on the App Service — the workflow sets `PORT=8080` and Azure auto-detects |
| App Service "Application Error" | `az webapp log tail --name <name> --resource-group <rg>` |
| Bicep syntax errors | `az bicep build --file infra/main.bicep` |
| PostgreSQL connection refused | Confirm firewall rule + `?sslmode=require` in URL |
| OAuth callback fails | Check redirect URI matches exactly in App Registration |
| Static Web App 404 | Ensure `staticwebapp.config.json` has `navigationFallback` set |
| ACR pull fails (503) | Verify Bicep was deployed: `az webapp config show --name <name> --query acrUseManagedIdentityCreds` must be `true` |
| `convex / deploy` fails at "Deploy staging Convex infrastructure" with `InvalidTemplateDeployment … does not have permission to perform action 'Microsoft.Authorization/roleAssignments/write'` | The CI OIDC principal has only Contributor, which cannot write the role assignments `convex-staging.bicep` declares (re-asserted every run, even when unchanged). Grant it **Role Based Access Control Administrator** on `retrotool-staging-rg`: `az role assignment create --assignee-object-id <sp-object-id> --assignee-principal-type ServicePrincipal --role "Role Based Access Control Administrator" --scope /subscriptions/<sub>/resourceGroups/retrotool-staging-rg`. Object id is in the error message, or `az ad sp show --id <AZURE_CLIENT_ID> --query id -o tsv`. |
| `convex / validate` fails at "Validate Bicep" with `azure/login … Not all values are present. Ensure 'client-id' and 'tenant-id' are supplied` | The validate job runs only `az bicep build` (a **local** compile that needs no Azure auth). Do **not** add `azure/login` to it — the OIDC creds live only in the `staging` environment, which validate intentionally does not use. Install the CLI standalone with `az bicep install` instead. |
