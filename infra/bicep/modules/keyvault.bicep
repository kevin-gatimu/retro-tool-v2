targetScope = 'resourceGroup'

param vaultName string
param location string = resourceGroup().location

output plannedVaultName string = vaultName
output plannedLocation string = location
