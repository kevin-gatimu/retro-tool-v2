targetScope = 'resourceGroup'

param workspaceName string
param location string = resourceGroup().location

output plannedWorkspaceName string = workspaceName
output plannedLocation string = location
