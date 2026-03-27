targetScope = 'resourceGroup'

param endpointName string
param location string = resourceGroup().location
param subnetResourceId string = ''
param targetResourceId string = ''

output plannedEndpointName string = endpointName
output plannedLocation string = location
output plannedSubnetResourceId string = subnetResourceId
output plannedTargetResourceId string = targetResourceId
