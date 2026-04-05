param location string
param postgresqlServerName string
param postgresqlAdminUsername string
@secure()
param postgresqlAdminPassword string
param postgresqlVersion string = '16'
param skuName string = 'Standard_B2s'
param skuTier string = 'Burstable'
param storageGB int = 32
param backupRetentionDays int = 7
param geoRedundantBackup string = 'Disabled'
param tags object = {}
param convexAciIp string = ''

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

// Create api_db database
resource apiDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgresqlServer
  name: 'retro_tool_db'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allow access from Azure services
resource azureServicesFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgresqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Allow access from Convex ACI (static public IP)
resource convexAciFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = if (!empty(convexAciIp)) {
  parent: postgresqlServer
  name: 'AllowConvexACI'
  properties: {
    startIpAddress: convexAciIp
    endIpAddress: convexAciIp
  }
}

output postgresqlServerId string = postgresqlServer.id
output postgresqlServerName string = postgresqlServer.name
output postgresqlServerFqdn string = postgresqlServer.properties.fullyQualifiedDomainName
output postgresqlPort int = 5432
output apiDatabaseName string = apiDatabase.name
