targetScope = 'resourceGroup'

param identityName string
param location string = resourceGroup().location

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

output identityId string = identity.id
output identityName string = identity.name
output principalId string = identity.properties.principalId
output clientId string = identity.properties.clientId
output plannedIdentityName string = identityName
output plannedLocation string = location
