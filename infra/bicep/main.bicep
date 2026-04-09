// ─────────────────────────────────────────────────────────────
// Retro-Tool – Azure Infrastructure (main orchestrator)
// Deploys: PostgreSQL, App Service (code deploy), Static Web App
//
// Staging  → Free F1 App Service, Free SWA
// Production → Standard S1 App Service, Standard SWA
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
param location string = 'eastus2'

@description('Resource group for all resources (API, UI, database)')
param resourceGroupName string = 'retro-tool-${environmentName}-rg'

@description('PostgreSQL admin username')
param postgresAdminUsername string = 'pgadmin'

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

// ───────────────── Environment-derived config ─────────────────
var isProduction = environmentName == 'production'
var uniqueSuffix = substring(uniqueString(subscription().subscriptionId, resourceGroupName, environmentName), 0, 6)

// App Service SKU: Free F1 for staging, Standard S1 for production
var appServiceSkuName = isProduction ? 'S1' : 'F1'
var appServiceSkuTier = isProduction ? 'Standard' : 'Free'

// Static Web App SKU: Free for staging, Standard for production
var swaSkuName = isProduction ? 'Standard' : 'Free'

// ───────────────── Naming convention ─────────────────
var prefix = 'retro-tool-${environmentName}'

var postgresServerName = '${prefix}-pg-${uniqueSuffix}'
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
  location: location
  tags: tags
}

// ───────────────── Modules ─────────────────

// 1. PostgreSQL Flexible Server
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

// 2. App Service (NestJS API — code deploy via zip)
module appService 'modules/app-service.bicep' = {
  name: 'deploy-appservice'
  scope: rg
  params: {
    location: location
    appServicePlanName: appServicePlanName
    webAppName: webAppName
    appServicePlanSkuName: appServiceSkuName
    appServicePlanSkuTier: appServiceSkuTier
    tags: tags
  }
}

// 3. Static Web App (React UI)
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
output postgresServerFqdn string = postgres.outputs.postgresqlServerFqdn
output apiUrl string = 'https://${appService.outputs.webAppDefaultHostname}'
output apiWebAppName string = appService.outputs.webAppName
output swaDefaultHostname string = 'https://${swa.outputs.staticWebAppDefaultHostname}'
output swaName string = swa.outputs.staticWebAppName
