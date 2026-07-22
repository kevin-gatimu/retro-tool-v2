# GitHub Actions OIDC Setup

This guide explains how to configure Azure federated identity credentials so GitHub Actions can authenticate to Azure using OpenID Connect (OIDC) — no client secrets needed.

---

## How It Works

```
GitHub Actions workflow run
    │
    ├─ Requests OIDC token from GitHub's token endpoint
    │  (includes subject claim: repo:owner/repo:environment:<env>)
    │
    ├─ Presents token to Azure AD (Entra ID)
    │
    └─ Azure matches the subject claim against a federated credential
       on the App Registration → grants access
```

Each GitHub environment (`production`, `staging`, `develop`) needs its own federated credential with a matching `subject` claim.

---

## Prerequisites

1. **Azure CLI** installed and logged in (`az login`)
2. **App Registration** already created in Entra ID (e.g. "retro-tool")
3. **GitHub environments** created in Settings → Environments: `production`, `staging`, `develop`
4. Sufficient permissions to manage App Registrations (Application Administrator or Owner)

---

## Quick Start

```powershell
# Login to Azure
az login

# Create federated credentials for ALL environments
.\infra\setup-oidc-credentials.ps1
```

That's it. The script will find the App Registration, check for existing credentials, and create any missing ones.

---

## Script Reference

### Parameters

| Parameter         | Default                        | Description                                                             |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `-AppName`      | `retro-tool`                 | Display name of the App Registration in Entra ID                        |
| `-RepoFullName` | `kevin-gatimu/retro-tool-v2` | GitHub repository in`owner/repo` format                               |
| `-Environment`  | `all`                        | Target environment:`production`, `staging`, `develop`, or `all` |
| `-Force`        | (switch)                       | Delete and recreate credentials that already exist                      |
| `-Delete`       | (switch)                       | Remove federated credentials instead of creating them                   |
| `-List`         | (switch)                       | List existing federated credentials and exit (read-only)                |

### Examples

```powershell
# Create credentials for all environments
.\infra\setup-oidc-credentials.ps1

# Create credential for staging only
.\infra\setup-oidc-credentials.ps1 -Environment staging

# Recreate production credential (e.g. after renaming the repo)
.\infra\setup-oidc-credentials.ps1 -Environment production -Force

# List all existing federated credentials
.\infra\setup-oidc-credentials.ps1 -List

# Delete credential for develop (revoke OIDC access)
.\infra\setup-oidc-credentials.ps1 -Delete -Environment develop

# Delete ALL federated credentials
.\infra\setup-oidc-credentials.ps1 -Delete

# Use a different App Registration or repo
.\infra\setup-oidc-credentials.ps1 -AppName "my-other-app" -RepoFullName "org/other-repo"
```

### What It Creates

For each environment, the script creates a federated identity credential with:

| Field     | Value                                                         |
| --------- | ------------------------------------------------------------- |
| Name      | `github-<environment>`                                      |
| Issuer    | `https://token.actions.githubusercontent.com`               |
| Subject   | `repo:kevin-gatimu/retro-tool-v2:environment:<environment>` |
| Audiences | `api://AzureADTokenExchange`                                |

---

## GitHub Environment Secrets

After running the script, configure these secrets in **each** GitHub environment (Settings → Environments → `<env>` → Secrets):

| Secret                    | Value                                                       |
| ------------------------- | ----------------------------------------------------------- |
| `AZURE_CLIENT_ID`       | App Registration Client (Application) ID — shown by script |
| `AZURE_TENANT_ID`       | Your Entra ID tenant ID                                     |
| `AZURE_SUBSCRIPTION_ID` | Target Azure subscription ID                                |

The script prints `AZURE_CLIENT_ID` at the end. Find your tenant and subscription IDs with:

```powershell
az account show --query "{tenantId:tenantId, subscriptionId:id}" -o table
```

---

## How Workflows Use OIDC

The deploy workflows use `azure/login@v2` with OIDC:

```yaml
- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

The workflow's `permissions: id-token: write` setting allows it to request the OIDC token from GitHub.

---

## Troubleshooting

### `AADSTS700213: No matching federated identity record found`

The `subject` claim in the federated credential doesn't match what GitHub is sending.

**Check:**

1. Credential exists: `az ad app federated-credential list --id <OBJECT_ID> -o table`
2. Environment name matches exactly — the workflow's `environment:` value must match the credential's subject
3. Repo name is correct (case-sensitive): `repo:kevin-gatimu/retro-tool-v2:environment:staging`
4. The credential is on the correct App Registration

**Fix:** Recreate the credential with the correct values:

```powershell
.\infra\setup-oidc-credentials.ps1 -Environment staging -Force
```

### `AADSTS70021: No matching federated identity record found for presented assertion issuer`

The issuer URL is wrong. The script uses the correct value (`https://token.actions.githubusercontent.com`), but if credentials were created manually, verify with:

```powershell
az ad app federated-credential list --id <OBJECT_ID> --query "[].{name:name, issuer:issuer}" -o table
```

### Known CLI bug: `MissingSubscription` on `az role assignment create/list`

If your account is the subscription's classic **Account Admin** (common on
Visual Studio Enterprise or legacy CSP subscriptions), the `az role assignment`
subcommand can fail with:

```text
(MissingSubscription) The request did not have a subscription or a valid
tenant level resource provider.
```

This happens on **every** scope — even a plain read-only `az role assignment
list` — regardless of whether `--role` is a name or a GUID. It reproduces while
other ARM calls (`az group show`, `az acr show`, `az postgres ... show`) work
fine, and survives `az account clear && az login`. This is a bug in the CLI's
role-assignment code path, not a real permission gap.

**Workaround:** call the same ARM REST endpoint directly with `az rest`, which
uses the identical token but bypasses the broken command:

```bash
SUB="<subscription-id>"
SCOPE="/subscriptions/${SUB}/resourceGroups/<resource-group>"
ROLE_ID="b24988ac-6180-42a0-ab88-20f7382dd24c"   # Contributor
ASSIGNMENT_ID=$(node -e "console.log(require('crypto').randomUUID())")

az rest --method put \
  --url "https://management.azure.com${SCOPE}/providers/Microsoft.Authorization/roleAssignments/${ASSIGNMENT_ID}?api-version=2022-04-01" \
  --body "{\"properties\":{\"roleDefinitionId\":\"/subscriptions/${SUB}/providers/Microsoft.Authorization/roleDefinitions/${ROLE_ID}\",\"principalId\":\"<SP_OBJECT_ID>\",\"principalType\":\"ServicePrincipal\"}}"
```

Common role definition GUIDs:

| Role | GUID |
| --- | --- |
| Contributor | `b24988ac-6180-42a0-ab88-20f7382dd24c` |
| Role Based Access Control Administrator | `f58310d9-a9f6-439a-9e8d-f62e7b41a168` |
| AcrPull | `7f951dda-4ed3-4680-a7ca-43fe172d538d` |
| Key Vault Secrets User | `4633458b-17de-408a-b874-0445c86b69e6` |

Verify a grant landed with a read-side `az rest --method get` against the same
URL (list form, no assignment ID) rather than `az role assignment list`.

### App Registration not found

The script searches by display name. Verify the name:

```powershell
az ad app list --display-name "retro-tool" --query "[].{name:displayName, id:id}" -o table
```

### Permission denied

You need one of:

- Application Administrator role in Entra ID
- Owner of the App Registration
- Global Administrator (not recommended for routine use)

---

## Manual Alternative

If you can't run the script (e.g. from a Mac or Linux machine without PowerShell 7), use the Azure CLI directly:

```bash
APP_OBJECT_ID=$(az ad app list --display-name "retro-tool" --query "[0].id" -o tsv)

az ad app federated-credential create --id "$APP_OBJECT_ID" --parameters '{
  "name": "github-staging",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:kevin-gatimu/retro-tool-v2:environment:staging",
  "audiences": ["api://AzureADTokenExchange"],
  "description": "GitHub Actions OIDC for staging environment"
}'
```

Repeat for each environment, changing `name` and `subject`.

---

## Revoking Access

Use the `-Delete` flag to remove federated credentials:

```powershell
# Remove a single environment's OIDC access
.\infra\setup-oidc-credentials.ps1 -Delete -Environment develop

# Remove ALL environments' OIDC access
.\infra\setup-oidc-credentials.ps1 -Delete
```

This immediately prevents the targeted GitHub environment(s) from authenticating to Azure.

Manual alternative:

```powershell
$objectId = (az ad app list --display-name "retro-tool" --query "[0].id" -o tsv)
az ad app federated-credential delete --id $objectId --federated-credential-id "github-develop"
```
