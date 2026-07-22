targetScope = 'resourceGroup'

// Provisions the single self-hosted Convex staging deployment on Azure App
// Service (Web App for Containers), per docs/CONVEX-AZURE-SELF-HOSTING-PLAN.md.
// This is the only cloud Convex deployment; development stays on local Docker.
// Deploy into the existing staging resource group so it sits alongside the
// current ACR, PostgreSQL Flexible Server, API App Service, and Static Web App.

@allowed([
  'staging'
])
@description('The only cloud environment supported by this deployment.')
param environment string = 'staging'

@description('Azure region for Convex and its data plane.')
param location string = resourceGroup().location

@description('Existing staging Azure Container Registry name.')
param acrName string = 'retrotoolstagingacr'

@description('Existing staging PostgreSQL Flexible Server name.')
param postgresServerName string = 'retrotool-staging-db'

@minLength(3)
@maxLength(24)
@description('Globally unique staging storage account name for the /convex/data share.')
param convexStorageAccountName string = take('retrotoolstaging${uniqueString(subscription().id, resourceGroup().id)}', 24)

@description('Pinned ACR image reference. A sha256 digest is mandatory.')
param convexImage string

@description('Stable Convex instance name; also determines the PostgreSQL database name.')
param convexInstanceName string = 'retrotool-convex-staging'

@secure()
@description('Stable high-entropy Convex instance secret.')
param convexInstanceSecret string

@secure()
@description('Dedicated PostgreSQL role URL without a database path or query string.')
param convexPostgresUrl string

@description('Existing staging API App Service plan — Convex runs on this same plan instead of a dedicated one. Both are B1 Basic, so sharing it costs nothing extra.')
param apiAppServicePlanName string = 'retrotool-staging-plan'

@description('Optional user/service-principal object ID allowed to manage staging Convex secrets.')
param bootstrapPrincipalObjectId string = ''

@allowed([
  'User'
  'ServicePrincipal'
])
param bootstrapPrincipalType string = 'User'

var prefix = 'retrotool-${environment}'
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

// Shared with the API instead of a dedicated plan — both are B1 Basic, so
// there is no cost to reusing it.
resource apiPlan 'Microsoft.Web/serverfarms@2023-12-01' existing = {
  name: apiAppServicePlanName
}

// Separate Convex database on the shared staging server. The Convex owner role
// (provisioned out of band by a bootstrap job) is scoped to this database only
// and must never reach retro_tool_db.
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

// Keyed on the identity's resource-ID path (stable across redeploys), not its
// principal ID -- Azure RBAC itself enforces uniqueness on
// (principal, role, scope), so naming this by principal ID instead breaks the
// normal case: it makes Bicep try to create a second assignment for a
// permission that already exists, failing with RoleAssignmentExists. The
// tradeoff: if runtimeIdentity is ever deleted and recreated, its principal ID
// changes while this assignment's name stays the same, and Azure rejects the
// update as RoleAssignmentUpdateNotPermitted. Recover by deleting the stale
// assignment first (find it via `az rest --method get --url
// "https://management.azure.com/<acr-resource-id>/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01"`,
// then `az rest --method delete` on the stale entry's id), then redeploy.
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
  name: 'convex-monitoring'
  params: {
    location: location
    prefix: prefix
    tags: tags
  }
}

module storage 'modules/convex-storage.bicep' = {
  name: 'convex-storage'
  params: {
    location: location
    storageAccountName: convexStorageAccountName
    tags: tags
  }
}

module keyVault 'modules/convex-key-vault.bicep' = {
  name: 'convex-key-vault'
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
  name: 'convex-app-service'
  params: {
    location: location
    name: '${prefix}-convex'
    existingPlanResourceId: apiPlan.id
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
output appServicePlanResourceId string = appService.outputs.planResourceId
output convexUrl string = appService.outputs.url
output convexDatabaseName string = convexDatabase.name
output keyVaultName string = keyVault.outputs.name
output logAnalyticsWorkspaceName string = monitoring.outputs.workspaceName
output storageAccountName string = storage.outputs.storageAccountName
output storageShareName string = storage.outputs.shareName
output runtimeIdentityName string = runtimeIdentity.name
