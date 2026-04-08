// ─────────────────────────────────────────────────────────────
// Retro-Tool – Azure Infrastructure (main orchestrator)
// Deploys: PostgreSQL (shared), ACR, App Service, Static Web App
//
// Staging  → Free F1 App Service, Free SWA
// Production → Premium V4 P0V4 App Service (zone-redundant), Standard SWA
//
// All resources share a single resource group per environment:
//   retro-tool-staging-rg / retro-tool-production-rg
// ─────────────────────────────────────────────────────────────

targetScope = 'subscription'

// ───────────────── Parameters ─────────────────
@description('Environment name (e.g., staging, production)')
@allowed(['staging', 'production'])
param environmentName string

@description('Azure region for all resources')
param location string = 'uksouth'

@description('Resource group for all resources (API, UI, database, registry)')
param resourceGroupName string = 'retro-tool-${environmentName}-rg'

@description('PostgreSQL admin username')
param postgresAdminUsername string = 'pgadmin'

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

// ───────────────── Environment-derived config ─────────────────
var isProduction = environmentName == 'production'

// App Service SKU: Free F1 for staging, Premium V3 P1V3 for production (temporary fallback)
var appServiceSkuName = isProduction ? 'P1v3' : 'F1'
var appServiceSkuTier = isProduction ? 'PremiumV3' : 'Free'
var appServiceZoneRedundant = false

// Static Web App SKU: Free for staging, Standard for production
var swaSkuName = isProduction ? 'Standard' : 'Free'

// ───────────────── Naming convention ─────────────────
var prefix = 'retro-tool-${environmentName}'
var prefixClean = replace(prefix, '-', '')
var acrSuffix = substring(uniqueString(subscription().subscriptionId, resourceGroupName, environmentName), 0, 6)

var postgresServerName = '${prefix}-pg'
var acrName = '${prefixClean}acr${acrSuffix}'
var appServicePlanName = '${prefix}-plan'
var webAppName = '${prefix}-api'
var staticWebAppName = '${prefix}-ui'

var tags = {
  project: 'retro-tool'
  environment: environmentName
  managedBy: 'bicep'
  Production: 'Production'
}

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// ───────────────── Modules ─────────────────

// 1. Container Registry (shared by both environments for API images)
module acr 'modules/container-registry.bicep' = {
  name: 'deploy-acr'
  scope: rg
  params: {
    location: location
    acrName: acrName
    tags: tags
  }
}

// 2. PostgreSQL Flexible Server
// Note: both staging and production point to the same physical server via
// their DATABASE_URL secret. Run infra once; reuse the server across envs.
module postgres 'modules/postgresql-flexible-server.bicep' = {
  name: 'deploy-postgres'
  scope: rg
  params: {
    location: location
    postgresqlServerName: postgresServerName
    postgresqlAdminUsername: postgresAdminUsername
    postgresqlAdminPassword: postgresAdminPassword
    tags: tags
  }
}

// 3. App Service (NestJS API)
module appService 'modules/app-service.bicep' = {
  name: 'deploy-appservice'
  scope: rg
  params: {
    location: location
    appServicePlanName: appServicePlanName
    webAppName: webAppName
    acrLoginServer: acr.outputs.acrLoginServer
    acrName: acr.outputs.acrName
    appServicePlanSkuName: appServiceSkuName
    appServicePlanSkuTier: appServiceSkuTier
    zoneRedundant: appServiceZoneRedundant
    tags: tags
  }
}

// 4. Static Web App (React UI)
module swa 'modules/static-web-app.bicep' = {
  name: 'deploy-swa'
  scope: rg
  params: {
    location: location
    staticWebAppName: staticWebAppName
    skuName: swaSkuName
    tags: tags
  }
}

// ───────────────── Outputs ─────────────────
output acrLoginServer string = acr.outputs.acrLoginServer
output acrName string = acr.outputs.acrName
output postgresServerFqdn string = postgres.outputs.postgresqlServerFqdn
output apiUrl string = 'https://${appService.outputs.webAppDefaultHostname}'
output apiWebAppName string = appService.outputs.webAppName
output swaDefaultHostname string = 'https://${swa.outputs.staticWebAppDefaultHostname}'
output swaName string = swa.outputs.staticWebAppName
