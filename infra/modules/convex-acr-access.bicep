targetScope = 'resourceGroup'

// Grants a Convex runtime identity AcrPull on the shared ACR. Split into its
// own module (rather than an inline resource in convex-{staging,production}.
// bicep) because the assignment name must key on the identity's principal ID,
// not its resource-ID path -- otherwise, if the identity is ever deleted and
// recreated, the assignment name stays identical while the underlying
// principal ID changes, and Azure rejects that as
// RoleAssignmentUpdateNotPermitted. A resource's own "name" property must be
// computable before deployment starts, so the parent template cannot pass
// runtimeIdentity.properties.principalId directly into a sibling resource's
// name; passing it as a module parameter (resolved at the module boundary)
// works, matching convex-key-vault.bicep's role assignments.

@description('Name of the existing Container Registry to grant AcrPull on.')
param acrName string

@description('Principal ID of the identity to grant AcrPull to.')
param principalId string

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, principalId, acrPullRoleId)
  scope: acr
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}
