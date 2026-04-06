# Application Gateway SSL Setup Guide

This guide walks you through deploying Azure Application Gateway with SSL termination for your Convex backend, fixing the **Mixed Content WebSocket error** in production.

## 🔍 Problem Being Solved

Your production UI is loaded over HTTPS, but Convex backend uses HTTP WebSockets (`ws://`). Modern browsers block this as Mixed Content, preventing real-time features from working.

**Solution**: Add Application Gateway with SSL termination (HTTPS → HTTP) in front of Convex.

---

## 📋 Prerequisites

- Azure CLI installed and logged in (`az login`)
- OpenSSL installed (for certificate generation)
- PowerShell 7+ (for Windows users)
- Existing Convex Container Instance deployment

---

## 🚀 Step-by-Step Deployment

###**1. Generate Self-Signed SSL Certificate (Testing Only)**

```powershell
# Run the certificate generation script
pwsh scripts/generate-ssl-cert.ps1
```

This creates:
- `infra/ssl-certs/cert.pfx` - Certificate file
- `infra/ssl-certs/cert.b64` - Base64-encoded for Bicep
- `infra/ssl-certs/cert-password.txt` - Certificate password

⚠️ **These files are automatically git-ignored. Never commit them!**

---

### **2. Add Certificate to GitHub Secrets**

Go to your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these two secrets:

| Secret Name | Value |
|------------|-------|
| `APP_GATEWAY_SSL_CERT_DATA` | Contents of `infra/ssl-certs/cert.b64` |
| `APP_GATEWAY_SSL_CERT_PASSWORD` | Contents of `infra/ssl-certs/cert-password.txt` |

---

### **3. Update GitHub Actions Workflow**

Open `.github/workflows/deploy-infra.yml` and update the Bicep deployment step to include the new parameters:

```yaml
- name: Deploy infrastructure
  run: |
    az deployment sub create \
      --location southafricanorth \
      --template-file infra/bicep/main.bicep \
      --parameters \
        environmentName=${{ inputs.environment }} \
        postgresAdminPassword='${{ secrets.POSTGRES_ADMIN_PASSWORD }}' \
        convexInstanceSecret='${{ secrets.CONVEX_INSTANCE_SECRET }}' \
        appGatewaySslCertData='${{ secrets.APP_GATEWAY_SSL_CERT_DATA }}' \
        appGatewaySslCertPassword='${{ secrets.APP_GATEWAY_SSL_CERT_PASSWORD }}'
```

---

### **4. Deploy Infrastructure**

#### Option A: Via GitHub Actions (Recommended)

1. Go to **Actions** tab in your GitHub repository
2. Select **Deploy Infrastructure** workflow
3. Click **Run workflow**
4. Select `production` environment
5. Click **Run workflow**

#### Option B: Manual Deployment via CLI

```powershell
az deployment sub create \
  --location southafricanorth \
  --template-file infra/bicep/main.bicep \
  --parameters `
    environmentName=production `
    postgresAdminPassword='YOUR_POSTGRES_PASSWORD' `
    convexInstanceSecret='YOUR_CONVEX_SECRET' `
    appGatewaySslCertData='BASE64_CERT_FROM_cert.b64_FILE' `
    appGatewaySslCertPassword='PASSWORD_FROM_cert-password.txt_FILE'
```

⏱️ **Deployment time**: ~10-15 minutes (Application Gateway takes time to provision)

---

### **5. Get Application Gateway URL**

After deployment, get the new HTTPS URL:

```powershell
# Get Bicep deployment outputs
az deployment sub show \
  --name deploy-infrastructure \
  --query 'properties.outputs.convexSyncUrl.value' \
  -o tsv
```

Expected output:
```
https://retro-tool-production-convex-gateway.southafricanorth.cloudapp.azure.com
```

---

### **6. Update UI Environment Variables**

Update these in **Azure Static Web App Configuration** or **GitHub Secrets**:

```bash
# OLD (HTTP - causes Mixed Content error)
VITE_CONVEX_URL=http://retro-tool-production-convex.southafricanorth.azurecontainer.io:3210

# NEW (HTTPS via Application Gateway)
VITE_CONVEX_URL=https://retro-tool-production-convex-gateway.southafricanorth.cloudapp.azure.com
```

**How to update in Azure Portal:**
1. Go to Azure Portal → Static Web Apps → `retro-tool-production-ui`
2. Click **Configuration** → **Application settings**
3. Update `VITE_CONVEX_URL` to the new HTTPS URL
4. Click **Save**

**How to update in GitHub Secrets (for CI/CD):**
1. Repository → Settings → Secrets → Actions
2. Update or create `VITE_CONVEX_URL` secret
3. Redeploy UI

---

### **7. Redeploy UI**

Trigger a UI deployment to pick up the new environment variable:

```powershell
# Via GitHub Actions
# Go to Actions → Deploy UI → Run workflow → production

# Or commit/push to trigger auto-deployment
git commit --allow-empty -m "chore: update Convex URL to use HTTPS gateway"
git push
```

---

### **8. Verify It Works**

1. Open your production UI: `https://victorious-coast-026649b03.2.azurestaticapps.net`
2. Open browser DevTools → Console
3. Log in
4. ✅ **No Mixed Content errors!**
5. ✅ WebSocket connection shows: `wss://retro-tool-production-convex-gateway...`

---

## 🔒 Production Certificate (Optional - Later)

The self-signed certificate will show browser security warnings. For production, replace with a real certificate:

### Option 1: Let's Encrypt (Free, Automated - **Recommended**)

Use Azure Application Gateway's built-in managed certificate feature with a custom domain.

### Option 2: Azure Key Vault Certificate

1. Purchase/import a certificate in Azure Key Vault
2. Update Bicep to reference Key Vault:

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'your-keyvault-name'
  scope: resourceGroup('your-rg')
}

sslCertificates: [
  {
    name: 'prodCert'
    properties: {
      keyVaultSecretId: '${keyVault.properties.vaultUri}secrets/ssl-cert'
    }
  }
]
```

### Option 3: Custom Domain + Free Azure Certificate

1. Buy a domain (e.g., `convex.yourdomain.com`)
2. Add custom domain to Application Gateway
3. Enable Azure-managed certificate (free)

---

## 💰 Cost Breakdown

| Resource | Cost (Estimated) |
|----------|------------------|
| Application Gateway (Standard_v2) | ~$140/month |
| Public IP (Static) | ~$3/month |
| **Total** | **~$143/month** |

**Cost Optimization Tips:**
- Use Basic tier for dev/staging (~$50/month)
- Stop Application Gateway when not in use
- Consider Azure Front Door as alternative (similar pricing, more features)

---

## 🐛 Troubleshooting

### Issue: "Mixed Content" error still appears

**Solution**: Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: "Certificate is not trusted" warning

**Expected**: Self-signed certificates trigger this. Click "Advanced" → "Proceed anyway" for testing.  
**Fix**: Use a real certificate from Let's Encrypt or CA.

### Issue: WebSocket connection fails with 502 Bad Gateway

**Check**:
1. Convex container is running: `az container show --resource-group retro-tool-api-rg --name retro-tool-production-convex`
2. Backend health: `az network application-gateway show-backend-health --resource-group retro-tool-api-rg --name retro-tool-production-convex-gateway`

### Issue: Deployment takes too long (>20 minutes)

**Solution**: Application Gateway provisioning is slow. Cancel and retry if stuck >30 minutes.

---

## 📚 Additional Resources

- [Azure Application Gateway SSL Termination](https://learn.microsoft.com/en-us/azure/application-gateway/ssl-overview)
- [Let's Encrypt with Azure App Gateway](https://github.com/MicrosoftDocs/azure-docs/blob/main/articles/application-gateway/tutorial-ssl-cli.md)
- [WebSocket Support in App Gateway](https://learn.microsoft.com/en-us/azure/application-gateway/application-gateway-websocket)

---

## ✅ Success Checklist

- [ ] SSL certificate generated
- [ ] Certificate added to GitHub Secrets
- [ ] Infrastructure deployed with Application Gateway
- [ ] Application Gateway HTTPS URL obtained
- [ ] UI `VITE_CONVEX_URL` updated to HTTPS
- [ ] UI redeployed
- [ ] No Mixed Content errors in browser console
- [ ] WebSocket connects over `wss://` (not `ws://`)

---

**Questions?** Check the troubleshooting section or review Application Gateway logs in Azure Portal.
