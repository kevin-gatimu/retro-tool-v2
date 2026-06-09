# Retro Tool — Production Infrastructure

Provision the production Azure environment for Retro Tool.

## Prerequisites

1. **Azure CLI** (v2.20+): `winget install -e --id Microsoft.AzureCLI`
2. **Bicep CLI**: `az bicep upgrade`
3. Azure subscription access

## Login

```powershell
az login
az account set --subscription "<subscription-id>"
```

## Preview (what-if)

```powershell
az deployment sub what-if --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters environment=prod postgresAdminPassword='<prod-password>'
```

## Deploy

```powershell
az deployment sub create --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters environment=prod postgresAdminPassword='<prod-password>'
```

## View Outputs

```powershell
az deployment sub show --name deploy --location southafricanorth `
  --query "properties.outputs" --output table
```

## Get Static Web App Deployment Token

```powershell
az staticwebapp secrets list --name retrotool-prod-ui --query "properties.apiKey" -o tsv
```

## Expected Outputs

| Output                      | Example Value                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `resourceGroupName`       | `retrotool-prod-rg`                                                                                                |
| `acrLoginServer`          | `retrotoolprodacr.azurecr.io`                                                                                      |
| `acrName`                 | `retrotoolprodacr`                                                                                                 |
| `apiUrl`                  | `https://retrotool-prod-api.azurewebsites.net`                                                                     |
| `uiUrl`                   | `https://<random>.azurestaticapps.net`                                                                             |
| `databaseUrl`             | `postgresql://pgadmin:<password>@retrotool-prod-db.postgres.database.azure.com:5432/retro_tool_db?sslmode=require` |
| `appServiceName`          | `retrotool-prod-api`                                                                                               |
| `staticWebAppName`        | `retrotool-prod-ui`                                                                                                |
| `managedIdentityClientId` | `<guid>`                                                                                                           |

## GitHub Environment: `prod` (branch: `main`)

### Secrets

| Secret                              | Value                                     | Where to find it                                                                                                                                           |
| ----------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AZURE_CLIENT_ID`                 | App Registration client ID                | Run:`az ad app list --display-name "<app-name>" --query "[0].appId" -o tsv` or **Portal → Entra ID → App registrations → your app → Overview** |
| `AZURE_TENANT_ID`                 | Entra ID tenant ID                        | Run:`az account show --query "tenantId" -o tsv` or **Portal → Entra ID → Overview**                                                              |
| `AZURE_SUBSCRIPTION_ID`           | `158d81fb-642e-4c3f-9e20-cd4da5312f79`  | **Azure Portal → Subscriptions → your sub → Overview**                                                                                            |
| `POSTGRES_ADMIN_PASSWORD`         | Password used during provisioning         | The value you passed to `postgresAdminPassword`                                                                                                          |
| `DATABASE_URL`                    | Output `databaseUrl` with real password | From deployment output (replace `<password>`)                                                                                                            |
| `BETTER_AUTH_SECRET`              | Session signing secret                    | Generate:`openssl rand -base64 32`                                                                                                                       |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA deployment token                      | Run:`az staticwebapp secrets list --name retrotool-prod-ui --query "properties.apiKey" -o tsv`                                                           |
| `RESEND_API_KEY`                  | Email API key                             | **resend.com → API Keys**                                                                                                                           |
| `CONVEX_SYNC_ADMIN_KEY`           | Convex admin key                          | **Convex dashboard → Settings → Deploy key**                                                                                                       |
| `MICROSOFT_CLIENT_SECRET`         | OAuth app secret                          | **Entra ID → App registrations → your app → Certificates & secrets → New client secret**                                                         |

> **Note:** `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` are needed for GitHub Actions OIDC login (`azure/login@v2`). They allow CI/CD workflows to authenticate to Azure without storing passwords. If you only deploy manually via CLI, you can skip these two.

### Variables

| Variable             | Value (from deployment output)

```

```

|                      |                                                     |
| -------------------- | --------------------------------------------------- |
| `ACR_LOGIN_SERVER` | `retrotoolprodacr.azurecr.io`                     |
| `ACR_NAME`         | `retrotoolprodacr`                                |
| `APP_SERVICE_NAME` | `retrotool-prod-api`                              |
| `RESOURCE_GROUP`   | `retrotool-prod-rg`                               |
| `API_URL`          | `https://retrotool-prod-api.azurewebsites.net`    |
| `FRONTEND_URL`     | `https://<your-swa-hostname>.azurestaticapps.net` |
| `CONVEX_SYNC_URL`  | From Convex dashboard                               |

### Azure APP Registration :Add Microsoft OAuth redirect URI

```
Add to your App Registration in Entra ID: https://retrotool-prod-api.azurewebsites.net/api/auth/callback/microsoft
```

```
Name : Retro-tool-prod
```

```
Home page URL: https://retro-tool.com
```

```
Terms of service URL: https://retro-tool.com/termsofservice
```

```
Privacy statement URL: https://retro-tool.com/privacystatement
```

```
Publisher domain: retro-tool.com
```
