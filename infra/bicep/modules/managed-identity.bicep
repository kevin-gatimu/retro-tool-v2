targetScope = 'resourceGroup'

param identityName string
param location string = resourceGroup().location

output plannedIdentityName string = identityName
output plannedLocation string = location
