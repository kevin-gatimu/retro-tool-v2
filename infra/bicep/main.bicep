// ─────────────────────────────────────────────────────────────
// Retro-Tool – Azure Infrastructure (main orchestrator)
// Deploys: PostgreSQL, ACR, App Service, Container Instance,
//          Static Web App
// ─────────────────────────────────────────────────────────────

targetScope = 'subscription'

// ───────────────── Parameters ─────────────────
@description('Environment name (e.g., staging, production)')
@allowed(['staging', 'production'])
param environmentName string

@description('Azure region for core resources (ACR, App Service, Postgres, ACI)')
param locationCore string = 'southafricanorth'

@description('Azure region for Static Web App (SWA)')
param locationSwa string = 'westeurope'

@description('Resource group for API/core resources')
param apiResourceGroupName string = 'retro-tool-api-rg'

@description('Resource group for UI resources')
param uiResourceGroupName string = 'retro-tool-ui-rg'

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

@description('Static public IP of the Convex ACI — add to PostgreSQL firewall. Find with: az container show --resource-group retro-tool-api-rg --name retro-tool-production-convex --query "ipAddress.ip" -o tsv')
param convexAciIp string = ''

// ───────────────── Naming convention ─────────────────
var prefix = 'retro-tool-${environmentName}'
var prefixClean = replace(prefix, '-', '')

var postgresServerName = '${prefix}-pg'
var acrName = '${prefixClean}acr'
var appServicePlanName = '${prefix}-plan'
var webAppName = '${prefix}-api'
var containerGroupName = '${prefix}-convex'
var staticWebAppName = '${prefix}-ui'

var tags = {
  project: 'retro-tool'
  environment: environmentName
  managedBy: 'bicep'
}

resource apiRg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: apiResourceGroupName
  location: locationCore
  tags: tags
}

resource uiRg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: uiResourceGroupName
  location: locationSwa
  tags: tags
}

// ───────────────── Modules ─────────────────

// 1. Container Registry
module acr 'modules/container-registry.bicep' = {
  name: 'deploy-acr'
  scope: apiRg
  params: {
    location: locationCore
    acrName: acrName
    tags: tags
  }
}

// 2. PostgreSQL Flexible Server
module postgres 'modules/postgresql-flexible-server.bicep' = {
  name: 'deploy-postgres'
  scope: apiRg
  params: {
    location: locationCore
    postgresqlServerName: postgresServerName
    postgresqlAdminUsername: postgresAdminUsername
    postgresqlAdminPassword: postgresAdminPassword
    convexAciIp: convexAciIp
    convexDatabaseName: replace(convexInstanceName, '-', '_')
    tags: tags
  }
}

// 3. App Service (API)
module appService 'modules/app-service.bicep' = {
  name: 'deploy-appservice'
  scope: apiRg
  params: {
    location: locationCore
    appServicePlanName: appServicePlanName
    webAppName: webAppName
    acrLoginServer: acr.outputs.acrLoginServer
    acrName: acr.outputs.acrName
    tags: tags
  }
}

// 4. Container Instance (Convex)
// ACR credentials are looked up directly via the resource
resource acrRef 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
  scope: apiRg
  dependsOn: [acr]
}

module convex 'modules/container-instance.bicep' = {
  name: 'deploy-convex-aci'
  scope: apiRg
  params: {
    location: locationCore
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

// 5. Static Web App (UI)
module swa 'modules/static-web-app.bicep' = {
  name: 'deploy-swa'
  scope: uiRg
  params: {
    location: locationSwa
    staticWebAppName: staticWebAppName
    tags: tags
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
