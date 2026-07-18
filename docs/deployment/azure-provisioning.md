# Infrastructure Provisioning Guide

This guide covers how to provision Azure infrastructure for Retro Tool using Bicep templates via the CLI. After provisioning, the outputs tell you exactly what to configure in GitHub environment secrets and variables.

---

## Prerequisites

### 1. Install Azure CLI

**Windows (winget):**

```powershell
winget install -e --id Microsoft.AzureCLI
```

**macOS:**

```bash
brew install azure-cli
```

**Linux:**

```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### 2. Verify installation

```powershell
az --version        # Must be 2.20.0+
az bicep version    # Bicep CLI (auto-installed with Azure CLI)
az bicep upgrade    # Upgrade to latest Bicep
```

### 3. (Optional) VS Code Bicep Extension

Install the **Bicep** extension from the VS Code marketplace for syntax highlighting and validation.

---

## Environment → Branch Mapping

| Environment | Branch    | Resource Group          | Purpose                       |
| ----------- | --------- | ----------------------- | ----------------------------- |
| `prod`      | `main`    | `retrotool-prod-rg`    | Production                    |
| `staging`   | `staging` | `retrotool-staging-rg` | Pre-production testing        |
| `develop`   | `develop` | `retrotool-develop-rg` | Development / feature testing |

Each environment gets its own isolated set of Azure resources.

---

## File Structure

```
infra/
├── deploy.bicep                    # Entry point (subscription scope — creates RG + deploys all resources)
├── main.bicep                      # All resources defined here (resource group scope)
└── environments/
    ├── prod.bicepparam             # Production parameters
    ├── staging.bicepparam          # Staging parameters
    └── develop.bicepparam          # Development parameters
```

---

## Provisioning an Environment

### Step 1: Login

```powershell
az login
az account set --subscription "<subscription-id>"
```

### Step 2: Preview changes (what-if)

```powershell
az deployment sub what-if `
  --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters infra/environments/<env>.bicepparam `
  --parameters postgresAdminPassword='<secure-password>'
```

### Step 3: Deploy

```powershell
az deployment sub create `
  --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters infra/environments/<env>.bicepparam `
  --parameters postgresAdminPassword='<secure-password>'
```

Replace `<env>` with `prod`, `staging`, or `develop`.

### Step 4: Get outputs

```powershell
az deployment sub show `
  --name deploy `
  --location southafricanorth `
  --query "properties.outputs" `
  --output table
```

Or as JSON (easier to copy values):

```powershell
az deployment sub show `
  --name deploy `
  --location southafricanorth `
  --query "properties.outputs" `
  --output json
```

---

## Provision All Three Environments

```powershell
# Develop
az deployment sub create --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters infra/environments/develop.bicepparam `
  --parameters postgresAdminPassword='<dev-password>'

# Staging
az deployment sub create --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters infra/environments/staging.bicepparam `
  --parameters postgresAdminPassword='<staging-password>'

# Production
az deployment sub create --location southafricanorth `
  --template-file infra/deploy.bicep `
  --parameters infra/environments/prod.bicepparam `
  --parameters postgresAdminPassword='<prod-password>'
```

---

## Deployment Outputs → GitHub Configuration

After each deployment, you get outputs that map directly to GitHub secrets and variables.

### Get the Static Web App deployment token

```powershell
az staticwebapp secrets list --name <staticWebAppName> --query "properties.apiKey" -o tsv
```

### GitHub Environment Setup

Create three environments in **GitHub → Settings → Environments**: `prod`, `staging`, `develop`.

#### Secrets (per environment)

| GitHub Secret                        | Source                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `AZURE_CLIENT_ID`                    | App Registration client ID (from Entra ID — for OIDC login)           |
| `AZURE_TENANT_ID`                    | Entra ID tenant ID                                                     |
| `AZURE_SUBSCRIPTION_ID`             | Azure subscription ID                                                  |
| `POSTGRES_ADMIN_PASSWORD`            | The password you used during provisioning                              |
| `DATABASE_URL`                       | Output `databaseUrl` — replace `<password>` with real password         |
| `BETTER_AUTH_SECRET`                 | Generate: `openssl rand -base64 32` (unique per env)                   |
| `SWA_DEPLOYMENT_TOKEN`              | From `az staticwebapp secrets list` command above                      |
| `RESEND_API_KEY`                     | From Resend dashboard                                                  |
| `CONVEX_SYNC_ADMIN_KEY`             | From Convex dashboard                                                  |

#### Variables (per environment)

| GitHub Variable            | Source (from deployment output)                             |
| -------------------------- | ----------------------------------------------------------- |
| `ACR_LOGIN_SERVER`         | Output `acrLoginServer` (e.g. `retrotoolprodacr.azurecr.io`) |
| `ACR_NAME`                 | Output `acrName` (e.g. `retrotoolprodacr`)                  |
| `APP_SERVICE_NAME`         | Output `appServiceName` (e.g. `retrotool-prod-api`)         |
| `RESOURCE_GROUP`           | Output `resourceGroupName` (e.g. `retrotool-prod-rg`)       |
| `API_URL`                  | Output `apiUrl` (e.g. `https://retrotool-prod-api.azurewebsites.net`) |
| `FRONTEND_URL`             | Output `uiUrl` (e.g. `https://nice-smoke-0118bc103.7.azurestaticapps.net`) |
| `CONVEX_SYNC_URL`          | From Convex dashboard (per environment)                     |

---

## Post-Provisioning Steps

### 1. Configure App Service environment variables

```powershell
az webapp config appsettings set `
  --resource-group <resourceGroupName> `
  --name <appServiceName> `
  --settings `
    DATABASE_URL="<databaseUrl-with-real-password>" `
    BETTER_AUTH_SECRET="<generated-secret>" `
    BETTER_AUTH_URL="<apiUrl>" `
    FRONTEND_URL="<uiUrl>" `
    CONVEX_SYNC_URL="<convex-url>" `
    CONVEX_SYNC_ADMIN_KEY="<convex-admin-key>" `
    RESEND_API_KEY="<resend-key>"
```

### 2. Configure GitHub Actions OIDC (Federated Credentials)

GitHub Actions uses OpenID Connect (OIDC) to authenticate with Azure — no stored client secrets needed. You must create a **federated identity credential** on your App Registration for each GitHub environment.

#### Find your App Registration Object ID

```powershell
az ad app list --display-name "retro-tool" --query "[].{name:displayName, objectId:id, appId:appId}" -o table
```

#### Create federated credentials (one per environment)

```powershell
# Production (branch: main → environment: production)
az ad app federated-credential create --id <APP_REGISTRATION_OBJECT_ID> --parameters '{
  "name": "github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:kevin-gatimu/retro-tool-v2:environment:production",
  "audiences": ["api://AzureADTokenExchange"],
  "description": "GitHub Actions OIDC for production environment"
}'

# Staging (branch: staging → environment: staging)
az ad app federated-credential create --id <APP_REGISTRATION_OBJECT_ID> --parameters '{
  "name": "github-staging",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:kevin-gatimu/retro-tool-v2:environment:staging",
  "audiences": ["api://AzureADTokenExchange"],
  "description": "GitHub Actions OIDC for staging environment"
}'

# Develop (branch: develop → environment: develop)
az ad app federated-credential create --id <APP_REGISTRATION_OBJECT_ID> --parameters '{
  "name": "github-develop",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:kevin-gatimu/retro-tool-v2:environment:develop",
  "audiences": ["api://AzureADTokenExchange"],
  "description": "GitHub Actions OIDC for develop environment"
}'
```

> Replace `<APP_REGISTRATION_OBJECT_ID>` with the **Object ID** (not Client/App ID) from the command above.

#### Verify existing credentials

```powershell
az ad app federated-credential list --id <APP_REGISTRATION_OBJECT_ID> -o table
```

#### How it works

The `subject` claim must exactly match what GitHub sends during the workflow run:
- `repo:<owner>/<repo>:environment:<environment-name>`

The GitHub workflow uses `azure/login@v2` with OIDC:
```yaml
- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

If you see `AADSTS700213: No matching federated identity record found`, it means the `subject` in the credential doesn't match what GitHub is sending. Double-check:
1. The environment name in the workflow (`environment: staging`) matches the credential subject
2. The repo name is correct (`kevin-gatimu/retro-tool-v2`)
3. The credential is on the correct App Registration

---

### 3. Push first Docker image

```powershell
az acr login --name <acrName>
docker build -t <acrLoginServer>/retro-tool-api:latest ./retro-tool-api
docker push <acrLoginServer>/retro-tool-api:latest
```

### 3. Run database migrations

```powershell
$env:DATABASE_URL = "<databaseUrl-with-real-password>"
pnpm --dir retro-tool-api db:migrate
```

### 4. Configure Microsoft OAuth redirect URIs

Add these to your Azure App Registration:

```
https://retrotool-prod-api.azurewebsites.net/api/auth/callback/microsoft
https://retrotool-staging-api.azurewebsites.net/api/auth/callback/microsoft
https://retrotool-develop-api.azurewebsites.net/api/auth/callback/microsoft
```

---

## Destroying an Environment

```powershell
az group delete --name retrotool-develop-rg --yes --no-wait
```

---

## Troubleshooting

| Issue                                   | Fix                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `ResourceGroupNotFound`                 | Use `az deployment sub create` (not `group create`) — the template creates the RG |
| ACR push 401 Unauthorized               | Run `az acr login --name <acrName>` first                                      |
| App Service "Application Error"         | `az webapp log tail --name <name> --resource-group <rg>`                       |
| Bicep syntax errors                     | `az bicep build --file infra/main.bicep`                                       |
| PostgreSQL connection refused            | Check firewall rules and use `?sslmode=require`                                |
| "content already consumed" error         | Upgrade Azure CLI: `az upgrade`                                                |

---

## Resources Provisioned Per Environment

| # | Resource                | SKU / Config                 | Region             |
| - | ----------------------- | ---------------------------- | ------------------ |
| 1 | Resource Group          | —                            | South Africa North |
| 2 | Container Registry      | Standard, admin disabled     | South Africa North |
| 3 | Managed Identity        | + AcrPull role on ACR        | South Africa North |
| 4 | PostgreSQL Flexible     | B1ms, 32 GiB, PG 17         | South Africa North |
| 5 | App Service Plan        | P0v3, Linux                  | South Africa North |
| 6 | App Service (Container) | WebSockets, HTTPS, Always On | South Africa North |
| 7 | Static Web App          | Standard                     | West Europe        |
