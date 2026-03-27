targetScope = 'resourceGroup'

param appInsightsName string
param location string = resourceGroup().location
param workspaceResourceId string = ''

output plannedAppInsightsName string = appInsightsName
output plannedWorkspaceResourceId string = workspaceResourceId
output plannedLocation string = location
