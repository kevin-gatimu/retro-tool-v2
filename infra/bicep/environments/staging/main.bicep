targetScope = 'resourceGroup'

param location string = resourceGroup().location
param projectName string = 'retro-tool'
param environmentName string = 'staging'
@secure()
param postgresAdminPassword string

var namePrefix = '${projectName}-${environmentName}'
var compactPrefix = toLower(replace('${projectName}${environmentName}', '-', ''))

module network '../../modules/network.bicep' = {
  name: 'network'
  params: {
    vnetName: '${namePrefix}-vnet'
    location: location
  }
}

module privateDns '../../modules/private-dns.bicep' = {
  name: 'privateDns'
  params: {
    zoneName: 'privatelink.postgres.database.azure.com'
    vnetId: network.outputs.vnetId
  }
}

module acr '../../modules/acr.bicep' = {
  name: 'acr'
  params: {
    registryName: '${compactPrefix}acr'
    location: location
    sku: 'Basic'
  }
}

module logAnalytics '../../modules/log-analytics.bicep' = {
  name: 'logAnalytics'
  params: {
    workspaceName: '${namePrefix}-logs'
    location: location
    retentionInDays: 30
  }
}

module appInsights '../../modules/app-insights.bicep' = {
  name: 'appInsights'
  params: {
    appInsightsName: '${namePrefix}-appi'
    location: location
    workspaceResourceId: logAnalytics.outputs.workspaceId
  }
}

module keyVault '../../modules/keyvault.bicep' = {
  name: 'keyVault'
  params: {
    vaultName: '${namePrefix}-kv'
    location: location
  }
}

module managedIdentity '../../modules/managed-identity.bicep' = {
  name: 'managedIdentity'
  params: {
    identityName: '${namePrefix}-mi'
    location: location
  }
}

module postgres '../../modules/postgres-flexible-server.bicep' = {
  name: 'postgres'
  params: {
    serverName: '${namePrefix}-pg'
    location: location
    administratorLogin: 'retrotooladmin'
    administratorLoginPassword: postgresAdminPassword
    skuTier: 'Burstable'
    skuName: 'Standard_B1ms'
  }
}

module aks '../../modules/aks.bicep' = {
  name: 'aks'
  params: {
    clusterName: '${namePrefix}-aks'
    location: location
    nodeCount: 1
    nodeVmSize: 'Standard_B2s'
    subnetId: network.outputs.aksSubnetId
    logWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

// AcrPull: allows AKS kubelet identity to pull images from ACR
module acrPullRole '../../modules/role-assignments.bicep' = {
  name: 'acrPullRole'
  params: {
    principalId: aks.outputs.kubeletIdentityObjectId
    roleDefinitionId: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    scope: acr.outputs.registryId
  }
}

// Key Vault Secrets User: allows the managed identity to read secrets from Key Vault
module kvSecretsRole '../../modules/role-assignments.bicep' = {
  name: 'kvSecretsRole'
  params: {
    principalId: managedIdentity.outputs.principalId
    roleDefinitionId: '4633458b-17de-408a-b874-0445c86b69e0'
    scope: keyVault.outputs.vaultId
  }
}

output environment string = environmentName
output aksClusterName string = aks.outputs.clusterName
output postgresServerFqdn string = postgres.outputs.fullyQualifiedDomainName
output acrLoginServer string = acr.outputs.loginServer
output keyVaultName string = keyVault.outputs.vaultName
output keyVaultUri string = keyVault.outputs.vaultUri
output appInsightsConnectionString string = appInsights.outputs.connectionString
output managedIdentityClientId string = managedIdentity.outputs.clientId
// Legacy plain-name outputs kept for back-compat
output aksClusterNameLegacy string = aks.outputs.plannedClusterName
output postgresServerName string = postgres.outputs.serverName
output acrName string = acr.outputs.registryName
