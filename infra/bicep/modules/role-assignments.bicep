targetScope = 'resourceGroup'

param principalId string
param roleDefinitionId string
// Descriptive label — actual scope is the resource group (see README for narrowing to resource-level)
param scope string = resourceGroup().id

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(principalId, roleDefinitionId, scope)
  properties: {
    principalId: principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalType: 'ServicePrincipal'
  }
}

output roleAssignmentId string = roleAssignment.id
output plannedPrincipalId string = principalId
output plannedRoleDefinitionId string = roleDefinitionId
output plannedScope string = scope
