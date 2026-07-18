targetScope = 'resourceGroup'

// Dedicated Linux App Service (Web App for Containers) that runs the single
// self-hosted Convex backend. Kept on its own small plan so realtime load can
// never starve the NestJS API plan. One fixed worker only — the open-source
// Convex backend is a single-instance service, so scale-out / autoscale / slots
// against the live database and file share are deliberately disallowed.

param location string
param name string
param planName string
@description('App Service plan SKU name, e.g. B1, P0v3.')
param planSkuName string = 'B1'
@description('App Service plan SKU tier, e.g. Basic, PremiumV3.')
param planSkuTier string = 'Basic'
param runtimeIdentityId string
param runtimeIdentityClientId string
param acrLoginServer string
@description('Pinned ACR image reference; a sha256 digest is mandatory.')
param convexImage string
param instanceName string
@description('Key Vault secret URI for INSTANCE_SECRET.')
param instanceSecretUri string
@description('Key Vault secret URI for POSTGRES_URL.')
param postgresUrlSecretUri string
@description('Storage account holding the /convex/data file share.')
param storageAccountName string
param fileShareName string
param logAnalyticsWorkspaceId string
param tags object

// Convex derives its public origin from the App Service default hostname. Only
// port 3210 is routed publicly; the repo defines no httpAction, so 3211 stays
// internal and the dashboard (6791) is never exposed.
var defaultHostName = '${name}.azurewebsites.net'
var publicOrigin = 'https://${defaultHostName}'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: planSkuName
    tier: planSkuTier
  }
  properties: {
    reserved: true
    zoneRedundant: false
  }
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${runtimeIdentityId}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    // Resolve @Microsoft.KeyVault app-setting references with the assigned
    // user-assigned identity (which holds Key Vault Secrets User on the vault).
    keyVaultReferenceIdentity: runtimeIdentityId
    siteConfig: {
      linuxFxVersion: 'DOCKER|${convexImage}'
      acrUseManagedIdentityCreds: true
      acrUserManagedIdentityID: runtimeIdentityClientId
      alwaysOn: true
      http20Enabled: true
      webSocketsEnabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      // /version proves process readiness; App Service pulls unhealthy instances
      // and an external authenticated WSS synthetic covers end-to-end health.
      healthCheckPath: '/version'
      numberOfWorkers: 1
      appSettings: [
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acrLoginServer}'
        }
        // The Convex data lives on the mounted Azure Files share, never on the
        // App Service /home volume.
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'WEBSITES_PORT'
          value: '3210'
        }
        {
          name: 'WEBSITE_WARMUP_PATH'
          value: '/version'
        }
        {
          name: 'WEBSITES_CONTAINER_START_TIME_LIMIT'
          value: '600'
        }
        {
          name: 'INSTANCE_NAME'
          value: instanceName
        }
        {
          name: 'INSTANCE_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${instanceSecretUri})'
        }
        {
          name: 'POSTGRES_URL'
          value: '@Microsoft.KeyVault(SecretUri=${postgresUrlSecretUri})'
        }
        {
          name: 'CONVEX_CLOUD_ORIGIN'
          value: publicOrigin
        }
        {
          name: 'CONVEX_SITE_ORIGIN'
          value: publicOrigin
        }
        // TLS to PostgreSQL must stay required in Azure.
        {
          name: 'DO_NOT_REQUIRE_SSL'
          value: 'false'
        }
        {
          name: 'DISABLE_BEACON'
          value: 'true'
        }
        {
          name: 'RUST_LOG'
          value: 'info'
        }
      ]
    }
  }
}

// Bring-your-own-storage mount. App Service authenticates the SMB mount with the
// storage account key (Entra ID / RBAC is not supported for mounts), so the key
// is read at deploy time via listKeys() and never emitted as an output.
resource storageMount 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: site
  name: 'azurestorageaccounts'
  properties: {
    'convex-data': {
      type: 'AzureFiles'
      accountName: storageAccountName
      shareName: fileShareName
      accessKey: storageAccount.listKeys().keys[0].value
      mountPath: '/convex/data'
    }
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: site
  name: 'convex-diagnostics'
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
      }
      {
        category: 'AppServicePlatformLogs'
        enabled: true
      }
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output name string = site.name
output planName string = plan.name
output defaultHostName string = defaultHostName
output url string = publicOrigin
