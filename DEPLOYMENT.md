# Retro-Tool — Azure Deployment Guide

Step-by-step instructions to deploy the Retro-Tool application to Azure using GitHub Actions CI/CD.

> **Note:** This guide provides commands for both **Bash** (Linux/macOS/WSL) and **PowerShell** (Windows). Choose the commands that match your shell environment.

## Architecture

| Component | Azure Service | Deploy Method |
|-----------|--------------|---------------|
| **UI** (Vite/React) | Azure Static Web App | GitHub Actions → SWA CLI |
| **API** (NestJS) | Azure App Service (Linux) | GitHub Actions → Docker → ACR → App Service |
| **API Database** | Azure Database for PostgreSQL Flexible Server | `retro_tool_db` database |
| **Convex Backend** | Azure Container Instance | Official `ghcr.io/get-convex/convex-backend` image |
| **Convex Storage** | Same PostgreSQL Flexible Server | Uses server connection (no dedicated database) |
| **Container Registry** | Azure Container Registry | Stores API Docker images |
| **Secrets** | GitHub Environments | Secrets and variables for deployments |

---

## Prerequisites

- Azure subscription with two resource groups:
  - API/Core: `retro-tool-api-rg` in `southafricanorth`
  - UI: `retro-tool-ui-rg` in `westeurope`
- GitHub repository for this project
- Azure CLI installed locally (`az --version`)
- Node.js 22+ and pnpm 9+

---

## Phase 1: Azure OIDC Setup for GitHub Actions

This enables GitHub Actions to authenticate with Azure without storing long-lived credentials.

### Step 1.1 — Create an Azure App Registration

```bash
# Login to Azure
az login

# Create the App Registration
az ad app create --display-name "retro-tool-github-cicd"

# Note the appId from the output — this is your AZURE_CLIENT_ID
```

### Step 1.2 — Create a Service Principal

```bash
# Replace <APP_ID> with the appId from Step 1.1
az ad sp create --id <APP_ID>
```

### Step 1.3 — Add Federated Credential for GitHub

Replace `<APP_ID>` with the appId from Step 1.1 and `<GITHUB_ORG>/<GITHUB_REPO>` with your GitHub repo (e.g., `kevin-gatimu/retro-tool-v2`).

> **PowerShell Note:** PowerShell has JSON parsing issues with inline strings. The recommended approach below uses `ConvertTo-Json` with temporary files to avoid these issues entirely.

**Bash:**
```bash
# For the "production" environment
az ad app federated-credential create --id <APP_ID> --parameters '{
  "name": "github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<GITHUB_ORG>/<GITHUB_REPO>:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'

# For the "staging" environment (optional)
az ad app federated-credential create --id <APP_ID> --parameters '{
  "name": "github-staging",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<GITHUB_ORG>/<GITHUB_REPO>:environment:staging",
  "audiences": ["api://AzureADTokenExchange"]
}'

# For main branch pushes (needed for auto-deploy workflows)
az ad app federated-credential create --id <APP_ID> --parameters '{
  "name": "github-main-branch",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<GITHUB_ORG>/<GITHUB_REPO>:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

**PowerShell (Recommended - avoids JSON parsing issues):**
```powershell
$appId = "<APP_ID>"
$repo = "<GITHUB_ORG>/<GITHUB_REPO>"

# Production environment
$json = @{
    name = "github-production"
    issuer = "https://token.actions.githubusercontent.com"
    subject = "repo:$repo:environment:production"
    audiences = @("api://AzureADTokenExchange")
} | ConvertTo-Json -Compress
$tempFile = New-TemporaryFile
$json | Set-Content $tempFile.FullName
az ad app federated-credential create --id $appId --parameters "@$($tempFile.FullName)"
Remove-Item $tempFile.FullName

# Staging environment (optional)
$json = @{
    name = "github-staging"
    issuer = "https://token.actions.githubusercontent.com"
    subject = "repo:$repo:environment:staging"
    audiences = @("api://AzureADTokenExchange")
} | ConvertTo-Json -Compress
$tempFile = New-TemporaryFile
$json | Set-Content $tempFile.FullName
az ad app federated-credential create --id $appId --parameters "@$($tempFile.FullName)"
Remove-Item $tempFile.FullName

# Main branch pushes (needed for auto-deploy workflows)
$json = @{
    name = "github-main-branch"
    issuer = "https://token.actions.githubusercontent.com"
    subject = "repo:$repo:ref:refs/heads/main"
    audiences = @("api://AzureADTokenExchange")
} | ConvertTo-Json -Compress
$tempFile = New-TemporaryFile
$json | Set-Content $tempFile.FullName
az ad app federated-credential create --id $appId --parameters "@$($tempFile.FullName)"
Remove-Item $tempFile.FullName
```

### Step 1.4 — Grant RBAC Roles

**Bash:**
```bash
# Get your subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
RESOURCE_GROUP_API="retro-tool-api-rg"
RESOURCE_GROUP_UI="retro-tool-ui-rg"
SP_OBJECT_ID=$(az ad sp show --id <APP_ID> --query id -o tsv)

# Grant Contributor on the API/Core resource group
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP_API}"

# Grant Contributor on the UI resource group
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP_UI}"
```

**PowerShell:**
```powershell
# Get your subscription ID
$SUBSCRIPTION_ID = az account show --query id -o tsv
$RESOURCE_GROUP_API = "retro-tool-api-rg"
$RESOURCE_GROUP_UI = "retro-tool-ui-rg"
$SP_OBJECT_ID = az ad sp show --id <APP_ID> --query id -o tsv

# Grant Contributor on the API/Core resource group
az role assignment create `
  --assignee-object-id "$SP_OBJECT_ID" `
  --assignee-principal-type ServicePrincipal `
  --role "Contributor" `
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP_API"

# Grant Contributor on the UI resource group
az role assignment create `
  --assignee-object-id "$SP_OBJECT_ID" `
  --assignee-principal-type ServicePrincipal `
  --role "Contributor" `
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP_UI"
```

### Step 1.5 — Note Your Values

You'll need these for the next step:

| Value | How to Find |
|-------|-------------|
| `AZURE_CLIENT_ID` | `az ad app show --id <APP_ID> --query appId -o tsv` |
| `AZURE_TENANT_ID` | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query id -o tsv` |

---

## Phase 2: Configure GitHub Environments, Secrets & Variables

### Step 2.1 — Create GitHub Environments

Go to **GitHub → Settings → Environments** and create:
- `production`
- `staging` (optional)

### Step 2.2 — Add Secrets (per environment)

Go to **GitHub → Settings → Environments → [production] → Environment secrets**:

| Secret | Value | How to Generate |
|--------|-------|-----------------|
| `AZURE_CLIENT_ID` | From Phase 1.5 | Azure App Registration |
| `AZURE_TENANT_ID` | From Phase 1.5 | Azure CLI |
| `AZURE_SUBSCRIPTION_ID` | From Phase 1.5 | Azure CLI |
| `POSTGRES_PASSWORD` | Strong password | `openssl rand -base64 32` |
| `CONVEX_INSTANCE_SECRET` | 64-char hex | `openssl rand -hex 32` |
| `DATABASE_URL` | PostgreSQL conn string | See Phase 3 outputs |
| `BETTER_AUTH_SECRET` | Random string | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | OAuth client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Google Cloud Console |
| `MICROSOFT_CLIENT_ID` | OAuth client ID | Azure App Registration |
| `MICROSOFT_CLIENT_SECRET` | OAuth client secret | Azure App Registration |
| `RESEND_API_KEY` | Email API key | https://resend.com |
| `REDIS_URL` | Redis connection string | Leave empty if not using |
| `CONVEX_INSTANCE_SECRET` | 64-char hex — Bicep param only | `openssl rand -hex 32` |
| `CONVEX_SYNC_ADMIN_KEY` | Convex admin key — used by API and deploy workflow | See Phase 4.4 |
| `VAPID_PUBLIC_KEY` | VAPID key | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | VAPID key | `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:you@domain.com` | Your email |
| `SWA_DEPLOYMENT_TOKEN` | SWA token | From Phase 3 outputs |

### Step 2.3 — Add Variables (per environment)

Go to **GitHub → Settings → Environments → [production] → Environment variables**:

| Variable | Example Value |
|----------|---------------|
| `AZURE_RESOURCE_GROUP_API` | `retro-tool-api-rg` |
| `AZURE_RESOURCE_GROUP_UI` | `retro-tool-ui-rg` |
| `AZURE_DEPLOYMENT_LOCATION` | `southafricanorth` |
| `AZURE_LOCATION_CORE` | `southafricanorth` |
| `AZURE_LOCATION_SWA` | `westeurope` |
| `ACR_NAME` | `retrotoolproductionacr` |
| `ACR_LOGIN_SERVER` | `retrotoolproductionacr.azurecr.io` |
| `API_WEBAPP_NAME` | `retro-tool-production-api` |
| `API_URL` | `https://retro-tool-production-api.azurewebsites.net` |
| `SWA_URL` | `https://<hostname>.azurestaticapps.net` |
| `CONVEX_SYNC_URL` | `http://retro-tool-production-convex.southafricanorth.azurecontainer.io:3210` |
| `CONVEX_URL` | Same as `CONVEX_SYNC_URL` (used by deploy-ui.yml as `VITE_CONVEX_URL`) |
| `CONVEX_ACI_IP` | Static public IP of the Convex ACI — `az container show --query "ipAddress.ip"` |
| `ESTIMATES_REALTIME_BACKEND` | `convex` or `socket-io` |
| `RETROS_REALTIME_BACKEND` | `convex` or `socket-io` |
| `NOTIFICATIONS_REALTIME_BACKEND` | `convex` or `socket-io` |
| `MICROSOFT_TENANT_ID` | `common` (or your Azure tenant ID for single-tenant) |
| `EMAIL_FROM` | `Retro Tool <noreply@yourdomain.com>` |
| `BETTER_AUTH_SESSION_EXPIRES_IN` | `604800` (7 days in seconds — optional, has default) |

> **Note:** Some values (ACR_LOGIN_SERVER, SWA_URL, CONVEX_SYNC_URL) won't be known until infrastructure is deployed in Phase 3. Come back and fill them in after.

---

## Phase 3: Deploy Infrastructure (Bicep)

### Step 3.1 — Generate Secrets Locally

```bash
# PostgreSQL admin password
openssl rand -base64 32
# → Save as POSTGRES_PASSWORD in GitHub Secrets

# Convex instance secret
openssl rand -hex 32
# → Save as CONVEX_INSTANCE_SECRET in GitHub Secrets

# Better Auth secret
openssl rand -base64 32
# → Save as BETTER_AUTH_SECRET in GitHub Secrets

# VAPID keys
npx web-push generate-vapid-keys
# → Save public/private keys in GitHub Secrets
```

### Step 3.2 — Deploy via GitHub Actions

1. Go to **GitHub → Actions → Deploy Infrastructure**
2. Click **Run workflow**
3. Select environment: `production`
4. Wait for completion

### Step 3.3 — Or Deploy Locally via CLI

**Bash:**
```bash
az group create -n retro-tool-api-rg -l southafricanorth
az group create -n retro-tool-ui-rg -l westeurope

RESOURCE_GROUP_API="retro-tool-api-rg"
RESOURCE_GROUP_UI="retro-tool-ui-rg"
ENVIRONMENT="production"

az deployment sub create \
  --name main \
  --location southafricanorth \
  --template-file infra/bicep/main.bicep \
  --parameters \
    environmentName="$ENVIRONMENT" \
    apiResourceGroupName="$RESOURCE_GROUP_API" \
    uiResourceGroupName="$RESOURCE_GROUP_UI" \
    locationCore="southafricanorth" \
    locationSwa="westeurope" \
    postgresAdminPassword='<YOUR_PASSWORD>' \
    convexInstanceSecret='<YOUR_64_HEX>'
```

**PowerShell:**
```powershell
az group create -n retro-tool-api-rg -l southafricanorth
az group create -n retro-tool-ui-rg -l westeurope

$RESOURCE_GROUP_API = "retro-tool-api-rg"
$RESOURCE_GROUP_UI = "retro-tool-ui-rg"
$ENVIRONMENT = "production"

az deployment sub create `
  --name main `
  --location southafricanorth `
  --template-file infra/bicep/main.bicep `
  --parameters `
    environmentName="$ENVIRONMENT" `
    apiResourceGroupName="$RESOURCE_GROUP_API" `
    uiResourceGroupName="$RESOURCE_GROUP_UI" `
    locationCore="southafricanorth" `
    locationSwa="westeurope" `
    postgresAdminPassword='<YOUR_PASSWORD>' `
    convexInstanceSecret='<YOUR_64_HEX>'
```

### Step 3.4 — Capture Output Values

After deployment completes, run:

**Bash:**
```bash
az deployment sub show \
  --name "main" \
  --query 'properties.outputs' -o json
```

**PowerShell:**
```powershell
az deployment sub show `
  --name "main" `
  --query 'properties.outputs' -o json
```

This gives you all Bicep outputs. Map them to GitHub as follows:

| Bicep Output         | GitHub Setting                                                        | Type     |
|----------------------|-----------------------------------------------------------------------|----------|
| `acrLoginServer`     | Variable `ACR_LOGIN_SERVER`                                           | Variable |
| `acrName`            | Variable `ACR_NAME`                                                   | Variable |
| `apiUrl`             | Variable `API_URL`                                                    | Variable |
| `apiWebAppName`      | Variable `API_WEBAPP_NAME`                                            | Variable |
| `convexSyncUrl`      | Variables `CONVEX_SYNC_URL` and `CONVEX_URL`                          | Variable |
| `convexFqdn`         | Used to construct `CONVEX_SYNC_URL` — informational                   | —        |
| `postgresServerFqdn` | Used to construct `DATABASE_URL` and `CONVEX_POSTGRES_URL` — Step 3.6 | —        |
| `swaDefaultHostname` | Variable `SWA_URL`                                                    | Variable |
| `swaName`            | Used in Step 3.5 to fetch `SWA_DEPLOYMENT_TOKEN`                      | —        |
| `keyVaultName`       | Informational — Key Vault created to store secrets                    | —        |
| `keyVaultUri`        | Informational — Key Vault URI for reference                           | —        |

### Step 3.5 — Get SWA Deployment Token

The SWA deployment token is not included in Bicep outputs (secrets can't be outputs). Use the `swaName` value from Step 3.4 (`retro-tool-production-ui`) and fetch it manually:

**Bash:**
```bash
SWA_NAME=$(az deployment sub show --name main --query 'properties.outputs.swaName.value' -o tsv)

az staticwebapp secrets list \
  --resource-group retro-tool-ui-rg \
  --name "$SWA_NAME" \
  --query 'properties.apiKey' -o tsv
```

**PowerShell:**
```powershell
$SWA_NAME = az deployment sub show --name main --query 'properties.outputs.swaName.value' -o tsv

az staticwebapp secrets list `
  --resource-group retro-tool-ui-rg `
  --name $SWA_NAME `
  --query 'properties.apiKey' -o tsv
```

Save the output value as `SWA_DEPLOYMENT_TOKEN` in GitHub Secrets.

### Step 3.6 — Update GitHub Variables with Output Values

Go back to **Phase 2.3** and fill in the values you got from the Bicep outputs.

Also set `DATABASE_URL` as a GitHub Secret:
```
postgresql://pgadmin:<POSTGRES_PASSWORD>@retro-tool-production-pg.postgres.database.azure.com:5432/retro_tool_db?sslmode=require
```

#### Set CONVEX_ACI_IP (critical — required for PostgreSQL firewall rule)

The Convex Container Instance has a static public IP that must be whitelisted in the PostgreSQL firewall. This is **not automatically set** — you must capture it and set it as a GitHub Variable so future Bicep deployments include the firewall rule.

```bash
# Get the Convex ACI public IP
az container show \
  --resource-group retro-tool-api-rg \
  --name retro-tool-production-convex \
  --query "ipAddress.ip" -o tsv
```

```powershell
# PowerShell
az container show `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-convex `
  --query "ipAddress.ip" -o tsv
```

Save the output as a **GitHub Variable** named `CONVEX_ACI_IP`.

> **Current production value:** `20.87.58.95`
>
> **Why this matters:** Azure Container Instances are NOT covered by the "Allow Azure Services" PostgreSQL firewall rule. Without this, the Convex container cannot connect to PostgreSQL and will crash-loop with 200+ restarts.

If the Convex container was already deployed but crashing, add the firewall rule manually and then restart:

```bash
az postgres flexible-server firewall-rule create \
  --resource-group retro-tool-api-rg \
  --name retro-tool-production-pg \
  --rule-name AllowConvexACI \
  --start-ip-address 20.87.58.95 \
  --end-ip-address 20.87.58.95

az container restart \
  --resource-group retro-tool-api-rg \
  --name retro-tool-production-convex
```

---

## Phase 4: First Deployment

### Step 4.1 — Deploy API

1. Go to **GitHub → Actions → Deploy API**
2. Click **Run workflow** → environment: `production`
3. The workflow will:
   - Validate (lint, type-check, test, build)
   - Build Docker image → push to ACR
   - Run database migrations via one-off ACI
   - Deploy image to App Service
   - Health check the `/health` endpoint

### Step 4.2 — Deploy UI

1. Go to **GitHub → Actions → Deploy UI**
2. Click **Run workflow** → environment: `production`
3. The workflow will:
   - Validate (lint, type-check, test)
   - Build Vite app with env vars (API_URL, CONVEX_URL, etc.)
   - Deploy to Azure Static Web App

### Step 4.3 — Deploy Convex

1. Go to **GitHub → Actions → Deploy Convex**
2. Click **Run workflow** → environment: `production`
3. The workflow will:
   - Push Convex functions to the self-hosted backend
   - Restart the Container Instance
   - Health check

> **Note:** The Convex backend container is already running from the Bicep deployment. This workflow deploys _function code_ to it and restarts.

### Step 4.4 — Get Convex Admin Key

The Convex admin key (`CONVEX_SYNC_ADMIN_KEY`) is used for two purposes:

- **API runtime** — the NestJS API calls Convex using this key
- **CI/CD deploy** — `deploy-convex.yml` deploys Convex functions using this key as `CONVEX_SELF_HOSTED_ADMIN_KEY`

You only need **one secret**: `CONVEX_SYNC_ADMIN_KEY`.

**Option 1 — Generate locally using Docker (recommended, no running container needed):**

```powershell
docker run --rm `
  -e INSTANCE_NAME=retro-convex-production `
  -e INSTANCE_SECRET=<your CONVEX_INSTANCE_SECRET> `
  --entrypoint="" `
  ghcr.io/get-convex/convex-backend:latest `
  ./generate_admin_key.sh
```

**Option 2 — From container logs (if container is running):**

```powershell
az container logs `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-convex
```

**Option 3 — Via HTTP API (if container is running but logs are empty):**

```powershell
Invoke-RestMethod -Method POST `
  -Uri "http://retro-tool-production-convex.southafricanorth.azurecontainer.io:3210/instance/generate_admin_key" `
  -ContentType "application/json" `
  -Body '{"instanceName":"retro-convex-production","instanceSecret":"<CONVEX_INSTANCE_SECRET>"}'
```

**Option 4 — Exec into the running ACI container (if Docker is not available locally):**

```powershell
az container exec `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-convex `
  --container-name convex-backend `
  --exec-command "./generate_admin_key.sh"
```

> This runs the key generation script directly inside the already-running container — no Docker Desktop needed.

The output will be in the format `retro-convex-production|<hex>`. Save it as **`CONVEX_SYNC_ADMIN_KEY`** in GitHub Secrets.

---

## Phase 5: Verify End-to-End

### Checklist

- [ ] **UI loads**: Visit `https://<SWA-hostname>.azurestaticapps.net`
- [ ] **API responds**: 
  - Bash: `curl https://retro-tool-production-api.azurewebsites.net/health`
  - PowerShell: `Invoke-WebRequest https://retro-tool-production-api.azurewebsites.net/health`
- [ ] **Login works**: Try Google/Microsoft OAuth
- [ ] **Create retro**: Verify it persists in PostgreSQL
- [ ] **Real-time sync**: Open in two tabs, confirm live updates via Convex
- [ ] **Email works**: Trigger a notification (if Resend is configured)

---

## Automatic Deployments (CI/CD)

Once the initial setup is complete, deployments happen automatically:

| Trigger | Workflow |
|---------|----------|
| Push to `main` with changes in `retro-tool-api/` | Deploy API → App Service |
| Push to `main` with changes in `retro-tool-ui/` | Deploy UI → Static Web App |
| Push to `main` with changes in `convex-backend/` | Deploy Convex → Container Instance |
| Manual dispatch | Any workflow can be triggered manually |

The CI workflow (`ci.yml`) runs on all PRs for lint, type-check, test, and build validation.

---

## File Reference

### Infrastructure (Bicep)

| File | Purpose |
|------|---------|
| `infra/bicep/main.bicep` | Main orchestrator — deploys all modules |
| `infra/bicep/modules/postgresql-flexible-server.bicep` | PostgreSQL with `api_db` + `convex_db` |
| `infra/bicep/modules/container-registry.bicep` | ACR for Docker images |
| `infra/bicep/modules/app-service.bicep` | App Service Plan + Web App for API |
| `infra/bicep/modules/container-instance.bicep` | ACI for Convex backend |
| `infra/bicep/modules/static-web-app.bicep` | Azure Static Web App for UI |

### GitHub Workflows

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | PR validation (lint, test, build) |
| `.github/workflows/deploy-infra.yml` | Deploy Azure infrastructure |
| `.github/workflows/deploy-api.yml` | Build & deploy API to App Service |
| `.github/workflows/deploy-ui.yml` | Build & deploy UI to Static Web App |
| `.github/workflows/deploy-convex.yml` | Deploy Convex functions to ACI |

### Environment Config

| File | Purpose |
|------|---------|
| `.env.production.example` | Documents all required env vars |

---

## Convex Variables Reference

There are three distinct contexts where Convex variables appear. Understanding the difference prevents confusion.

### 1. Bicep / Infrastructure (never set manually)

These are passed directly to the container by Bicep. You only need them as GitHub Secrets to feed into `deploy-infra.yml`.

| Variable | Where used | Source |
| --- | --- | --- |
| `INSTANCE_NAME` | Convex container env | Bicep param — defaults to `retro-convex-production` |
| `INSTANCE_SECRET` | Convex container env | GitHub Secret `CONVEX_INSTANCE_SECRET` → Bicep |
| `POSTGRES_URL` | Convex container env | Bicep constructs from `postgresServerFqdn` automatically |
| `DISABLE_BEACON` | Convex container env | Hardcoded `1` in `container-instance.bicep` |

### 2. Runtime (GitHub Secrets & Variables — set once after first deploy)

| Variable | Type | Used by | Value |
| --- | --- | --- | --- |
| `CONVEX_SYNC_URL` | GitHub Variable | API app settings, `deploy-convex.yml`, `deploy-ui.yml` | `http://retro-tool-production-convex.southafricanorth.azurecontainer.io:3210` |
| `CONVEX_URL` | GitHub Variable | `deploy-ui.yml` → `VITE_CONVEX_URL` build arg | Same as `CONVEX_SYNC_URL` |
| `CONVEX_SYNC_ADMIN_KEY` | GitHub Secret | API app settings + `deploy-convex.yml` | Format: `retro-convex-production` + pipe + hex — see Step 4.4 |
| `CONVEX_ACI_IP` | GitHub Variable | Bicep → PostgreSQL firewall rule | `az container show --query "ipAddress.ip" -o tsv` |

### 3. Local development only (docker/.env — never in GitHub)

These are only needed when running `npx convex dev` locally against the local Docker container.

| Variable | Value | Purpose |
| --- | --- | --- |
| `CONVEX_INSTANCE_NAME` | `convex-local` | Local container instance name |
| `CONVEX_INSTANCE_SECRET` | 64-char hex | Local container auth |
| `CONVEX_POSTGRES_URL` | `postgresql://postgres:postgres@postgres:5432` | Local container DB connection |
| `CONVEX_DO_NOT_REQUIRE_SSL` | `1` | Disable SSL for local postgres |
| `CONVEX_SYNC_URL` | `http://convex-backend:3210` | API → Convex (internal Docker network) |
| `CONVEX_SYNC_ADMIN_KEY` | `convex-local` + pipe + hex | API auth with local Convex |
| `CONVEX_SELF_HOSTED_URL` | `http://127.0.0.1:3210` | CLI (`npx convex dev`) on host machine |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | same value as `CONVEX_SYNC_ADMIN_KEY` | CLI auth for `npx convex dev` |
| `CONVEX_API_PORT` | `3210` | Docker port mapping |
| `CONVEX_SITE_PORT` | `3211` | Docker port mapping |
| `CONVEX_DASHBOARD_PORT` | `6791` | Docker port mapping |

> **How `deploy-convex.yml` uses these:** The workflow maps `CONVEX_SYNC_URL` → `CONVEX_SELF_HOSTED_URL` and `CONVEX_SYNC_ADMIN_KEY` → `CONVEX_SELF_HOSTED_ADMIN_KEY` inline. You do not need separate GitHub Secrets for the `CONVEX_SELF_HOSTED_*` names.

---

## Convex Backend: Azure Deployment Guide

This section covers every detail needed to deploy and operate the self-hosted Convex backend on Azure Container Instances, including how it stores data, network requirements, admin key generation, and health verification.

### How It Works

Convex runs as a single Docker container (`ghcr.io/get-convex/convex-backend`) inside an Azure Container Instance (ACI). It uses your existing Azure PostgreSQL Flexible Server as its storage backend — it does **not** need a separate database service.

```text
GitHub Actions
     │
     ▼
ACI (convex-backend container)
  INSTANCE_NAME=retro-convex-production
  INSTANCE_SECRET=<64-char hex>
  POSTGRES_URL=postgresql://pgadmin:<pass>@<pg-fqdn>:5432?sslmode=require
     │
     ▼
Azure PostgreSQL Flexible Server
  database: retro_convex_production   ← Convex manages this
  database: retro_tool_db             ← NestJS API uses this
```

### Database Naming Convention

Convex derives its PostgreSQL database name from `INSTANCE_NAME` by replacing hyphens with underscores:

| `INSTANCE_NAME` | PostgreSQL database |
| --- | --- |
| `retro-convex-production` | `retro_convex_production` |
| `retro-convex-staging` | `retro_convex_staging` |

**This database must exist before the container starts.** The Bicep (`postgresql-flexible-server.bicep`) automatically creates it using:

```bicep
convexDatabaseName: replace(convexInstanceName, '-', '_')
```

If the database is missing, the container exits with code 1 immediately and produces no logs. Create it manually if needed:

```powershell
az postgres flexible-server db create `
  --resource-group retro-tool-api-rg `
  --server-name retro-tool-production-pg `
  --database-name retro_convex_production
```

### Network / Firewall Requirements

Azure Container Instances have a **static public IP** that is **not** covered by the "Allow Azure Services" (`0.0.0.0`) PostgreSQL firewall rule. Without an explicit rule, the container cannot reach PostgreSQL and will crash-loop silently.

**Get the ACI IP:**

```powershell
az container show `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-convex `
  --query "ipAddress.ip" -o tsv
```

**Add the firewall rule:**

```powershell
az postgres flexible-server firewall-rule create `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-pg `
  --rule-name AllowConvexACI `
  --start-ip-address <ACI_IP> `
  --end-ip-address <ACI_IP>
```

**Automate for future Bicep deployments:** Save the IP as a GitHub Variable `CONVEX_ACI_IP`. The Bicep reads it and creates the firewall rule automatically. Current production IP: `20.87.58.95`.

> **Why ACI IPs are static:** ACI assigns a static IP at creation time. The IP does not change on container restarts. It only changes if the container group is deleted and recreated.

### Container Environment Variables

All set by Bicep — you never set these directly in GitHub or `.env` files:

| Variable | Value | Source |
| --- | --- | --- |
| `INSTANCE_NAME` | `retro-convex-production` | Bicep param `convexInstanceName` |
| `INSTANCE_SECRET` | 64-char hex | GitHub Secret `CONVEX_INSTANCE_SECRET` → Bicep |
| `POSTGRES_URL` | `postgresql://pgadmin:<pass>@<fqdn>:5432?sslmode=require` | Bicep constructs automatically |
| `DISABLE_BEACON` | `1` | Hardcoded in `container-instance.bicep` |

### Admin Key

The admin key authenticates both the NestJS API at runtime and the `deploy-convex.yml` CI workflow. You only need **one secret**: `CONVEX_SYNC_ADMIN_KEY`.

The key is deterministically derived from `INSTANCE_NAME` + `INSTANCE_SECRET`. Format: `{INSTANCE_NAME}|{hex}`.

**Option 1 — Docker (recommended, works before container is deployed):**

```powershell
docker run --rm `
  -e INSTANCE_NAME=retro-convex-production `
  -e INSTANCE_SECRET=<CONVEX_INSTANCE_SECRET> `
  --entrypoint="" `
  ghcr.io/get-convex/convex-backend:latest `
  ./generate_admin_key.sh
```

**Option 2 — Exec into the running ACI (no Docker needed):**

```powershell
az container exec `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-convex `
  --container-name convex-backend `
  --exec-command "./generate_admin_key.sh"
```

**Option 3 — HTTP API (container must be running and healthy):**

```powershell
Invoke-RestMethod -Method POST `
  -Uri "http://retro-tool-production-convex.southafricanorth.azurecontainer.io:3210/instance/generate_admin_key" `
  -ContentType "application/json" `
  -Body '{"instanceName":"retro-convex-production","instanceSecret":"<CONVEX_INSTANCE_SECRET>"}'
```

Save the output as `CONVEX_SYNC_ADMIN_KEY` in **GitHub → Settings → Environments → production → Secrets**.

> **Key must match the running instance.** If you regenerate `CONVEX_INSTANCE_SECRET` you must also regenerate `CONVEX_SYNC_ADMIN_KEY`. The two are linked.

### Deploying Function Code

After the container is healthy and `CONVEX_SYNC_ADMIN_KEY` is set:

1. Go to **GitHub → Actions → Deploy Convex**
2. Click **Run workflow** → environment: `production`

The workflow runs `npx convex deploy` with:

```yaml
env:
  CONVEX_SELF_HOSTED_URL: ${{ vars.CONVEX_SYNC_URL }}
  CONVEX_SELF_HOSTED_ADMIN_KEY: ${{ secrets.CONVEX_SYNC_ADMIN_KEY }}
```

This pushes all Convex functions from `convex-backend/convex/` to the running container and restarts it.

### Verifying Health

**Container state:**

```powershell
az container show `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-convex `
  --query "containers[0].instanceView.currentState" -o json
```

Healthy response: `"state": "Running"` with no `exitCode`.

**HTTP check (should return 200):**

```powershell
curl.exe -s -o NUL -w "%{http_code}" `
  http://retro-tool-production-convex.southafricanorth.azurecontainer.io:3210
```

**Live log streaming:**

```powershell
az container attach `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-convex
```

### Full First-Time Setup Checklist

Use this checklist when deploying Convex to a new environment:

- [ ] `CONVEX_INSTANCE_SECRET` GitHub Secret set (64-char hex: `openssl rand -hex 32`)
- [ ] Bicep deployed — creates ACI, PostgreSQL databases (`retro_tool_db` + `retro_convex_production`), and firewall rule
- [ ] `CONVEX_ACI_IP` GitHub Variable set to the ACI public IP
- [ ] Container is in `Running` state (not `CrashLoopBackOff`)
- [ ] HTTP check returns `200`
- [ ] `CONVEX_SYNC_ADMIN_KEY` generated and saved to GitHub Secrets
- [ ] `CONVEX_SYNC_URL` GitHub Variable set to `http://retro-tool-production-convex.southafricanorth.azurecontainer.io:3210`
- [ ] Deploy Convex workflow run successfully

---

## Troubleshooting

### App Service returns 503

**Check logs:**
- Bash: `az webapp log tail --resource-group <RG> --name <WEBAPP>`
- PowerShell: `az webapp log tail --resource-group <RG> --name <WEBAPP>`

**Container config (verify image + port):**
- Bash: `az webapp config container show --resource-group <RG> --name <WEBAPP>`
- PowerShell: `az webapp config container show --resource-group <RG> --name <WEBAPP>`

**Verify runtime app settings:**
- Bash: `az webapp config appsettings list --resource-group <RG> --name <WEBAPP> --query "[?name=='PORT' || name=='WEBSITES_PORT' || name=='NODE_ENV']"`
- PowerShell: `az webapp config appsettings list --resource-group <RG> --name <WEBAPP> --query "[?name=='PORT' || name=='WEBSITES_PORT' || name=='NODE_ENV']"`

**Common cause:** `DATABASE_URL` not set or PostgreSQL firewall blocking

**Fix:** Ensure "Allow Azure Services" firewall rule is enabled on PostgreSQL

### SWA shows blank page

**Check:** Browser console for errors

**Common cause:** `VITE_API_URL` not set during build

**Fix:** Re-run Deploy UI workflow with correct `API_URL` variable

### GitHub Actions OIDC login fails — no configured federated identity credentials

**Error:** `The client has no configured federated identity credentials`

**Cause:** The federated identity credential was never created on the App Registration.

**Fix:** See Phase 1.3 for the full PowerShell commands. Quick version:

```powershell
$json = @{
    name = "github-production"
    issuer = "https://token.actions.githubusercontent.com"
    subject = "repo:<ORG>/<REPO>:environment:production"
    audiences = @("api://AzureADTokenExchange")
} | ConvertTo-Json -Compress
$tmp = New-TemporaryFile
$json | Set-Content $tmp.FullName
az ad app federated-credential create --id <AZURE_CLIENT_ID> --parameters "@$($tmp.FullName)"
Remove-Item $tmp.FullName
```

---

### GitHub Actions OIDC login fails — missing service principal

**Error:** `The client application is missing service principal in the tenant`

**Cause:** The App Registration exists but the Service Principal was never created in the tenant.

**Fix:**

```powershell
az ad sp create --id <AZURE_CLIENT_ID>
```

Then re-run Phase 1.4 to assign Contributor roles to both resource groups.

---

### GitHub Actions OIDC login still fails after creating credentials

**Cause:** The `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` GitHub Secrets point to a different App Registration (e.g. values copied from `docker/.env` which has separate Azure credentials).

**Fix:** Go to **GitHub → Settings → Environments → production → Secrets** and verify all three match the values in `.env.production.example`.

---

### Docker build fails — drizzle folder not found

**Error:** `failed to calculate checksum: "/workspace/retro-tool-api/drizzle": not found`

**Cause:** The `drizzle/` migrations folder was in `.gitignore` and never committed, so it is absent from the CI build context.

**Fix:** Remove `/drizzle` from both `.gitignore` files and commit the folder:

```bash
git add retro-tool-api/drizzle/
git add .gitignore retro-tool-api/.gitignore
git commit -m "fix: track drizzle migrations in git for CI/CD builds"
git push
```

---

### Convex deploy fails — invalid deployment name `convex-local`

**Error:** `InvalidDeploymentName: Couldn't parse deployment name convex-local`

**Cause:** Either `CONVEX_SYNC_ADMIN_KEY` contains the local dev key (`convex-local|...`), or the workflow is using `CONVEX_DEPLOY_KEY` (cloud key) instead of `CONVEX_SELF_HOSTED_ADMIN_KEY` (self-hosted key).

**Fix — correct workflow env vars** (`deploy-convex.yml` must use):

```yaml
env:
  CONVEX_SELF_HOSTED_URL: ${{ vars.CONVEX_SYNC_URL }}
  CONVEX_SELF_HOSTED_ADMIN_KEY: ${{ secrets.CONVEX_SYNC_ADMIN_KEY }}
```

**Fix — correct secret value** — generate the production key and set `CONVEX_SYNC_ADMIN_KEY`:

```powershell
docker run --rm `
  -e INSTANCE_NAME=retro-convex-production `
  -e INSTANCE_SECRET=<CONVEX_INSTANCE_SECRET> `
  --entrypoint="" `
  ghcr.io/get-convex/convex-backend:latest `
  ./generate_admin_key.sh
```

The key must start with `retro-convex-production|` not `convex-local|`.

---

### Convex container keeps restarting (CrashLoopBackOff)

**Diagnose:**

```powershell
az container show `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-convex `
  --query "{state:instanceView.state, restartCount:containers[0].instanceView.restartCount, currentState:containers[0].instanceView.currentState}" `
  -o json
```

If `restartCount` is high and logs return `None`, the container is crashing before writing output.

**Most common cause:** The Convex ACI cannot reach PostgreSQL. Its public IP is not whitelisted in the PostgreSQL firewall. `AllowAzureServices` (0.0.0.0) covers App Service but **not** ACI.

**Fix:**

```powershell
# Get ACI public IP
az container show --resource-group retro-tool-api-rg --name retro-tool-production-convex --query "ipAddress.ip" -o tsv

# Add firewall rule
az postgres flexible-server firewall-rule create `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-pg `
  --rule-name AllowConvexACI `
  --start-ip-address <ACI_IP> `
  --end-ip-address <ACI_IP>

# Restart container
az container restart --resource-group retro-tool-api-rg --name retro-tool-production-convex
```

Also add `CONVEX_ACI_IP` as a GitHub Variable so future Bicep deployments include the rule automatically.

---

### How to get the Convex admin key

After the Convex container is running and healthy:

```powershell
# From container logs
az container logs --resource-group retro-tool-api-rg --name retro-tool-production-convex
```

Or generate via the HTTP API if logs are empty:

```powershell
Invoke-RestMethod -Method POST `
  -Uri "http://retro-tool-production-convex.southafricanorth.azurecontainer.io:3210/instance/generate_admin_key" `
  -ContentType "application/json" `
  -Body '{"instanceName":"retro-convex-production","instanceSecret":"<CONVEX_INSTANCE_SECRET>"}'
```

The key will be in the format `retro-convex-production|<hex>`. Set it as `CONVEX_SYNC_ADMIN_KEY` in GitHub Secrets.

---

### Database migration fails

**Check:** Migration container logs in GitHub Actions

**Common cause:** SSL not configured in DATABASE_URL

**Fix:** Ensure `?sslmode=require` is in the connection string

### ACR image pull fails on App Service

**Check:** App Service logs for "unauthorized" errors

**Common cause:** Managed Identity doesn't have AcrPull role

**Fix:** Re-run Bicep deployment (it assigns AcrPull automatically)

---

## Cost Estimate (Monthly)

| Resource | SKU | Estimated Cost |
|----------|-----|---------------|
| Azure Static Web App | Free | $0 |
| Azure App Service | B2 (Linux) | ~$55 |
| Azure Database for PostgreSQL | Standard_B2s | ~$50 |
| Azure Container Instance (Convex) | 1 CPU, 2 GB | ~$35 |
| Azure Container Registry | Basic | ~$5 |
| **Total** | | **~$145/month** |

> Costs vary by region. Use the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for exact estimates.
