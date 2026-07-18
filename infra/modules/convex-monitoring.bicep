targetScope = 'resourceGroup'

// Minimal Log Analytics workspace for Convex App Service diagnostics. Kept small
// and pay-as-you-go (PerGB2018, 30-day retention) to stay cost-effective; scale
// retention/alerts up only when measured operations justify it.

param location string
param prefix string
param tags object

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-convex-logs'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      // Cap ingestion is not set here; keep the workspace lean by only sending
      // Convex App Service diagnostic categories to it.
      searchVersion: 1
    }
  }
}

output workspaceId string = logAnalytics.id
output workspaceName string = logAnalytics.name
