targetScope = 'resourceGroup'

// ──────────────────────────────────────────────
// Parameters
// ──────────────────────────────────────────────

@description('Environment name (e.g. prod, staging)')
param environment string

@description('Primary Azure region for most resources')
param location string = 'southafricanorth'

@description('Region for Static Web App (not available in South Africa North)')
param staticWebAppLocation string = 'westeurope'

@description('PostgreSQL administrator login')
param postgresAdminLogin string = 'pgadmin'

@secure()
@description('PostgreSQL administrator password')
param postgresAdminPassword string

@description('Docker image name')
param dockerImageName string = 'retro-tool-api'

@description('Docker image tag')
param dockerImageTag string = 'latest'

@description('Application settings for the API App Service')
param apiAppSettings object = {}

// ──────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────

var prefix = 'retrotool-${environment}'
var acrName = replace('${prefix}acr', '-', '')
var tags = {
  environment: environment
  project: 'retro-tool'
  managedBy: 'bicep'
}
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

// ──────────────────────────────────────────────
// 1. Container Registry
// ──────────────────────────────────────────────

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

// ──────────────────────────────────────────────
// 2. User-Assigned Managed Identity
// ──────────────────────────────────────────────

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-identity'
  location: location
  tags: tags
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identity.id, acrPullRoleId)
  scope: acr
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

// ──────────────────────────────────────────────
// 3. PostgreSQL Flexible Server
// ──────────────────────────────────────────────

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: '${prefix}-db'
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '17'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
      tier: 'P4'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource postgresFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: 'retro_tool_db'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ──────────────────────────────────────────────
// 4. App Service Plan
// ──────────────────────────────────────────────

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-plan'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'P0v3'
    tier: 'PremiumV3'
  }
  properties: {
    reserved: true
    zoneRedundant: false
  }
}

// ──────────────────────────────────────────────
// 5. App Service (Containers)
// ──────────────────────────────────────────────

var baseAppSettings = [
  { name: 'DOCKER_REGISTRY_SERVER_URL', value: 'https://${acr.properties.loginServer}' }
  { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
]

var customAppSettings = [for item in items(apiAppSettings): {
  name: item.key
  value: item.value
}]

resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-api'
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${dockerImageName}:${dockerImageTag}'
      acrUseManagedIdentityCreds: true
      acrUserManagedIdentityID: identity.properties.clientId
      alwaysOn: true
      http20Enabled: true
      webSocketsEnabled: true
      // Pin the minimum TLS version and disable FTPS so posture is explicit and
      // resistant to platform-default drift (SECURITY-ASSESSMENT F12).
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: concat(baseAppSettings, customAppSettings)
    }
  }
}

// ──────────────────────────────────────────────
// 6. Static Web App
// ──────────────────────────────────────────────

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${prefix}-ui'
  location: staticWebAppLocation
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

// --- CI/CD: Docker image push ---
@description('ACR login server — use in GitHub Actions to push images')
output acrLoginServer string = acr.properties.loginServer

@description('ACR name — needed for `az acr login` and role assignments')
output acrName string = acr.name

// --- CI/CD: Static Web App deployment ---
@description('Static Web App name — use to retrieve deployment token: az staticwebapp secrets list --name <this>')
output staticWebAppName string = staticWebApp.name

// --- App URLs (for env vars) ---
@description('API URL — use as BETTER_AUTH_URL and for CORS')
output apiUrl string = 'https://${appService.properties.defaultHostName}'

@description('UI URL — use as FRONTEND_URL in API env vars')
output uiUrl string = 'https://${staticWebApp.properties.defaultHostname}'

// --- Database ---
@description('DATABASE_URL template — replace <password> with the actual admin password')
output databaseUrl string = 'postgresql://${postgresAdminLogin}:<password>@${postgres.properties.fullyQualifiedDomainName}:5432/retro_tool_db?sslmode=require'

// --- Identity ---
@description('Managed Identity Client ID (already configured on App Service)')
output managedIdentityClientId string = identity.properties.clientId

@description('App Service name — needed for `az webapp deploy` or restart commands')
output appServiceName string = appService.name
