param location string
param appServicePlanName string
param webAppName string
param acrLoginServer string
param acrName string
param dockerImageAndTag string = 'retro-tool-api:latest'
param tags object = {}

// App Service Plan (Linux)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'P0v4'
    tier: 'PremiumV4'
  }
  properties: {
    reserved: true // required for Linux
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
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/health'
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
