targetScope = 'resourceGroup'

param zoneName string
param vnetId string = ''

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: zoneName
  location: 'global'
}

resource vnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = if (!empty(vnetId)) {
  name: '${zoneName}-vnet-link'
  parent: privateDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

output zoneId string = privateDnsZone.id
output zoneName string = privateDnsZone.name
output plannedZoneName string = zoneName
