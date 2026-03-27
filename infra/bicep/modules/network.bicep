targetScope = 'resourceGroup'

param vnetName string
param location string = resourceGroup().location

output plannedVnetName string = vnetName
output plannedLocation string = location
