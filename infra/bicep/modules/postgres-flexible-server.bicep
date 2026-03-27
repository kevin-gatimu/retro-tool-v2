targetScope = 'resourceGroup'

param serverName string
param location string = resourceGroup().location
param administratorLogin string = 'retrotooladmin'

output plannedServerName string = serverName
output plannedLocation string = location
output plannedAdministratorLogin string = administratorLogin
