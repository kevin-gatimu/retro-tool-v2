targetScope = 'resourceGroup'

param vnetName string
param location string = resourceGroup().location
param aksSubnetName string = 'aks-subnet'
param dbSubnetName string = 'db-subnet'

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [
      {
        name: aksSubnetName
        properties: {
          addressPrefix: '10.0.0.0/22'
        }
      }
      {
        name: dbSubnetName
        properties: {
          addressPrefix: '10.0.4.0/24'
          delegations: [
            {
              name: 'Microsoft.DBforPostgreSQL.flexibleServers'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
    ]
  }
}

output vnetId string = vnet.id
output vnetName string = vnet.name
output aksSubnetId string = vnet.properties.subnets[0].id
output dbSubnetId string = vnet.properties.subnets[1].id
output plannedVnetName string = vnetName
output plannedLocation string = location
