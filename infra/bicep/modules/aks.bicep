targetScope = 'resourceGroup'

param clusterName string
param location string = resourceGroup().location

output plannedClusterName string = clusterName
output plannedLocation string = location
