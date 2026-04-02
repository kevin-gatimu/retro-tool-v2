// ─────────────────────────────────────────────────────────────
// Retro-Tool – Azure Infrastructure (main orchestrator)
// Deploys: PostgreSQL, ACR, App Service, Container Instance,
//          Static Web App, Key Vault
// ─────────────────────────────────────────────────────────────

targetScope = 'resourceGroup'

// ───────────────── Parameters ─────────────────
@description('Environment name (e.g., staging, production)')
@allowed(['staging', 'production'])
param environmentName string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('PostgreSQL admin username')
param postgresAdminUsername string = 'pgadmin'

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

@description('Convex instance name')
param convexInstanceName string = 'retro-convex-${environmentName}'

@description('Convex instance secret (64-char hex)')
@secure()
param convexInstanceSecret string

// ───────────────── Naming convention ─────────────────
var prefix = 'retro-tool-${environmentName}'
var prefixClean = replace(prefix, '-', '')

var postgresServerName = '${prefix}-pg'
var acrName = '${prefixClean}acr'
var keyVaultName = '${prefixClean}kv'
var appServicePlanName = '${prefix}-plan'
var webAppName = '${prefix}-api'
var containerGroupName = '${prefix}-convex'
var staticWebAppName = '${prefix}-ui'

var tags = {
  project: 'retro-tool'
  environment: environmentName
  managedBy: 'bicep'
}

// ───────────────── Modules ─────────────────

// 1. Container Registry
module acr 'modules/container-registry.bicep' = {
  name: 'deploy-acr'
  params: {
    location: location
    acrName: acrName
    tags: tags
  }
}

// 2. Key Vault
module kv 'modules/key-vault.bicep' = {
  name: 'deploy-keyvault'
  params: {
    location: location
    keyVaultName: keyVaultName
    tenantId: subscription().tenantId
    tags: tags
  }
}

// 3. PostgreSQL Flexible Server
module postgres 'modules/postgresql-flexible-server.bicep' = {
  name: 'deploy-postgres'
  params: {
    location: location
    postgresqlServerName: postgresServerName
    postgresqlAdminUsername: postgresAdminUsername
    postgresqlAdminPassword: postgresAdminPassword
    tags: tags
  }
}

// 4. App Service (API)
module appService 'modules/app-service.bicep' = {
  name: 'deploy-appservice'
  params: {
    location: location
    appServicePlanName: appServicePlanName
    webAppName: webAppName
    acrLoginServer: acr.outputs.acrLoginServer
    acrName: acr.outputs.acrName
    tags: tags
  }
}

// 5. Container Instance (Convex)
// ACR credentials are looked up directly via the resource
resource acrRef 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
  dependsOn: [acr]
}

module convex 'modules/container-instance.bicep' = {
  name: 'deploy-convex-aci'
  params: {
    location: location
    containerGroupName: containerGroupName
    acrLoginServer: acr.outputs.acrLoginServer
    acrUsername: acrName
    acrPassword: acrRef.listCredentials().passwords[0].value
    convexInstanceName: convexInstanceName
    convexInstanceSecret: convexInstanceSecret
    convexPostgresUrl: 'postgresql://${postgresAdminUsername}:${postgresAdminPassword}@${postgres.outputs.postgresqlServerFqdn}:5432?sslmode=require'
    tags: tags
  }
}

// 6. Static Web App (UI)
module swa 'modules/static-web-app.bicep' = {
  name: 'deploy-swa'
  params: {
    location: location
    staticWebAppName: staticWebAppName
    tags: tags
  }
}

// ───────────────── Store secrets in Key Vault ─────────────────
resource kvDirect 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
  dependsOn: [kv]
}

resource secretPostgresPassword 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kvDirect
  name: 'postgres-admin-password'
  properties: {
    value: postgresAdminPassword
  }
}

resource secretConvexInstanceSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kvDirect
  name: 'convex-instance-secret'
  properties: {
    value: convexInstanceSecret
  }
}

// Grant API Web App's managed identity Key Vault Secrets User role
resource kvSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultName, webAppName, 'kv-secrets-user')
  scope: kvDirect
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User
    )
    principalId: appService.outputs.webAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ───────────────── Outputs ─────────────────
output acrLoginServer string = acr.outputs.acrLoginServer
output acrName string = acr.outputs.acrName
output postgresServerFqdn string = postgres.outputs.postgresqlServerFqdn
output apiUrl string = 'https://${appService.outputs.webAppDefaultHostname}'
output apiWebAppName string = appService.outputs.webAppName
output convexFqdn string = convex.outputs.containerGroupFqdn
output convexSyncUrl string = 'http://${convex.outputs.containerGroupFqdn}:3210'
output swaDefaultHostname string = 'https://${swa.outputs.staticWebAppDefaultHostname}'
output swaName string = swa.outputs.staticWebAppName
output keyVaultName string = kv.outputs.keyVaultName
output keyVaultUri string = kv.outputs.keyVaultUri
