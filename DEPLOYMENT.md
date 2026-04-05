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
| `CONVEX_POSTGRES_URL` | Convex PostgreSQL conn string | See Phase 3.6 |
| `REDIS_URL` | Redis connection string | Leave empty if not using |
| `CONVEX_SYNC_ADMIN_KEY` | Convex admin key | Generated after first deploy |
| `CONVEX_DEPLOY_KEY` | Convex deploy key | Generated after first deploy |
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
| `CONVEX_SYNC_URL` | `http://retro-tool-production-convex.<region>.azurecontainer.io:3210` |
| `CONVEX_URL` | Same as `CONVEX_SYNC_URL` |
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

Also set `DATABASE_URL` as a secret:
```
postgresql://pgadmin:<POSTGRES_PASSWORD>@retro-tool-production-pg.postgres.database.azure.com:5432/retro_tool_db?sslmode=require
```

And set `CONVEX_POSTGRES_URL` as a secret (note: no database name, Convex manages its own tables):
```
postgresql://pgadmin:<POSTGRES_PASSWORD>@retro-tool-production-pg.postgres.database.azure.com:5432?sslmode=require
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

After the Convex Container Instance is running, you need to get the admin key:

**Bash:**
```bash
# Check container logs for the admin key
az container logs \
  --resource-group retro-tool-api-rg \
  --name retro-tool-production-convex
```

**PowerShell:**
```powershell
# Check container logs for the admin key
az container logs `
  --resource-group retro-tool-api-rg `
  --name retro-tool-production-convex
```

Look for a line containing the admin key, then:
1. Save it as `CONVEX_SYNC_ADMIN_KEY` in GitHub Secrets
2. Save it as `CONVEX_DEPLOY_KEY` in GitHub Secrets (or generate a deploy key using the admin key)

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

### Convex container keeps restarting

**Check logs:**
- Bash: `az container logs --resource-group <RG> --name <CONTAINER>`
- PowerShell: `az container logs --resource-group <RG> --name <CONTAINER>`

**Common cause:** Invalid `POSTGRES_URL` or `INSTANCE_SECRET`

**Fix:** Verify PostgreSQL connection string includes `?sslmode=require`

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
