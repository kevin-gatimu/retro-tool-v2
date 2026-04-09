// ─────────────────────────────────────────────────────────────
// Retro-Tool – Azure Infrastructure (main orchestrator)
// Deploys: PostgreSQL (shared), ACR, App Service, Static Web App
//
// Staging  → Free F1 App Service, Free SWA
// Production → Premium V3 P1V3 App Service (temporary fallback), Standard SWA
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
var uniqueSuffix = substring(uniqueString(subscription().subscriptionId, resourceGroupName, environmentName), 0, 6)

// westeurope is valid for SWA, but PostgreSQL can be offer-restricted there for some subscriptions.
// If location is set to westeurope, deploy core resources in uksouth while keeping SWA in westeurope.
var locationCore = toLower(location) == 'westeurope' ? 'uksouth' : location
var locationSwa = 'westeurope'

// App Service SKU: Free F1 for staging, Premium V3 P1V3 for production (temporary fallback)
var appServiceSkuName = isProduction ? 'P1v3' : 'F1'
var appServiceSkuTier = isProduction ? 'PremiumV3' : 'Free'
var appServiceZoneRedundant = false

// Static Web App SKU: Free for staging, Standard for production
var swaSkuName = isProduction ? 'Standard' : 'Free'

// ───────────────── Naming convention ─────────────────
var prefix = 'retro-tool-${environmentName}'
var prefixClean = replace(prefix, '-', '')

var postgresServerName = '${prefix}-pg-${uniqueSuffix}'
var acrName = '${prefixClean}acr${uniqueSuffix}'
var appServicePlanName = '${prefix}-plan'
var webAppName = '${prefix}-api-${uniqueSuffix}'
var staticWebAppName = '${prefix}-ui'

var tags = {
  project: 'retro-tool'
  environment: environmentName
  managedBy: 'bicep'
  Production: 'Production'
}

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: locationCore
  tags: tags
}

// ───────────────── Modules ─────────────────

// 1. Container Registry (shared by both environments for API images)
module acr 'modules/container-registry.bicep' = {
  name: 'deploy-acr'
  scope: rg
  params: {
    location: locationCore
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
    location: locationCore
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
    location: locationCore
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
    location: locationSwa
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
