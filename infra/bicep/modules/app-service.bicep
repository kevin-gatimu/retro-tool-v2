param location string
param appServicePlanName string
param webAppName string
param acrLoginServer string
param acrName string
param dockerImageAndTag string = 'retro-tool-api:latest'
param tags object = {}

@description('App Service Plan SKU name. Use F1 for staging, P0v4 for production.')
param appServicePlanSkuName string = 'P0v4'

@description('App Service Plan SKU tier. Use Free for staging, PremiumV4 for production.')
param appServicePlanSkuTier string = 'PremiumV4'

@description('Enable zone redundancy (production only — not supported on Free tier).')
param zoneRedundant bool = false

// alwaysOn is not supported on the Free (F1) tier
var alwaysOn = appServicePlanSkuTier != 'Free'

// App Service Plan (Linux)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: appServicePlanSkuName
    tier: appServicePlanSkuTier
  }
  properties: {
    reserved: true // required for Linux
    zoneRedundant: zoneRedundant
  }
}

// Web App
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/${dockerImageAndTag}'
      alwaysOn: alwaysOn
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: alwaysOn ? '/health' : null
      appSettings: [
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acrLoginServer}'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8000'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
      ]
    }
  }
}

// Grant ACR pull to the Web App's managed identity
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(webApp.id, 'acrpull', acrName)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull
    )
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output webAppId string = webApp.id
output webAppName string = webApp.name
output webAppDefaultHostname string = webApp.properties.defaultHostName
output webAppPrincipalId string = webApp.identity.principalId
output appServicePlanId string = appServicePlan.id
