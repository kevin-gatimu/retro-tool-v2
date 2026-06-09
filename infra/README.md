# Retro Tool — Azure Infrastructure (Bicep)

Provisions all Azure resources for Retro Tool via CLI. Each environment (prod, staging, develop) gets an isolated set of resources.

## Prerequisites

1. **Azure CLI** (v2.20+): `winget install -e --id Microsoft.AzureCLI`
2. **Bicep CLI** (bundled): `az bicep upgrade`
3. **Azure subscription** with permissions to create resources

## File Structure

```
infra/
├── deploy.bicep    # Entry point (subscription scope — creates resource group)
├── main.bicep      # All resources (resource group scope)
└── README.md       # This file
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
# Production
az deployment sub what-if --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters environment=prod postgresAdminPassword='<prod-password>'

# Staging
az deployment sub what-if --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters environment=staging postgresAdminPassword='<staging-password>'

# Development
az deployment sub what-if --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters environment=develop postgresAdminPassword='<dev-password>'
```

### View outputs after deployment

```powershell
az deployment sub show --name deploy --location southafricanorth `
  --query "properties.outputs" --output table
```

### Get Static Web App deployment token

```powershell
az staticwebapp secrets list --name <staticWebAppName> --query "properties.apiKey" -o tsv
```

### Destroy an environment

```powershell
az group delete --name retrotool-<env>-rg --yes --no-wait
```

## Environment → Branch Mapping

| Environment | Parameter              | Branch    | Resource Group          |
| ----------- | ---------------------- | --------- | ----------------------- |
| Production  | `environment=prod`     | `main`    | `retrotool-prod-rg`    |
| Staging     | `environment=staging`  | `staging` | `retrotool-staging-rg` |
| Development | `environment=develop`  | `develop` | `retrotool-develop-rg` |

## Deployment Outputs → GitHub Secrets & Variables

After deploying, use the outputs to configure each GitHub environment (`prod`, `staging`, `develop`).

### Secrets (sensitive)

| GitHub Secret                      | Value                                           |
| ---------------------------------- | ----------------------------------------------- |
| `AZURE_CLIENT_ID`                  | App Registration client ID (Entra ID)           |
| `AZURE_TENANT_ID`                  | Entra ID tenant ID                              |
| `AZURE_SUBSCRIPTION_ID`            | Azure subscription ID                           |
| `POSTGRES_ADMIN_PASSWORD`          | Password used during provisioning               |
| `DATABASE_URL`                     | Output `databaseUrl` with real password         |
| `BETTER_AUTH_SECRET`               | Generate: `openssl rand -base64 32`             |
| `AZURE_STATIC_WEB_APPS_API_TOKEN`  | From `az staticwebapp secrets list`             |
| `RESEND_API_KEY`                   | From Resend dashboard                           |
| `CONVEX_SYNC_ADMIN_KEY`            | From Convex dashboard                           |

### Variables (non-sensitive)

| GitHub Variable    | Deployment Output                                              |
| ------------------ | -------------------------------------------------------------- |
| `ACR_LOGIN_SERVER` | `acrLoginServer` (e.g. `retrotoolprodacr.azurecr.io`)         |
| `ACR_NAME`         | `acrName` (e.g. `retrotoolprodacr`)                           |
| `APP_SERVICE_NAME` | `appServiceName` (e.g. `retrotool-prod-api`)                  |
| `RESOURCE_GROUP`   | `resourceGroupName` (e.g. `retrotool-prod-rg`)                |
| `API_URL`          | `apiUrl` (e.g. `https://retrotool-prod-api.azurewebsites.net`) |
| `FRONTEND_URL`     | `uiUrl` (e.g. `https://nice-smoke-0118bc103.azurestaticapps.net`) |
| `CONVEX_SYNC_URL`  | From Convex dashboard                                          |

## Post-Provisioning Checklist

### 1. Microsoft OAuth Redirect URIs

Add these redirect URIs to your Azure App Registration in **Entra ID → App Registrations → Authentication**:

```
https://retrotool-prod-api.azurewebsites.net/api/auth/callback/microsoft
https://retrotool-staging-api.azurewebsites.net/api/auth/callback/microsoft
https://retrotool-develop-api.azurewebsites.net/api/auth/callback/microsoft
```

Also add local development:

```
http://localhost:8000/api/auth/callback/microsoft
```

### 2. Configure App Service Environment Variables

```powershell
az webapp config appsettings set `
  --resource-group retrotool-<env>-rg `
  --name retrotool-<env>-api `
  --settings `
    DATABASE_URL="<databaseUrl-with-real-password>" `
    BETTER_AUTH_SECRET="<openssl rand -base64 32>" `
    BETTER_AUTH_URL="<apiUrl>" `
    FRONTEND_URL="<uiUrl>" `
    REDIS_URL="<redis-connection-string>" `
    CONVEX_SYNC_URL="<convex-url>" `
    CONVEX_SYNC_ADMIN_KEY="<convex-admin-key>" `
    RESEND_API_KEY="<resend-key>" `
    VAPID_PUBLIC_KEY="<vapid-public>" `
    VAPID_PRIVATE_KEY="<vapid-private>"
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

### 6. GitHub Actions OIDC (Federated Credentials)

In your App Registration, add federated credentials for each environment:

| Environment | Subject identifier                                          |
| ----------- | ----------------------------------------------------------- |
| prod        | `repo:kevin-gatimu/retro-tool-v2:environment:prod`          |
| staging     | `repo:kevin-gatimu/retro-tool-v2:environment:staging`       |
| develop     | `repo:kevin-gatimu/retro-tool-v2:environment:develop`       |

Issuer: `https://token.actions.githubusercontent.com`
Audience: `api://AzureADTokenExchange`

### 7. Custom Domain (optional)

```powershell
# App Service
az webapp config hostname add --resource-group retrotool-prod-rg `
  --webapp-name retrotool-prod-api --hostname api.yourdomain.com

# Static Web App
az staticwebapp hostname set --name retrotool-prod-ui --hostname app.yourdomain.com
```

### 8. Generate VAPID Keys (push notifications)

```powershell
npx web-push generate-vapid-keys
```

Save the output as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in App Service settings and GitHub secrets.

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
| App Service "Application Error" | `az webapp log tail --name <name> --resource-group <rg>` |
| Bicep syntax errors | `az bicep build --file infra/main.bicep` |
| PostgreSQL connection refused | Confirm firewall rule + `?sslmode=require` in URL |
| OAuth callback fails | Check redirect URI matches exactly in App Registration |
| Static Web App 404 | Ensure `staticwebapp.config.json` has `navigationFallback` set |
