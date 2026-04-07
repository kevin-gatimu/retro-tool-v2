# Replacing Azure Application Gateway with Caddy (SSL Termination)

## Why

Azure Application Gateway costs ~$125+/month at minimum capacity. Caddy is a free, open-source web server that handles SSL termination and automatically obtains and renews Let's Encrypt certificates with zero configuration. By running Caddy as a sidecar container inside the same Azure Container Instance as the Convex backend, we eliminate the Application Gateway entirely.

## Architecture

**Before:**
```
Browser
  │  wss:// (port 443)
  ▼
Application Gateway  ← SSL terminates here (manual PFX cert upload)
  │  ws:// (port 3210, plain HTTP)
  ▼
Azure Container Instance (Convex backend)
```

**After:**
```
Browser
  │  wss:// (port 443)
  ▼
Azure Container Instance
  ├── caddy (port 80/443)  ← SSL terminates here (auto Let's Encrypt cert)
  │     │  localhost:3210
  └── convex-backend (port 3210/3211, internal only)
```

Containers in the same ACI group share `localhost`, so Caddy can proxy to Convex without any network hop.

---

## How Caddy Gets Its Certificate

1. On first startup, Caddy sees it needs to serve `https://<your-aci-fqdn>`
2. It contacts Let's Encrypt and requests a certificate
3. Let's Encrypt sends an HTTP-01 challenge to port 80 of your domain
4. Caddy (which IS listening on port 80) responds correctly
5. Let's Encrypt issues a valid, browser-trusted certificate
6. Caddy stores it in memory and starts serving HTTPS on port 443

This takes 10–30 seconds on first boot. Certificate renewal is automatic.

> **Note:** If the ACI container group restarts frequently (more than 5 times per week), Caddy will hit Let's Encrypt rate limits (5 duplicate certs per domain per week). For production, mount an Azure File Share as a volume to persist the certificate across restarts. See [Persistent Certificate Storage](#optional-persistent-certificate-storage) below.

---

## Step-by-Step Migration

### Step 1 — Delete the Application Gateway

In the Azure Portal:
1. Go to **Resource Groups** → `retro-tool-api-rg`
2. Find `retro-tool-production-convex-gateway`
3. Click **Delete** and confirm

Or via Azure CLI:
```bash
az network application-gateway delete \
  --name retro-tool-production-convex-gateway \
  --resource-group retro-tool-api-rg
```

Also delete the associated VNet and Public IP if they were created solely for the gateway:
```bash
az network vnet delete \
  --name retro-tool-production-convex-gateway-vnet \
  --resource-group retro-tool-api-rg

az network public-ip delete \
  --name retro-tool-production-convex-gateway-pip \
  --resource-group retro-tool-api-rg
```

### Step 2 — Bicep Changes (already applied)

The following files were updated. No further code changes are needed.

**`infra/bicep/modules/container-instance.bicep`**
- Added `caddyAcmeEmail` parameter
- Changed public ports from `3210/3211` to `80/443`
- Added `caddy:alpine` as a second container with the reverse proxy command

**`infra/bicep/main.bicep`**
- Removed `appGatewaySslCertData` and `appGatewaySslCertPassword` parameters
- Removed the Application Gateway module deployment
- Added `caddyAcmeEmail` parameter, passed to the container instance module
- Updated `convexSyncUrl` output to use the ACI FQDN directly

### Step 3 — Redeploy the Container Instance

Run the Bicep deployment. Only provide parameters that differ from defaults:

```bash
az deployment sub create \
  --location southafricanorth \
  --template-file infra/bicep/main.bicep \
  --parameters \
      environmentName=production \
      caddyAcmeEmail=your@email.com \
      postgresAdminPassword=<your-pg-password> \
      convexInstanceSecret=<your-64-char-hex-secret>
```

The deployment will restart the container group with both `convex-backend` and `caddy` containers running.

If you want persistent certificates (recommended for production), include:

```bash
az deployment sub create \
  --location southafricanorth \
  --template-file infra/bicep/main.bicep \
  --parameters \
      environmentName=production \
      caddyAcmeEmail=your@email.com \
      caddyPersistCertificates=true \
      caddyCertStorageAccountName=retrotoolcaddycerts \
      caddyCertStorageShareName=caddy-data \
      caddyCertStorageAccountKey=<storage-account-key> \
      postgresAdminPassword=<your-pg-password> \
      convexInstanceSecret=<your-64-char-hex-secret>
```

### Step 4 — Wait for Caddy to Get a Certificate

The ACI FQDN is:
```
retro-tool-production-convex.southafricanorth.azurecontainer.io
```

After deployment completes, wait ~30 seconds for Caddy to obtain its Let's Encrypt certificate, then verify:
```bash
curl -I https://retro-tool-production-convex.southafricanorth.azurecontainer.io
```

You should see `HTTP/2 200` (or a redirect) with no certificate errors.

### Step 5 — Update the Static Web App Environment Variable

In the Azure Portal:
1. Go to **Static Web Apps** → `retro-tool-production-ui`
2. **Settings** → **Environment variables**
3. Update `VITE_CONVEX_URL`:

```
VITE_CONVEX_URL = https://retro-tool-production-convex.southafricanorth.azurecontainer.io
```

4. Click **Save** and trigger a new deployment of the frontend so the build picks up the new variable.

> The Convex client automatically uses `wss://` when the URL starts with `https://`, so no frontend code changes are needed.

---

## Verification

Check that the WebSocket connection is working:
1. Open your frontend app in the browser
2. Open DevTools → **Network** tab → filter by **WS**
3. You should see a `wss://` connection to the ACI FQDN with status `101 Switching Protocols`
4. No Mixed Content errors in the console

---

## Optional: Persistent Certificate Storage

To avoid hitting Let's Encrypt rate limits on ACI restarts, mount an Azure File Share for Caddy's data directory.

**Create a storage account and file share:**
```bash
az storage account create \
  --name retrotoolcaddycerts \
  --resource-group retro-tool-api-rg \
  --location southafricanorth \
  --sku Standard_LRS

az storage share create \
  --name caddy-data \
  --account-name retrotoolcaddycerts
```

**Add to `container-instance.bicep`** — add a volume mount to the Caddy container and a volume referencing the file share so certificates persist across restarts. This prevents Caddy from requesting a new cert every time the container group restarts.

This repository now supports this natively using these parameters in `main.bicep`:

- `caddyPersistCertificates=true`
- `caddyCertStorageAccountName=<storage account name>`
- `caddyCertStorageShareName=<file share name>`
- `caddyCertStorageAccountKey=<storage account key>`

If you deploy via GitHub Actions, set these environment entries:

- Variable `CADDY_ACME_EMAIL`
- Variable `CADDY_PERSIST_CERTIFICATES` (`true`/`false`)
- Variable `CADDY_CERT_STORAGE_ACCOUNT_NAME`
- Variable `CADDY_CERT_STORAGE_SHARE_NAME`
- Secret `CADDY_CERT_STORAGE_ACCOUNT_KEY`

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `curl` to port 443 times out | Ports 80/443 not open on ACI | Check ACI public ports in Azure Portal |
| `NET::ERR_CERT_AUTHORITY_INVALID` | Caddy hasn't finished getting the cert yet | Wait 30s and retry |
| `too many certificates already issued` | Let's Encrypt rate limit hit | Wait up to 1 week or add persistent cert storage |
| WebSocket connects but drops after 30s | Request timeout too low | Not applicable with Caddy (no timeout setting needed) |
| `Mixed Content` error in browser | `VITE_CONVEX_URL` still set to `http://` or `ws://` | Update env var to `https://` and redeploy frontend |

---

## Cost Comparison

| Resource | Monthly Cost |
|---|---|
| Azure Application Gateway (Standard v2, 1 CU) | ~$125–$180 |
| Caddy sidecar (0.25 vCPU + 0.5 GB RAM added to existing ACI) | ~$3–$5 |
