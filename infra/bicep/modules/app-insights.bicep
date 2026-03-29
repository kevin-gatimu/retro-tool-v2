targetScope = 'resourceGroup'

param appInsightsName string
param location string = resourceGroup().location
param workspaceResourceId string

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspaceResourceId
  }
}

output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name
output instrumentationKey string = appInsights.properties.InstrumentationKey
output connectionString string = appInsights.properties.ConnectionString
output plannedAppInsightsName string = appInsightsName
output plannedWorkspaceResourceId string = workspaceResourceId
output plannedLocation string = location
