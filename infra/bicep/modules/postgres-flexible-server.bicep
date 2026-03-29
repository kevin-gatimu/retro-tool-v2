targetScope = 'resourceGroup'

param serverName string
param location string = resourceGroup().location
param administratorLogin string = 'retrotooladmin'
@secure()
param administratorLoginPassword string
@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param skuTier string = 'Burstable'
param skuName string = 'Standard_B1ms'
param storageSizeGB int = 32
param postgresVersion string = '16'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    version: postgresVersion
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

output serverId string = postgresServer.id
output serverName string = postgresServer.name
output fullyQualifiedDomainName string = postgresServer.properties.fullyQualifiedDomainName
output plannedServerName string = serverName
output plannedLocation string = location
output plannedAdministratorLogin string = administratorLogin
