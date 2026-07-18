targetScope = 'resourceGroup'

param location string
param prefix string
param uniqueSuffix string
param runtimePrincipalId string
param bootstrapPrincipalObjectId string
param bootstrapPrincipalType string
@secure()
param instanceSecret string
@secure()
param postgresUrl string
param tags object

var vaultName = take('${prefix}-cvx-${uniqueSuffix}', 24)
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var keyVaultSecretsOfficerRoleId = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
var instanceSecretName = 'convex-instance-secret'
var postgresUrlSecretName = 'convex-postgres-url'

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 14
    publicNetworkAccess: 'Enabled'
  }
}

resource runtimeSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, runtimePrincipalId, keyVaultSecretsUserRoleId)
  scope: vault
  properties: {
    principalId: runtimePrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
  }
}

resource bootstrapSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(bootstrapPrincipalObjectId)) {
  name: guid(vault.id, bootstrapPrincipalObjectId, keyVaultSecretsOfficerRoleId)
  scope: vault
  properties: {
    principalId: bootstrapPrincipalObjectId
    principalType: bootstrapPrincipalType
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsOfficerRoleId)
  }
}

resource instanceSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: instanceSecretName
  properties: {
    value: instanceSecret
  }
}

resource postgresUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: postgresUrlSecretName
  properties: {
    value: postgresUrl
  }
}

output name string = vault.name
output instanceSecretUri string = 'https://${vault.name}${environment().suffixes.keyvaultDns}/secrets/${instanceSecretResource.name}'
output postgresUrlSecretUri string = 'https://${vault.name}${environment().suffixes.keyvaultDns}/secrets/${postgresUrlSecret.name}'
