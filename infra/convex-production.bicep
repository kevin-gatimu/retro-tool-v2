targetScope = 'resourceGroup'

// Provisions the self-hosted Convex production deployment on Azure App Service
// (Web App for Containers), mirroring infra/convex-staging.bicep. Deploys into
// the existing production resource group so it sits alongside the current ACR,
// PostgreSQL Flexible Server, API App Service, and Static Web App.

@allowed([
  'production'
])
@description('The only cloud environment supported by this deployment.')
param environment string = 'production'

@description('Azure region for Convex and its data plane.')
param location string = resourceGroup().location

@description('Existing production Azure Container Registry name.')
param acrName string = 'retrotool'

@description('Existing production PostgreSQL Flexible Server name.')
param postgresServerName string = 'retro-tool-db-server'

@minLength(3)
@maxLength(24)
@description('Globally unique production storage account name for the /convex/data share.')
param convexStorageAccountName string = take('retrotoolprod${uniqueString(subscription().id, resourceGroup().id)}', 24)

@description('Pinned ACR image reference. A sha256 digest is mandatory.')
param convexImage string

@description('Stable Convex instance name; also determines the PostgreSQL database name.')
param convexInstanceName string = 'retrotool-convex-prod'

@secure()
@description('Stable high-entropy Convex instance secret.')
param convexInstanceSecret string

@secure()
@description('Dedicated PostgreSQL role URL without a database path or query string.')
param convexPostgresUrl string

@description('App Service plan SKU name. B1 is the cheapest tier supporting Always On + WebSockets.')
param planSkuName string = 'B1'

@description('App Service plan SKU tier matching planSkuName.')
param planSkuTier string = 'Basic'

@description('Optional user/service-principal object ID allowed to manage production Convex secrets.')
param bootstrapPrincipalObjectId string = ''

@allowed([
  'User'
  'ServicePrincipal'
])
param bootstrapPrincipalType string = 'User'

var prefix = 'retrotool-prod'
var unique = toLower(uniqueString(subscription().id, resourceGroup().id))
var convexDatabaseName = replace(convexInstanceName, '-', '_')
var tags = {
  environment: environment
  project: 'retro-tool'
  component: 'convex'
  managedBy: 'bicep'
}
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' existing = {
  name: postgresServerName
}

// Separate Convex database on the shared production server. The Convex owner
// role (provisioned out of band by a bootstrap job) is scoped to this database
// only and must never reach retro_tool_db.
resource convexDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: convexDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource runtimeIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-convex-identity'
  location: location
  tags: tags
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, runtimeIdentity.id, acrPullRoleId)
  scope: acr
  properties: {
    principalId: runtimeIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

module monitoring 'modules/convex-monitoring.bicep' = {
  name: 'convex-monitoring-prod'
  params: {
    location: location
    prefix: prefix
    tags: tags
  }
}

module storage 'modules/convex-storage.bicep' = {
  name: 'convex-storage-prod'
  params: {
    location: location
    storageAccountName: convexStorageAccountName
    tags: tags
  }
}

module keyVault 'modules/convex-key-vault.bicep' = {
  name: 'convex-key-vault-prod'
  params: {
    location: location
    prefix: prefix
    uniqueSuffix: unique
    runtimePrincipalId: runtimeIdentity.properties.principalId
    bootstrapPrincipalObjectId: bootstrapPrincipalObjectId
    bootstrapPrincipalType: bootstrapPrincipalType
    instanceSecret: convexInstanceSecret
    postgresUrl: convexPostgresUrl
    tags: tags
  }
}

module appService 'modules/convex-app-service.bicep' = {
  name: 'convex-app-service-prod'
  params: {
    location: location
    name: '${prefix}-convex'
    planName: '${prefix}-convex-plan'
    planSkuName: planSkuName
    planSkuTier: planSkuTier
    runtimeIdentityId: runtimeIdentity.id
    runtimeIdentityClientId: runtimeIdentity.properties.clientId
    acrLoginServer: acr.properties.loginServer
    convexImage: convexImage
    instanceName: convexInstanceName
    instanceSecretUri: keyVault.outputs.instanceSecretUri
    postgresUrlSecretUri: keyVault.outputs.postgresUrlSecretUri
    storageAccountName: storage.outputs.storageAccountName
    fileShareName: storage.outputs.shareName
    logAnalyticsWorkspaceId: monitoring.outputs.workspaceId
    tags: tags
  }
  dependsOn: [
    acrPullAssignment
  ]
}

output appServiceName string = appService.outputs.name
output appServicePlanName string = appService.outputs.planName
output convexUrl string = appService.outputs.url
output convexDatabaseName string = convexDatabase.name
output keyVaultName string = keyVault.outputs.name
output logAnalyticsWorkspaceName string = monitoring.outputs.workspaceName
output storageAccountName string = storage.outputs.storageAccountName
output storageShareName string = storage.outputs.shareName
output runtimeIdentityName string = runtimeIdentity.name
