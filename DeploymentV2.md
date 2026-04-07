# Deployment V2 From Scratch (Azure)

Date: 2026-04-07

This guide is a full from-scratch deployment runbook for this repository using GitHub Actions, Azure OIDC, Bicep infrastructure, App Service for API, Azure Static Web Apps for UI, and Azure Container Instance for Convex.

It includes:

1. What to create in Azure and GitHub
2. Every required secret and variable
3. How to generate required values
4. Correct deployment order
5. Post-deploy validation and go-live checklist

---

## 1) Target Architecture

1. API: Azure App Service (Linux, container image from ACR)
2. UI: Azure Static Web App
3. Database: Azure Database for PostgreSQL Flexible Server
4. Convex: Azure Container Instance with Caddy sidecar for HTTPS
5. Registry: Azure Container Registry
6. IaC: Bicep in infra/bicep
7. CI/CD: GitHub Actions workflows

---

## 2) Prerequisites

1. Azure subscription with Owner or equivalent provisioning permissions
2. GitHub repository admin access
3. Azure CLI installed and authenticated
4. OpenSSL available (for secret generation)
5. Node and pnpm (for local validation)

Optional but recommended:

1. Separate staging and production GitHub Environments
2. Required reviewers on production environment

---

## 3) Create Azure OIDC Identity For GitHub Actions

### Step 3.1: Create App Registration and Service Principal

PowerShell:

```powershell
az login
$app = az ad app create --display-name "retro-tool-github-cicd" | ConvertFrom-Json
az ad sp create --id $app.appId
```

### Step 3.2: Add federated credentials for GitHub

Create credentials for:

1. Production environment
2. Staging environment
3. Main branch pushes

PowerShell template:

```powershell
$appId = "<APP_ID>"
$repo = "<ORG>/<REPO>"

$items = @(
  @{ name = "github-production"; subject = "repo:$repo:environment:production" },
  @{ name = "github-staging"; subject = "repo:$repo:environment:staging" },
  @{ name = "github-main-branch"; subject = "repo:$repo:ref:refs/heads/main" }
)

foreach ($i in $items) {
  $json = @{
   name = $i.name
   issuer = "https://token.actions.githubusercontent.com"
   subject = $i.subject
   audiences = @("api://AzureADTokenExchange")
  } | ConvertTo-Json -Compress
  $tmp = New-TemporaryFile
  $json | Set-Content $tmp.FullName
  az ad app federated-credential create --id $appId --parameters "@$($tmp.FullName)"
  Remove-Item $tmp.FullName
}
```

### Step 3.3: Create resource groups

The resource groups are also defined in Bicep (Step 8), but they must exist before role assignments can be scoped to them. Create them now:

```powershell
az group create --name retro-tool-api-rg --location southafricanorth
az group create --name retro-tool-ui-rg  --location westeurope
```

> These match the Bicep defaults (`locationCore=southafricanorth`, `locationSwa=westeurope`). If you are overriding locations, use your values here.

### Step 3.4: Assign RBAC on deployment scope

Grant Contributor on both resource groups used by deployment.

Note: `az ad sp show --id` takes the **appId** (from Step 3.1), not the app object ID. If you see `Resource does not exist`, use the appId.

```powershell
$sub = az account show --query id -o tsv
$spObjectId = az ad sp show --id "<APP_ID>" --query id -o tsv

az role assignment create --assignee-object-id $spObjectId --assignee-principal-type ServicePrincipal --role Contributor --scope "/subscriptions/$sub/resourceGroups/retro-tool-api-rg"
az role assignment create --assignee-object-id $spObjectId --assignee-principal-type ServicePrincipal --role Contributor --scope "/subscriptions/$sub/resourceGroups/retro-tool-ui-rg"
```

Save these values for GitHub secrets:

1. AZURE_CLIENT_ID
2. AZURE_TENANT_ID
3. AZURE_SUBSCRIPTION_ID

Collect all three now before moving on:

```powershell
# AZURE_CLIENT_ID — the appId from Step 3.1
$appId  # already set above

# AZURE_SUBSCRIPTION_ID
az account show --query id -o tsv

# AZURE_TENANT_ID — easy to miss, not returned by role assignment output
az account show --query tenantId -o tsv
```

---

## 4) Create GitHub Environments

Create:

1. staging
2. production

Then configure secrets and variables for each environment.

---

## 5) Generate Required Secrets

Use these commands once per environment.

```bash
# PostgreSQL admin password → POSTGRES_PASSWORD
openssl rand -base64 32

# Convex instance secret → CONVEX_INSTANCE_SECRET
openssl rand -hex 32

# Better Auth secret → BETTER_AUTH_SECRET
openssl rand -base64 32

# VAPID keys → VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
# Set VAPID_SUBJECT manually: mailto:noreply@yourdomain.com
npx web-push generate-vapid-keys
```

Values you must obtain externally:

1. RESEND_API_KEY from Resend
2. GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Google Cloud
3. MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET from Entra App Registration
4. DATABASE_URL for Azure PostgreSQL
5. SWA_DEPLOYMENT_TOKEN from Azure Static Web App
6. CONVEX_SYNC_ADMIN_KEY generated from running Convex container

---

## 6) Required GitHub Environment Secrets

Set these in each environment.

### 6.1 Core Azure auth (all workflows)

1. AZURE_CLIENT_ID
2. AZURE_TENANT_ID
3. AZURE_SUBSCRIPTION_ID

### 6.2 Infrastructure workflow secrets

1. POSTGRES_PASSWORD
2. CONVEX_INSTANCE_SECRET
3. CADDY_CERT_STORAGE_ACCOUNT_KEY (required only when certificate persistence enabled)

### 6.3 API workflow secrets

1. DATABASE_URL
2. BETTER_AUTH_SECRET
3. GOOGLE_CLIENT_ID
4. GOOGLE_CLIENT_SECRET
5. MICROSOFT_CLIENT_ID
6. MICROSOFT_CLIENT_SECRET
7. RESEND_API_KEY
8. CONVEX_SYNC_ADMIN_KEY
9. VAPID_PUBLIC_KEY
10. VAPID_PRIVATE_KEY
11. VAPID_SUBJECT

### 6.4 UI workflow secrets

1. SWA_DEPLOYMENT_TOKEN

---

## 7) Required GitHub Environment Variables

Set these in each environment. Values marked `← from output` are only available after Step 8.1 (Deploy Infrastructure) completes.

### 7.1 Infra workflow variables

| Variable | Production value | Notes |
| --- | --- | --- |
| `AZURE_RESOURCE_GROUP_API` | `retro-tool-api-rg` | Created in Step 3.3 |
| `AZURE_RESOURCE_GROUP_UI` | `retro-tool-ui-rg` | Created in Step 3.3 |
| `AZURE_DEPLOYMENT_LOCATION` | `southafricanorth` | Subscription-level deployment location |
| `AZURE_LOCATION_CORE` | `southafricanorth` | Region for API, DB, Convex, ACR |
| `AZURE_LOCATION_SWA` | `westeurope` | Region for Static Web App |
| `CONVEX_ACI_IP` | `← from output` | Set after first infra deploy; used for PostgreSQL firewall rule |
| `CADDY_ACME_EMAIL` | `your@email.com` | Let's Encrypt registration email |
| `CADDY_PERSIST_CERTIFICATES` | `true` | Set after running Step 8.0 script |
| `CADDY_CERT_STORAGE_ACCOUNT_NAME` | `← from Step 8.0 script` | |
| `CADDY_CERT_STORAGE_SHARE_NAME` | `← from Step 8.0 script` | |

> **Set 7.1 variables (except `CONVEX_ACI_IP`) before running Deploy Infrastructure.**
> `CONVEX_ACI_IP` is only known after first deploy — leave empty on first run, then update and re-run.

### 7.2 API workflow variables

| Variable | Production value | Notes |
| --- | --- | --- |
| `AZURE_RESOURCE_GROUP_API` | `retro-tool-api-rg` | Same as 7.1 |
| `ACR_NAME` | `← from output` | e.g. `retrotoolproductionacr` |
| `ACR_LOGIN_SERVER` | `← from output` | e.g. `retrotoolproductionacr.azurecr.io` |
| `API_WEBAPP_NAME` | `← from output` | e.g. `retro-tool-production-api` |
| `SWA_URL` | `← from output` | e.g. `https://victorious-coast-xxx.azurestaticapps.net` |
| `CONVEX_SYNC_URL` | `← from output` | e.g. `https://convex-api.yourdomain.com` |
| `MICROSOFT_TENANT_ID` | `common` | Or your tenant ID for single-tenant |
| `EMAIL_FROM` | `Retro Tool <noreply@yourdomain.com>` | Must be verified domain in Resend for production |

### 7.3 UI workflow variables

| Variable | Production value | Notes |
| --- | --- | --- |
| `API_URL` | `← from output` | e.g. `https://retro-tool-production-api.azurewebsites.net` |
| `VITE_CONVEX_URL` | `← from output` | Same as `CONVEX_SYNC_URL` |
| `ESTIMATES_REALTIME_BACKEND` | `convex` | |
| `RETROS_REALTIME_BACKEND` | `convex` | |
| `NOTIFICATIONS_REALTIME_BACKEND` | `convex` | |

---

## 8) Deploy Infrastructure First

### 8.0 (Recommended) Enable Caddy certificate persistence before first production deploy

This project supports cert persistence for the Caddy sidecar in ACI via Azure File Share mount. Without it, every ACI restart requests a new TLS certificate from Let's Encrypt — frequent restarts can hit rate limits.

Run the setup script:

```powershell
pwsh scripts/setup-caddy-cert-storage.ps1 `
  -ResourceGroup retro-tool-api-rg `
  -Location southafricanorth `
  -StorageAccountName retrotoolcaddycerts `
  -ShareName caddy-certs `
  -Environment production
```

To preview without making changes:

```powershell
pwsh scripts/setup-caddy-cert-storage.ps1 -DryRun
```

The script will:

1. Create the storage account
2. Create the file share
3. Retrieve the storage key
4. Print the exact GitHub Environment entries to set

Set these GitHub Environment entries before running Deploy Infrastructure:

1. Variable `CADDY_PERSIST_CERTIFICATES=true`
2. Variable `CADDY_CERT_STORAGE_ACCOUNT_NAME=<printed by script>`
3. Variable `CADDY_CERT_STORAGE_SHARE_NAME=<printed by script>`
4. Secret `CADDY_CERT_STORAGE_ACCOUNT_KEY=<printed by script>`

### 8.1 Run Deploy Infrastructure workflow

Run workflow:

1. Actions -> Deploy Infrastructure
2. Select environment (staging first, then production)

This workflow performs:

1. Bicep validation
2. Subscription-level what-if
3. Subscription-level deployment

After completion, capture outputs from workflow summary:

1. acrLoginServer
2. apiUrl
3. swaDefaultHostname
4. swaDeploymentToken
5. convexSyncUrl

Update environment values if missing:

1. ACR_LOGIN_SERVER <- acrLoginServer
2. API_URL and SWA_URL <- apiUrl and swaDefaultHostname where appropriate
3. CONVEX_SYNC_URL and VITE_CONVEX_URL <- convexSyncUrl
4. SWA_DEPLOYMENT_TOKEN <- swaDeploymentToken

---

## 9) Generate Convex Admin Key For API Secret

After Convex container is running in Azure, generate key and store as CONVEX_SYNC_ADMIN_KEY secret.

Example command:

```bash
az container exec \
  --resource-group <AZURE_RESOURCE_GROUP_API> \
  --name <retro-tool-ENV-convex> \
  --exec-command "/bin/sh -c ./generate_admin_key.sh"
```

Copy produced key and save it into GitHub Environment secret:

1. CONVEX_SYNC_ADMIN_KEY

Important:

1. Do not use local development key for production
2. Regenerate if Convex container is rebuilt or instance secret changes

---

## 10) Deploy API

Run workflow:

1. Actions -> Deploy API
2. Select environment

What it does:

1. Validate API package
2. Build and push image to ACR
3. Run ensure-convex-database then DB migration in one-off ACI job
4. Configure App Service settings and secrets
5. Deploy new container image
6. Health check endpoint

Pass criteria:

1. Workflow succeeds
2. API health endpoint returns 200

---

## 11) Deploy UI

Run workflow:

1. Actions -> Deploy UI
2. Select environment

What it does:

1. Validate UI package
2. Build UI with VITE variables from environment
3. Upload built assets to SWA

Pass criteria:

1. Workflow succeeds
2. UI loads and can call API

---

## 12) Post-Deploy Verification

Run this smoke set in staging, then production.

1. Sign in and session persistence
2. Create org and team
3. Create and run retro flow
4. Create and run estimate flow
5. Notification creation and read state sync
6. Convex projection writes have no status 401 warnings
7. Email flow test:
  - If sandbox mode: confirm EMAIL_SANDBOX_TO receives messages
  - If production mode: confirm real recipients receive messages

---

## 13) Email Modes

### Staging sandbox mode

Recommended staging values:

1. EMAIL_FROM=Acme <onboarding@resend.dev>
2. EMAIL_SANDBOX_TO=delivered@resend.dev

### Production mode

Required production values:

1. Verify domain in Resend
2. EMAIL_FROM=Retro Tool <noreply@verified-domain>
3. Remove or leave empty EMAIL_SANDBOX_TO

---

## 14) Go-Live Checklist

All must be true before release:

1. Infra, API, UI workflows all green in target environment
2. CONVEX_SYNC_ADMIN_KEY confirmed valid in production
3. No Convex projection 401 warnings under normal usage window
4. Email mode intentionally set (sandbox for UAT, real for prod)
5. Last known-good API image tag recorded
6. Rollback owner and rollback steps confirmed

---

## 15) Common Failure Recovery

### Convex projection 401 appears again

1. Regenerate Convex admin key from running Convex container
2. Update GitHub secret CONVEX_SYNC_ADMIN_KEY
3. Re-run Deploy API workflow

### API migration fails

1. Check ACI migration job logs from Deploy API workflow
2. Validate DATABASE_URL secret
3. Re-run Deploy API after correcting secret

### UI points to wrong API or Convex URL

1. Update API_URL, VITE_CONVEX_URL, CONVEX_SYNC_URL variables
2. Re-run Deploy UI workflow

---

## 16) Recommended First Release Sequence

1. Complete staging end-to-end using this document
2. Run same flow in production
3. Keep active monitoring for first 60 minutes
4. If errors exceed threshold, rollback immediately
