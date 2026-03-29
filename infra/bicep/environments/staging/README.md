# Staging Deployment Guide

Step-by-step instructions to provision Azure infrastructure and deploy the Retro Tool platform to the **staging** environment.

---

## Prerequisites

Install the following tools before you begin:

| Tool | Purpose | Install |
|---|---|---|
| Azure CLI (`az`) | Provision infra & auth | https://learn.microsoft.com/cli/azure/install-azure-cli |
| `kubectl` | Manage Kubernetes | `az aks install-cli` |
| `helm` | Install cluster add-ons | https://helm.sh/docs/intro/install/ |
| `kubelogin` | AAD auth for AKS | `az aks install-cli` |
| Docker | Build & push images | https://docs.docker.com/get-docker/ |
| `kustomize` | Render K8s overlays | Bundled with `kubectl` (≥ 1.14) |
| `pnpm` | Run local scripts | https://pnpm.io/installation |

> On Windows, WSL 2 is recommended for running the shell commands in this guide.

---

## 1 — Azure login

```bash
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"

# Verify the correct subscription is active
az account show --query name -o tsv
```

---

## 2 — Generate secrets before deployment

> Do this **before** running Bicep so you have the values ready.
>
> Use either OpenSSL or native PowerShell commands.

### Postgres admin password
```bash
# Store this securely — you will pass it as a Bicep parameter
openssl rand -base64 32
```

```powershell
$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

### Better Auth secret
```bash
openssl rand -base64 32
```

```powershell
$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

### Convex instance secret (must be 64 hex chars)
```bash
openssl rand -hex 32
```

```powershell
$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
```

### VAPID keys (push notifications)
```bash
npx web-push generate-vapid-keys
```

---

## 3 — Create the staging resource group

```bash
az group create \
  --name retro-tool-staging \
  --location eastus
```

> Change `eastus` to your preferred Azure region. All resources will be in this region.

```bash
az group create --name retro-tool-staging --location southafricanorth
```

---

## 4 — Deploy Azure infrastructure (Bicep)

```bash
az deployment group create \
  --resource-group retro-tool-staging \
  --template-file infra/bicep/environments/staging/main.bicep \
  --parameters @infra/bicep/environments/staging/parameters.json \
  --parameters postgresAdminPassword="<POSTGRES_ADMIN_PASSWORD_FROM_STEP_2>"
```

This provisions:
- Virtual Network with AKS subnet and Postgres-delegated subnet
- Azure Container Registry (Basic SKU)
- Log Analytics Workspace + Application Insights
- Key Vault (RBAC-enabled)
- User-assigned Managed Identity
- AKS cluster (1 × Standard_B2s node)
- PostgreSQL Flexible Server (Burstable B1ms)
- Private DNS zone for `privatelink.postgres.database.azure.com`
- AcrPull role assignment for the AKS kubelet identity
- Key Vault Secrets User role assignment for the managed identity

### Capture deployment outputs

```bash
az deployment group show \
  --resource-group retro-tool-staging \
  --name main \
  --query properties.outputs \
  -o table
```

Note the following values — you will use them throughout the remaining steps:

| Output | Description |
|---|---|
| `acrLoginServer` | ACR hostname, e.g. `retrotoolstagingacr.azurecr.io` |
| `aksClusterName` | AKS cluster name, e.g. `retro-tool-staging-aks` |
| `postgresServerFqdn` | Postgres FQDN |
| `keyVaultName` | Key Vault name |

---

## 5 — Configure PostgreSQL

### Add a firewall rule (temporary — for initial setup only)

```bash
# Get your current public IP
MY_IP=$(curl -s https://api.ipify.org)

az postgres flexible-server firewall-rule create \
  --resource-group retro-tool-staging \
  --name retro-tool-staging-pg \
  --rule-name AdminAccess \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP
```

### Create application databases and users

```bash
PGHOST="<POSTGRES_FQDN_FROM_STEP_4>"
PGUSER="retrotooladmin"
PGPASSWORD="<POSTGRES_ADMIN_PASSWORD>"

psql "host=$PGHOST dbname=postgres user=$PGUSER password=$PGPASSWORD sslmode=require" <<'SQL'
-- Application database
CREATE DATABASE app_staging;
CREATE USER appuser WITH PASSWORD 'REPLACE_WITH_APP_USER_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE app_staging TO appuser;

-- Convex database
CREATE DATABASE convex_staging;
CREATE USER convexuser WITH PASSWORD 'REPLACE_WITH_CONVEX_USER_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE convex_staging TO convexuser;
SQL
```

> Remove the temporary firewall rule once initial setup is complete:
> ```bash
> az postgres flexible-server firewall-rule delete \
>   --resource-group retro-tool-staging \
>   --name retro-tool-staging-pg \
>   --rule-name AdminAccess --yes
> ```

---

## 6 — Connect kubectl to the AKS cluster

```bash
az aks get-credentials \
  --resource-group retro-tool-staging \
  --name retro-tool-staging-aks \
  --overwrite-existing

# Verify connection
kubectl get nodes
```

---

## 7 — Install the nginx ingress controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz
```

### Get the public IP assigned to the ingress controller

```bash
# Wait until EXTERNAL-IP is assigned (may take 2-3 minutes)
kubectl get service ingress-nginx-controller -n ingress-nginx --watch
```

> Configure DNS A records pointing your staging subdomains to this IP:
> - `app.staging.yourdomain.com`
> - `api.staging.yourdomain.com`
> - `convex-api.staging.yourdomain.com`
> - `convex-site.staging.yourdomain.com`
> - `convex-dashboard.staging.yourdomain.com`

---

## 8 — Build and push Docker images to ACR

```bash
ACR="<ACR_LOGIN_SERVER_FROM_STEP_4>"   # e.g. retrotoolstagingacr.azurecr.io

az acr login --name retrotoolstagingacr
```

### API image

```bash
docker build \
  -t $ACR/retro-tool-api:latest \
  ./retro-tool-api

docker push $ACR/retro-tool-api:latest
```

### UI image  

> The UI bakes `VITE_*` env vars at **build time**. Replace the values below with your actual staging URLs.

```bash
docker build \
  -t $ACR/retro-tool-ui:latest \
  --build-arg VITE_APP_ENV=staging \
  --build-arg VITE_API_URL=https://api.staging.yourdomain.com \
  --build-arg VITE_APP_TITLE="Retro Tool (Staging)" \
  --build-arg VITE_CONVEX_URL=https://convex-api.staging.yourdomain.com \
  --build-arg VITE_ESTIMATES_REALTIME_BACKEND=convex \
  --build-arg VITE_RETROS_REALTIME_BACKEND=convex \
  --build-arg VITE_NOTIFICATIONS_REALTIME_BACKEND=convex \
  -f retro-tool-ui/Dockerfile \
  .

docker push $ACR/retro-tool-ui:latest
```

---

## 9 — Update staging kustomize overlay with your ACR and domains

Edit [`deploy/aks/overlays/staging/kustomization.yaml`](../../../../../deploy/aks/overlays/staging/kustomization.yaml) and update the `images[].newName` values to your ACR login server:

```yaml
images:
  - name: retro-tool-api
    newName: retrotoolstagingacr.azurecr.io/retro-tool-api   # ← your ACR login server
    newTag: latest
  - name: retro-tool-ui
    newName: retrotoolstagingacr.azurecr.io/retro-tool-ui    # ← your ACR login server
    newTag: latest
```

Edit [`deploy/aks/overlays/staging/patches/ingress.yaml`](../../../../../deploy/aks/overlays/staging/patches/ingress.yaml) and replace each host value with your real staging subdomains.

---

## 10 — Create Kubernetes Secrets

> Reference [`deploy/aks/base/secrets.placeholder.yaml`](../../../../../deploy/aks/base/secrets.placeholder.yaml) for the full list of required keys.

```bash
NS=retro-tool-staging
PGFQDN="<POSTGRES_FQDN_FROM_STEP_4>"

# Apply the namespace first (kustomize will also create it, but we need it for secrets)
kubectl create namespace $NS --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic retro-tool-api-secret \
  --namespace $NS \
  --from-literal=DATABASE_URL="postgresql://appuser:APP_USER_PASSWORD@$PGFQDN:5432/app_staging?sslmode=require" \
  --from-literal=REDIS_URL="redis://redis:6379" \
  --from-literal=BETTER_AUTH_SECRET="<BETTER_AUTH_SECRET_FROM_STEP_2>" \
  --from-literal=BETTER_AUTH_URL="https://api.staging.yourdomain.com" \
  --from-literal=BETTER_AUTH_SESSION_EXPIRES_IN="604800" \
  --from-literal=FRONTEND_URL="https://app.staging.yourdomain.com" \
  --from-literal=ALLOWED_ORIGINS="https://app.staging.yourdomain.com,https://api.staging.yourdomain.com" \
  --from-literal=DEPLOYED_SERVER_URL="https://api.staging.yourdomain.com" \
  --from-literal=CONVEX_SYNC_URL="https://convex-api.staging.yourdomain.com" \
  --from-literal=CONVEX_SYNC_ADMIN_KEY="<CONVEX_ADMIN_KEY — generated in step 13>" \
  --from-literal=ENABLE_CRON_JOBS="true" \
  --from-literal=WEEKLY_DIGEST_SEND_HOUR="6" \
  --from-literal=VAPID_PUBLIC_KEY="<VAPID_PUBLIC_KEY_FROM_STEP_2>" \
  --from-literal=VAPID_PRIVATE_KEY="<VAPID_PRIVATE_KEY_FROM_STEP_2>" \
  --from-literal=VAPID_SUBJECT="mailto:ops@yourdomain.com" \
  --from-literal=RESEND_API_KEY="<YOUR_RESEND_API_KEY>" \
  --from-literal=EMAIL_FROM="noreply@yourdomain.com"

kubectl create secret generic convex-backend-secret \
  --namespace $NS \
  --from-literal=INSTANCE_NAME="convex-staging" \
  --from-literal=INSTANCE_SECRET="<CONVEX_INSTANCE_SECRET_FROM_STEP_2>" \
  --from-literal=POSTGRES_URL="postgresql://convexuser:CONVEX_USER_PASSWORD@$PGFQDN:5432/convex_staging?sslmode=require" \
  --from-literal=DO_NOT_REQUIRE_SSL="0"
```

> **Note:** If you don't have a Redis instance, you can skip `REDIS_URL` — Socket.IO pub/sub will run in-process (single replica only). For multi-replica staging, provision an Azure Cache for Redis and set the `rediss://` URL.

---

## 11 — Run database migrations

```bash
ACR="<ACR_LOGIN_SERVER>"
NS=retro-tool-staging
PGFQDN="<POSTGRES_FQDN>"

kubectl run db-migrate \
  --rm -it \
  --image=$ACR/retro-tool-api:latest \
  --namespace=$NS \
  --restart=Never \
  --env="DATABASE_URL=postgresql://appuser:APP_USER_PASSWORD@$PGFQDN:5432/app_staging?sslmode=require" \
  --env="NODE_ENV=production" \
  -- pnpm db:migrate
```

---

## 12 — Deploy to AKS

```bash
kubectl apply -k deploy/aks/overlays/staging
```

### Verify rollout

```bash
NS=retro-tool-staging

kubectl get pods -n $NS
kubectl get deployments -n $NS
kubectl get ingress -n $NS
```

All pods should reach `Running` status. If any pod is stuck in `CrashLoopBackOff`, check logs:

```bash
kubectl logs -n $NS deployment/retro-tool-api --tail=50
kubectl logs -n $NS deployment/convex-backend --tail=50
```

---

## 13 — Generate the Convex admin key

The admin key is needed for `CONVEX_SYNC_ADMIN_KEY` in the API secret (step 10) and for the Convex dashboard.

```bash
NS=retro-tool-staging

# Wait for convex-backend to be Running first
kubectl wait --for=condition=ready pod -l app=convex-backend -n $NS --timeout=120s

# Generate the key
kubectl exec -n $NS deployment/convex-backend -- ./generate_admin_key.sh
```

Copy the generated key and **update** the API secret:

```bash
kubectl create secret generic retro-tool-api-secret \
  --namespace $NS \
  --from-literal=CONVEX_SYNC_ADMIN_KEY="<NEW_ADMIN_KEY>" \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart the API to pick up the new secret value
kubectl rollout restart deployment/retro-tool-api -n $NS
```

---

## 14 — Verify the deployment

Open the following URLs in your browser:

| Service | URL |
|---|---|
| App (UI) | `https://app.staging.yourdomain.com` |
| API health | `https://api.staging.yourdomain.com/health` |
| API docs (Swagger) | `https://api.staging.yourdomain.com/api` |
| Convex dashboard | `https://convex-dashboard.staging.yourdomain.com` |

---

## Updating a deployment (after code changes)

```bash
ACR="retrotoolstagingacr.azurecr.io"
NS=retro-tool-staging
TAG=$(git rev-parse --short HEAD)

# Rebuild and push
docker build -t $ACR/retro-tool-api:$TAG ./retro-tool-api
docker push $ACR/retro-tool-api:$TAG

# Update the image in-place without editing the kustomization file
kubectl set image deployment/retro-tool-api retro-tool-api=$ACR/retro-tool-api:$TAG -n $NS
kubectl rollout status deployment/retro-tool-api -n $NS
```

For the UI, rebuild with the same `--build-arg` flags as step 8 but with the new tag.

---

## Troubleshooting

### Pod stuck in `ImagePullBackOff`
- Confirm the AcrPull role assignment is propagated: may take a few minutes after Bicep deployment
- Confirm the image name in `kustomization.yaml` matches the ACR login server exactly

### API returns 500 on startup
- Check env vars with `kubectl describe pod -n $NS <pod-name>` — missing required secret keys will cause a Zod validation error at startup

### Convex backend fails with Postgres errors
- Confirm the `convex_staging` database exists and `convexuser` has full privileges
- Confirm `DO_NOT_REQUIRE_SSL=0` and the connection string includes `?sslmode=require`

### Ingress 404 for all routes
- Confirm the nginx ingress controller is running: `kubectl get pods -n ingress-nginx`
- Confirm DNS records point to the ingress controller's external IP
- Confirm ingress hostname in the overlay matches your DNS entry exactly

---

## Infrastructure sizing (staging vs production)

| Resource | Staging | Production |
|---|---|---|
| ACR SKU | Basic | Standard |
| AKS nodes | 1 × Standard_B2s | 3 × Standard_D4s_v3 |
| Postgres SKU | Burstable B1ms | General Purpose D2s_v3 |
| Postgres storage | 32 GB | 64 GB |
| Log retention | 30 days | 90 days |
| Private endpoint on Postgres | No | Yes |
