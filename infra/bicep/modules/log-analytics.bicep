targetScope = 'resourceGroup'

param workspaceName string
param location string = resourceGroup().location
param retentionInDays int = 30

resource workspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: workspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
  }
}

output workspaceId string = workspace.id
output workspaceName string = workspace.name
output plannedWorkspaceName string = workspaceName
output plannedWorkspaceResourceId string = workspace.id
output plannedLocation string = location
