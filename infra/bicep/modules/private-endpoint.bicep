targetScope = 'resourceGroup'

param endpointName string
param location string = resourceGroup().location
param subnetResourceId string
param targetResourceId string
param groupId string = 'postgresqlServer'
param privateDnsZoneId string = ''

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: endpointName
  location: location
  properties: {
    subnet: {
      id: subnetResourceId
    }
    privateLinkServiceConnections: [
      {
        name: endpointName
        properties: {
          privateLinkServiceId: targetResourceId
          groupIds: [groupId]
        }
      }
    ]
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = if (!empty(privateDnsZoneId)) {
  name: 'default'
  parent: privateEndpoint
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config1'
        properties: {
          privateDnsZoneId: privateDnsZoneId
        }
      }
    ]
  }
}

output endpointId string = privateEndpoint.id
output endpointName string = privateEndpoint.name
output plannedEndpointName string = endpointName
output plannedLocation string = location
output plannedSubnetResourceId string = subnetResourceId
output plannedTargetResourceId string = targetResourceId
