targetScope = 'resourceGroup'

param registryName string
param location string = resourceGroup().location
@allowed(['Basic', 'Standard', 'Premium'])
param sku string = 'Basic'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: false
  }
}

output registryId string = acr.id
output registryName string = acr.name
output loginServer string = acr.properties.loginServer
output plannedRegistryName string = registryName
output plannedLocation string = location
