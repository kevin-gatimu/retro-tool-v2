targetScope = 'resourceGroup'

param vaultName string
param location string = resourceGroup().location

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
  }
}

output vaultId string = keyVault.id
output vaultName string = keyVault.name
output vaultUri string = keyVault.properties.vaultUri
output plannedVaultName string = vaultName
output plannedLocation string = location
