param location string
param appServicePlanName string
param webAppName string
param tags object = {}

@description('App Service Plan SKU name. Use F1 for staging, S1 for production.')
param appServicePlanSkuName string = 'S1'

@description('App Service Plan SKU tier. Use Free for staging, Standard for production.')
param appServicePlanSkuTier string = 'Standard'

@description('Enable zone redundancy (not supported on Free or Standard tier).')
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

// Web App — code deploy via zip/run-from-package
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  tags: tags
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: alwaysOn
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: alwaysOn ? '/health' : null
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
      ]
    }
  }
}

output webAppId string = webApp.id
output webAppName string = webApp.name
output webAppDefaultHostname string = webApp.properties.defaultHostName
output appServicePlanId string = appServicePlan.id
