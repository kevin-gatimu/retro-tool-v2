# Deployment Guide

This guide covers deploying Retro Tool to Azure. There are two environments:

| Environment | Branch | App Service | Static Web App |
|---|---|---|---|
| **Staging** | `staging` | Free F1 | Free |
| **Production** | `main` | Premium V3 P1V3 (temporary fallback) | Standard |

Both environments share a single PostgreSQL Flexible Server (deployed with production infrastructure).

Convex functions are deployed to **Convex Cloud** (not self-hosted).

---

## Prerequisites

- Azure CLI installed (`az` available in your terminal)
- GitHub repository with Actions enabled
- A Convex Cloud account and project per environment
- A Resend account for transactional email
- VAPID keys generated (`npx web-push generate-vapid-keys`)

---

## Region Availability Checks (Before Deploy)

Run these commands before infrastructure deployment to confirm App Service SKU regional availability in your current subscription:

Bash / PowerShell:

```bash
az appservice list-locations --sku P0v4
az appservice list-locations --sku P1v3
```

If your target region is listed but deployment still fails, you likely have a subscription quota issue (for example, PremiumV4 quota set to 0), not a regional availability issue.

---

## Step 1 — Login to Azure CLI and Select Subscription

Run in Bash:

```bash
# Login interactively (opens browser)
az login

# List all subscriptions you have access to
az account list --output table

# Set the subscription you want to deploy to
az account set --subscription "<subscription-name-or-id>"

# Confirm the active subscription
az account show --output table
```

Run in PowerShell:

```powershell
# Login interactively (opens browser)
az login

# List all subscriptions you have access to
az account list --output table

# Set the subscription you want to deploy to
az account set --subscription "<subscription-name-or-id>"

# Confirm the active subscription
az account show --output table
```

If you are using a service account or CI machine without a browser, use device code flow.

Bash:

```bash
az login --use-device-code
```

PowerShell:

```powershell
az login --use-device-code
```

---

## Step 2 — Create Azure App Registration + Service Principal (OIDC + Better Auth)

Bash:

```bash
# Create one app registration shared by GitHub Actions OIDC and Better Auth Microsoft login
az ad app create --display-name "retro-tool"

APP_ID=$(az ad app list --display-name "retro-tool" --query '[0].appId' -o tsv)
az ad sp create --id $APP_ID

SP_OBJECT_ID=$(az ad sp show --id $APP_ID --query id -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

# Grant Contributor at subscription scope
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --role Contributor \
  --scope /subscriptions/$SUBSCRIPTION_ID \
  --assignee-principal-type ServicePrincipal

# Also grant User Access Administrator (needed for ACR role assignments)
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --role "User Access Administrator" \
  --scope /subscriptions/$SUBSCRIPTION_ID \
  --assignee-principal-type ServicePrincipal

echo "Client ID: $APP_ID"
echo "Tenant ID: $TENANT_ID"
echo "Subscription ID: $SUBSCRIPTION_ID"

# Create a client secret for Better Auth Microsoft login (save this value now)
MICROSOFT_CLIENT_SECRET=$(az ad app credential reset --id $APP_ID --append --display-name "better-auth-login" --query password -o tsv)
echo "MICROSOFT_CLIENT_SECRET: $MICROSOFT_CLIENT_SECRET"
```

PowerShell:

```powershell
# Create one app registration shared by GitHub Actions OIDC and Better Auth Microsoft login
az ad app create --display-name "retro-tool"

$APP_ID = az ad app list --display-name "retro-tool" --query '[0].appId' -o tsv
az ad sp create --id $APP_ID

$SP_OBJECT_ID = az ad sp show --id $APP_ID --query id -o tsv
$SUBSCRIPTION_ID = az account show --query id -o tsv
$TENANT_ID = az account show --query tenantId -o tsv

# Grant Contributor at subscription scope
az role assignment create `
  --assignee-object-id $SP_OBJECT_ID `
  --role Contributor `
  --scope /subscriptions/$SUBSCRIPTION_ID `
  --assignee-principal-type ServicePrincipal

# Also grant User Access Administrator (needed for ACR role assignments)
az role assignment create `
  --assignee-object-id $SP_OBJECT_ID `
  --role "User Access Administrator" `
  --scope /subscriptions/$SUBSCRIPTION_ID `
  --assignee-principal-type ServicePrincipal

Write-Host "Client ID: $APP_ID"
Write-Host "Tenant ID: $TENANT_ID"
Write-Host "Subscription ID: $SUBSCRIPTION_ID"

# Create a client secret for Better Auth Microsoft login (save this value now)
$MICROSOFT_CLIENT_SECRET = az ad app credential reset --id $APP_ID --append --display-name "better-auth-login" --query password -o tsv
Write-Host "MICROSOFT_CLIENT_SECRET: $MICROSOFT_CLIENT_SECRET"
```

Add a **federated credential** for each GitHub environment in the Azure Portal:
> App registrations → your app → Certificates & secrets → Federated credentials → Add credential

- **Issuer**: `https://token.actions.githubusercontent.com`
- **Subject**: `repo:<org>/<repo>:environment:production` (repeat for `staging`)

Add a **Web redirect URI** to the same app registration for Better Auth Microsoft callback:

- `https://<api-webapp-name>.azurewebsites.net/api/auth/callback/microsoft`

---

## Step 3 — Configure GitHub Environments

In your GitHub repository go to **Settings → Environments** and create two environments: `staging` and `production`.

### Secrets (both environments)

| Secret | Description |
|---|---|
| `AZURE_CLIENT_ID` | Shared app registration Client ID (used for OIDC and Better Auth Microsoft login) |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `POSTGRES_PASSWORD` | PostgreSQL admin password |
| `DATABASE_URL` | Full PostgreSQL connection string (`postgresql://pgadmin:<password>@<fqdn>:5432/retro_tool_db?sslmode=require`) |
| `BETTER_AUTH_SECRET` | Random 32-char secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth client secret |
| `RESEND_API_KEY` | Resend API key |
| `CONVEX_DEPLOY_KEY` | Convex Cloud deploy key for the environment |
| `VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key |
| `VAPID_SUBJECT` | VAPID subject (e.g. `mailto:admin@yourdomain.com`) |

### Variables (both environments)

| Variable | Description |
|---|---|
| `AZURE_RESOURCE_GROUP` | Resource group for all resources (e.g. `retro-tool-production-rg`) |
| `AZURE_LOCATION` | Azure region for all resources (e.g. `uksouth`) |
| `ACR_NAME` | Azure Container Registry name (e.g. `retrotoolproductionacr`) |
| `ACR_LOGIN_SERVER` | ACR login server (e.g. `retrotoolproductionacr.azurecr.io`) |
| `API_WEBAPP_NAME` | App Service name (e.g. `retro-tool-production-api`) |
| `API_URL` | Full API URL (e.g. `https://retro-tool-production-api.azurewebsites.net`) |
| `SWA_URL` | Static Web App URL (e.g. `https://wonderful-stone-abc123.azurestaticapps.net`) |
| `MICROSOFT_TENANT_ID` | Microsoft OAuth tenant (use `common` for multi-tenant) |
| `EMAIL_FROM` | Sender address (e.g. `noreply@yourdomain.com`) |
| `ESTIMATES_REALTIME_BACKEND` | `socket-io` |
| `RETROS_REALTIME_BACKEND` | `socket-io` |
| `NOTIFICATIONS_REALTIME_BACKEND` | `socket-io` |

> **Staging note**: `DATABASE_URL` in both environments should point to the **same PostgreSQL server** deployed with production infrastructure (different database names if needed).

> **Microsoft login note**: do not create a separate `MICROSOFT_CLIENT_ID` secret. The deployment workflow maps `MICROSOFT_CLIENT_ID` from `AZURE_CLIENT_ID` automatically.

---

## Step 4 — Deploy Infrastructure

Run the **Deploy Infrastructure** workflow manually from GitHub Actions, targeting `production` first:

```
Actions → Deploy Infrastructure → Run workflow → environment: production
```

This creates:

- Resource groups
- Azure Container Registry
- PostgreSQL Flexible Server (shared)
- App Service Plan + Web App
- Static Web App

After it completes, copy the outputs (ACR login server, API URL, SWA hostname) into your GitHub environment **Variables**.

Repeat for `staging` (skips creating a new PostgreSQL server if you reuse the production one via `DATABASE_URL`).

---

## Step 5 — Get the SWA Deployment Token

Bash:

```bash
az staticwebapp secrets list \
  --name retro-tool-production-ui \
  --resource-group retro-tool-production-rg \
  --query "properties.apiKey" -o tsv
```

PowerShell:

```powershell
az staticwebapp secrets list `
  --name retro-tool-production-ui `
  --resource-group retro-tool-production-rg `
  --query "properties.apiKey" -o tsv
```

Add this as the `SWA_DEPLOYMENT_TOKEN` secret in the GitHub environment.

---

## Step 6 — Set Up Convex Cloud

1. Go to [dashboard.convex.dev](https://dashboard.convex.dev) and create a project for each environment (e.g. `retro-tool-production`, `retro-tool-staging`).
2. Copy the **Deploy Key** for each project from Project Settings → Deploy keys.
3. Add it as the `CONVEX_DEPLOY_KEY` secret in the corresponding GitHub environment.
4. Copy the **Deployment URL** (e.g. `https://your-project.convex.cloud`) and add it as `VITE_CONVEX_URL` variable (for the UI build) and `CONVEX_SYNC_URL` variable (for the API).

---

## Step 7 — Build the API Docker Image

The first deploy of the API pipeline will:

1. Build the NestJS Docker image and push it to ACR
2. Run DB migrations via a one-off ACI container
3. Deploy the image to App Service

Trigger it manually or push to `main` (production) / `staging` (staging) with changes under `retro-tool-api/`.

---

## Step 8 — Deploy the UI

Push to `main` or `staging` with changes under `retro-tool-ui/`, or trigger **Deploy UI** manually.

The build injects Vite environment variables from GitHub Variables at build time.

---

## Ongoing Deployments

| Trigger | Pipeline |
|---|---|
| Push to `main` (API changes) | Deploy API → production |
| Push to `staging` (API changes) | Deploy API → staging |
| Push to `main` (UI changes) | Deploy UI → production |
| Push to `staging` (UI changes) | Deploy UI → staging |
| Push to `main` (convex-backend changes) | Deploy Convex → production |
| Push to `staging` (convex-backend changes) | Deploy Convex → staging |
| PR to `main` or `staging` | CI (lint, type-check, test, build) |

---

## Secrets Rotation

- **PostgreSQL password**: Update the Azure Flexible Server password, then update `POSTGRES_PASSWORD` and `DATABASE_URL` secrets in both GitHub environments.
- **VAPID keys**: Rotating keys will invalidate all existing push subscriptions — users must re-subscribe.
- **Better Auth secret**: Rotating this invalidates all existing sessions.
