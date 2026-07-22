targetScope = 'resourceGroup'

// Azure Files share that App Service mounts at /convex/data. The self-hosted
// Convex backend stores deployed modules, snapshot import/export, files, and
// search artifacts on this filesystem, so the share must outlive container
// restarts, image swaps, and plan resizes.

param location string
@minLength(3)
@maxLength(24)
param storageAccountName string
@description('File share quota in GiB.')
param shareQuotaGb int = 32
param tags object

var shareName = 'convex-data'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    allowBlobPublicAccess: false
    // App Service BYOS mounts authenticate with the storage account key only;
    // Entra ID / RBAC is not supported for the mount, so shared-key access must
    // stay enabled.
    allowSharedKeyAccess: true
    defaultToOAuthAuthentication: false
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    shareDeleteRetentionPolicy: {
      enabled: true
      days: 14
    }
  }
}

resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  parent: fileService
  name: shareName
  properties: {
    accessTier: 'TransactionOptimized'
    enabledProtocols: 'SMB'
    shareQuota: shareQuotaGb
  }
}

output storageAccountName string = storageAccount.name
output shareName string = fileShare.name
