param location string
param postgresqlServerName string
param postgresqlAdminUsername string
@secure()
param postgresqlAdminPassword string
param postgresqlVersion string = '16'
param skuName string = 'Standard_D2ds_v4'
param skuTier string = 'GeneralPurpose'
param storageGB int = 32
param backupRetentionDays int = 7
param geoRedundantBackup string = 'Disabled'
param tags object = {}

resource postgresqlServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: postgresqlServerName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: postgresqlVersion
    administratorLogin: postgresqlAdminUsername
    administratorLoginPassword: postgresqlAdminPassword
    storage: {
      storageSizeGB: storageGB
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: geoRedundantBackup
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource apiDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgresqlServer
  name: 'retro_tool_db'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allow access from Azure services (App Service, ACI migrations)
resource azureServicesFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgresqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output postgresqlServerId string = postgresqlServer.id
output postgresqlServerName string = postgresqlServer.name
output postgresqlServerFqdn string = postgresqlServer.properties.fullyQualifiedDomainName
output postgresqlPort int = 5432
output apiDatabaseName string = apiDatabase.name
