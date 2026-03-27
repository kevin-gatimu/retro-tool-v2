targetScope = 'resourceGroup'

param principalId string
param roleDefinitionId string
param scope string

output plannedPrincipalId string = principalId
output plannedRoleDefinitionId string = roleDefinitionId
output plannedScope string = scope
