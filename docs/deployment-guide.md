# Deployment Guide

This guide covers deploying Retro Tool to Azure. Resources are created manually via the Azure Portal. CI/CD pipelines handle code deployments only.

Two environments:

| Environment | Branch | App Service | Static Web App |
|---|---|---|---|
| **Staging** | `staging` | Free F1 | Free |
| **Production** | `main` | Free F1 (upgrade to S1 once Standard VM quota approved) | Free |

Both environments share a single PostgreSQL Flexible Server.

Convex functions are deployed to **Convex Cloud** (not self-hosted).

---

## Prerequisites

- Azure CLI installed (`az` available in your terminal)
- Azure account with an active subscription
- GitHub repository with Actions enabled
- A Convex Cloud account and project per environment
- A Resend account for transactional email
- VAPID keys generated (`npx web-push generate-vapid-keys`)

---

## Step 1 — Login to Azure CLI and Select Subscription

Bash:

```bash
az login
az account list --output table
az account set --subscription "<subscription-name-or-id>"
az account show --output table
```

PowerShell:

```powershell
az login
az account list --output table
az account set --subscription "<subscription-name-or-id>"
az account show --output table
```

No browser available:

```bash
az login --use-device-code
```

---

## Step 2 — Create Azure App Registration (OIDC + Microsoft OAuth)

One app registration shared by GitHub Actions OIDC and Better Auth Microsoft login.

Bash:

```bash
az ad app create --display-name "retro-tool"

APP_ID=$(az ad app list --display-name "retro-tool" --query '[0].appId' -o tsv)
az ad sp create --id $APP_ID

SP_OBJECT_ID=$(az ad sp show --id $APP_ID --query id -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --role Contributor \
  --scope /subscriptions/$SUBSCRIPTION_ID \
  --assignee-principal-type ServicePrincipal

az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --role "User Access Administrator" \
  --scope /subscriptions/$SUBSCRIPTION_ID \
  --assignee-principal-type ServicePrincipal

echo "Client ID: $APP_ID"
echo "Tenant ID: $TENANT_ID"
echo "Subscription ID: $SUBSCRIPTION_ID"

MICROSOFT_CLIENT_SECRET=$(az ad app credential reset \
  --id $APP_ID --append \
  --display-name "better-auth-login" \
  --query password -o tsv)
echo "MICROSOFT_CLIENT_SECRET: $MICROSOFT_CLIENT_SECRET"
```

PowerShell:

```powershell
az ad app create --display-name "retro-tool"

$APP_ID = az ad app list --display-name "retro-tool" --query '[0].appId' -o tsv
az ad sp create --id $APP_ID

$SP_OBJECT_ID = az ad sp show --id $APP_ID --query id -o tsv
$SUBSCRIPTION_ID = az account show --query id -o tsv
$TENANT_ID = az account show --query tenantId -o tsv

az role assignment create `
  --assignee-object-id $SP_OBJECT_ID `
  --role Contributor `
  --scope /subscriptions/$SUBSCRIPTION_ID `
  --assignee-principal-type ServicePrincipal

az role assignment create `
  --assignee-object-id $SP_OBJECT_ID `
  --role "User Access Administrator" `
  --scope /subscriptions/$SUBSCRIPTION_ID `
  --assignee-principal-type ServicePrincipal

Write-Host "Client ID: $APP_ID"
Write-Host "Tenant ID: $TENANT_ID"
Write-Host "Subscription ID: $SUBSCRIPTION_ID"

$MICROSOFT_CLIENT_SECRET = az ad app credential reset `
  --id $APP_ID --append `
  --display-name "better-auth-login" `
  --query password -o tsv
Write-Host "MICROSOFT_CLIENT_SECRET: $MICROSOFT_CLIENT_SECRET"
```

Then in the Azure Portal:
> App registrations → your app → Certificates & secrets → Federated credentials → Add credential

- **Issuer**: `https://token.actions.githubusercontent.com`
- **Subject**: `repo:<org>/<repo>:environment:production` (repeat for `staging`)

Add a **Web redirect URI** for Microsoft OAuth callback:

- `https://<api-webapp-name>.azurewebsites.net/api/auth/callback/microsoft`

---

## Step 3 — Create Azure Resources via Portal

All resources go in one resource group per environment.

### 3a — Resource Group

**Home → Resource groups → Create**

| Field | Value |
|---|---|
| Name | `retro-tool-production-rg` |
| Region | East US 2 |

### 3b — PostgreSQL Flexible Server

**Home → Create a resource → Azure Database for PostgreSQL Flexible Server**

| Field | Value |
|---|---|
| Resource group | `retro-tool-production-rg` |
| Server name | `retro-tool-production-pg` |
| Region | East US 2 |
| PostgreSQL version | 16 |
| Workload type | Development |
| Compute tier | General Purpose |
| Compute size | Standard_D2ds_v4 |
| Storage | 32 GB |
| Admin username | `pgadmin` |
| Admin password | (save this) |
| High availability | Disabled |

Under **Networking** → enable **Allow public access from Azure services** ✓

After creation go to **Databases** → create a database named `retro_tool_db`.

Outputs to save:

- Hostname: `retro-tool-production-pg.postgres.database.azure.com`
- `DATABASE_URL`:
  ```
  postgresql://pgadmin:<password>@retro-tool-production-pg.postgres.database.azure.com:5432/retro_tool_db?sslmode=require
  ```

### 3c — App Service (API)

**Home → Create a resource → Web App**

| Field | Value |
|---|---|
| Resource group | `retro-tool-production-rg` |
| Name | `retro-tool-production-api` |
| Publish | **Code** |
| Runtime stack | Node 22 LTS |
| OS | Linux |
| Region | East US 2 |
| Pricing plan | Free F1 |

Outputs to save:

- App name: `retro-tool-production-api`
- URL: `https://retro-tool-production-api.azurewebsites.net`

### 3d — Static Web App (UI)

**Home → Create a resource → Static Web App**

| Field | Value |
|---|---|
| Resource group | `retro-tool-production-rg` |
| Name | `retro-tool-production-ui` |
| Plan type | Free |
| Region | East US 2 |
| Deployment source | **Other** |
| Deployment authorization policy | **Deployment token** |

After creation:

- Copy the default hostname (e.g. `wonderful-stone-abc123.azurestaticapps.net`)
- Go to **Manage deployment token** → copy the token

---

## Step 4 — Set Up Convex Cloud

1. Go to [dashboard.convex.dev](https://dashboard.convex.dev) and create a project per environment (e.g. `retro-tool-production`, `retro-tool-staging`).
2. From the project dashboard copy:
   - **Convex Cloud URL** (e.g. `https://neat-cod-843.eu-west-1.convex.cloud`) → `CONVEX_SYNC_URL`
   - **Deploy key** from Settings → Deploy Keys (starts with `prod:...`) → `CONVEX_SYNC_ADMIN_KEY` (used by the API at runtime) and `CONVEX_DEPLOY_KEY` (used by CI to push functions)

---

## Step 5 — Configure GitHub Environments

**Settings → Environments** → create `staging` and `production`.

### Secrets

| Secret | Where to get it |
|---|---|
| `AZURE_CLIENT_ID` | App registration Client ID from Step 2 |
| `AZURE_TENANT_ID` | Tenant ID from Step 2 |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID from Step 2 |
| `DATABASE_URL` | Connection string from Step 3b |
| `BETTER_AUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `MICROSOFT_CLIENT_SECRET` | Client secret from Step 2 |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `RESEND_API_KEY` | Resend dashboard |
| `CONVEX_SYNC_ADMIN_KEY` | Convex deploy key (`prod:...`) from Step 4 |
| `CONVEX_DEPLOY_KEY` | Same Convex deploy key — used by CI |
| `VAPID_PRIVATE_KEY` | From `npx web-push generate-vapid-keys` |
| `SWA_DEPLOYMENT_TOKEN` | From Step 3d |

### Variables

| Variable | Value |
|---|---|
| `AZURE_RESOURCE_GROUP` | `retro-tool-production-rg` |
| `AZURE_LOCATION` | `eastus2` |
| `API_WEBAPP_NAME` | `retro-tool-production-api` |
| `API_URL` | `https://retro-tool-production-api.azurewebsites.net` |
| `SWA_URL` | `https://<swa-hostname>.azurestaticapps.net` |
| `CONVEX_SYNC_URL` | `https://neat-cod-843.eu-west-1.convex.cloud` |
| `MICROSOFT_TENANT_ID` | `common` |
| `EMAIL_FROM` | e.g. `noreply@yourdomain.com` |
| `VAPID_PUBLIC_KEY` | From `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | e.g. `mailto:noreply@yourdomain.com` |
| `ESTIMATES_REALTIME_BACKEND` | `socket-io` |
| `RETROS_REALTIME_BACKEND` | `socket-io` |
| `NOTIFICATIONS_REALTIME_BACKEND` | `socket-io` |

> `MICROSOFT_CLIENT_ID` is not a separate secret — the pipeline reuses `AZURE_CLIENT_ID`.

---

## Step 6 — Configure App Service Environment Variables

In the Azure Portal go to **App Service → Configuration → Application settings** and add all vars from [retro-tool-api/.env.production](../retro-tool-api/.env.production).

Set the secrets section values directly here (not in the file):

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `MICROSOFT_CLIENT_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `VAPID_PRIVATE_KEY`
- `CONVEX_SYNC_ADMIN_KEY`

---

## Step 7 — First API Deploy

Push to `main` or trigger **Deploy API** manually in GitHub Actions. The pipeline will:

1. Lint, type-check, test, build
2. Package `dist/` + `node_modules/` + `package.json` into a zip
3. Run DB migrations directly on the runner (`node dist/migrate.js`)
4. Upload zip to App Service via `az webapp deploy`
5. Health check at `/health`

---

## Step 8 — First UI Deploy

Push to `main` or trigger **Deploy UI** manually. Vite builds with env vars injected from GitHub Variables and deploys to the Static Web App via the deployment token.

---

## Ongoing Deployments

| Trigger | Pipeline |
|---|---|
| Push to `main` (API changes) | Deploy API → production |
| Push to `staging` (API changes) | Deploy API → staging |
| Push to `main` (UI changes) | Deploy UI → production |
| Push to `staging` (UI changes) | Deploy UI → staging |
| PR to `main` or `staging` | CI (lint, type-check, test, build) |

---

## Upgrading App Service to S1 (When Quota Available)

The production App Service runs on F1 (Free) until Standard VM quota is approved.

To upgrade:

1. Azure Portal → Subscriptions → **Usage + quotas** → filter East US 2 → search **Standard VMs** → request limit increase (minimum 1)
2. Once approved, go to App Service → **Scale up** → select **S1 Standard**

---

## Secrets Rotation

- **PostgreSQL password**: Update in Azure Portal, then update `DATABASE_URL` in App Service config and GitHub secrets.
- **VAPID keys**: Rotating invalidates all push subscriptions — users must re-subscribe.
- **Better Auth secret**: Rotating invalidates all active sessions.
- **Convex deploy key**: Rotate in Convex Dashboard → update `CONVEX_SYNC_ADMIN_KEY` in App Service config and GitHub secrets.
