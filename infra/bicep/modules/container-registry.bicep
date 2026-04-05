param location string
param acrName string
param tags object = {}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Premium'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
    policies: {
      retentionPolicy: {
        days: 30
        status: 'enabled'
      }
    }
  }
}

output acrId string = containerRegistry.id
output acrLoginServer string = containerRegistry.properties.loginServer
output acrName string = containerRegistry.name
