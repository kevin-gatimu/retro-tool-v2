targetScope = 'resourceGroup'

param registryName string
param location string = resourceGroup().location

output plannedRegistryName string = registryName
output plannedLocation string = location