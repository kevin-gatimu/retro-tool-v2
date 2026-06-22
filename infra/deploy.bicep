targetScope = 'subscription'

@description('Environment name (e.g. prod, staging)')
param environment string

@description('Primary Azure region for most resources')
param location string = 'southafricanorth'

@description('Region for Static Web App (not available in South Africa North)')
param staticWebAppLocation string = 'westeurope'

@description('PostgreSQL administrator login')
param postgresAdminLogin string = 'pgadmin'

@secure()
@description('PostgreSQL administrator password')
param postgresAdminPassword string

@description('Docker image name')
param dockerImageName string = 'retro-tool-api'

@description('Docker image tag')
param dockerImageTag string = 'latest'

@description('Application settings for the API App Service')
param apiAppSettings object = {}

var resourceGroupName = 'retrotool-${environment}-rg'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: {
    environment: environment
    project: 'retro-tool'
    managedBy: 'bicep'
  }
}

module resources 'main.bicep' = {
  name: 'resources-deployment'
  scope: rg
  params: {
    environment: environment
    location: location
    staticWebAppLocation: staticWebAppLocation
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
    dockerImageName: dockerImageName
    dockerImageTag: dockerImageTag
    apiAppSettings: apiAppSettings
  }
}

@description('Resource group name')
output resourceGroupName string = rg.name

@description('ACR login server — use in GitHub Actions to push images')
output acrLoginServer string = resources.outputs.acrLoginServer

@description('ACR name — needed for az acr login')
output acrName string = resources.outputs.acrName

@description('Static Web App name — use to get deployment token')
output staticWebAppName string = resources.outputs.staticWebAppName

@description('API URL — use as BETTER_AUTH_URL')
output apiUrl string = resources.outputs.apiUrl

@description('UI URL — use as FRONTEND_URL')
output uiUrl string = resources.outputs.uiUrl

@description('DATABASE_URL template — replace <password>')
output databaseUrl string = resources.outputs.databaseUrl

@description('App Service name — for az webapp commands')
output appServiceName string = resources.outputs.appServiceName

@description('Managed Identity Client ID')
output managedIdentityClientId string = resources.outputs.managedIdentityClientId
