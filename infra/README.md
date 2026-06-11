# Retro Tool — Azure Infrastructure (Bicep)

Provisions all Azure resources for Retro Tool via CLI. Each environment (prod, staging, develop) gets an isolated set of resources.

## Prerequisites

1. **Azure CLI** (v2.20+): `winget install -e --id Microsoft.AzureCLI`
2. **Bicep CLI** (bundled): `az bicep upgrade`
3. **Azure subscription** with permissions to create resources

## File Structure

```
infra/
├── deploy.bicep              # Entry point (subscription scope — creates resource group)
├── main.bicep                # All resources (resource group scope)
├── setup-oidc-credentials.ps1  # OIDC federated credential automation
├── README.md                 # This file
└── README-oidc.md            # OIDC setup guide
```

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
| `CONVEX_SYNC_URL` | Convex deployment URL | `https://neat-cod-843.eu-west-1.convex.cloud` |
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
| `VITE_CONVEX_URL` | Convex URL for realtime | `https://neat-cod-843.eu-west-1.convex.cloud` |
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

### 7. Custom Domain (optional)

```powershell
# App Service
az webapp config hostname add --resource-group retrotool-prod-rg `
  --webapp-name retrotool-prod-api --hostname api.yourdomain.com

# Static Web App
az staticwebapp hostname set --name retrotool-prod-ui --hostname app.yourdomain.com
```

---

## Resources Created (per environment)

- **Container Registry** — Standard, admin disabled
- **User-Assigned Managed Identity** — with AcrPull role on ACR
- **PostgreSQL Flexible Server** — Burstable B1ms, 32 GiB, PostgreSQL 17
- **App Service Plan** — P0v3, Linux
- **App Service (Container)** — WebSockets, HTTPS-only, Always On
- **Static Web App** — Standard (West Europe)

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
