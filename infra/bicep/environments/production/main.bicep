targetScope = 'resourceGroup'

param location string = resourceGroup().location
param projectName string = 'retro-tool'
param environmentName string = 'production'

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
  }
}

module acr '../../modules/acr.bicep' = {
  name: 'acr'
  params: {
    registryName: '${compactPrefix}acr'
    location: location
  }
}

module logAnalytics '../../modules/log-analytics.bicep' = {
  name: 'logAnalytics'
  params: {
    workspaceName: '${namePrefix}-logs'
    location: location
  }
}

module appInsights '../../modules/app-insights.bicep' = {
  name: 'appInsights'
  params: {
    appInsightsName: '${namePrefix}-appi'
    location: location
    workspaceResourceId: ''
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
  }
}

module aks '../../modules/aks.bicep' = {
  name: 'aks'
  params: {
    clusterName: '${namePrefix}-aks'
    location: location
  }
}

output environment string = environmentName
output aksClusterName string = aks.outputs.plannedClusterName
output postgresServerName string = postgres.outputs.plannedServerName
output acrName string = acr.outputs.plannedRegistryName
