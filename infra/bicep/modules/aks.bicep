targetScope = 'resourceGroup'

param clusterName string
param location string = resourceGroup().location
param dnsPrefix string = clusterName
param nodeCount int = 2
param nodeVmSize string = 'Standard_B2s'
param kubernetesVersion string = '1.31'
param subnetId string = ''
param logWorkspaceId string = ''

resource aks 'Microsoft.ContainerService/managedClusters@2024-01-01' = {
  name: clusterName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    kubernetesVersion: kubernetesVersion
    dnsPrefix: dnsPrefix
    enableRBAC: true
    agentPoolProfiles: [
      {
        name: 'systempool'
        count: nodeCount
        vmSize: nodeVmSize
        osType: 'Linux'
        mode: 'System'
        osDiskSizeGB: 128
        subnetID: empty(subnetId) ? null : subnetId
      }
    ]
    networkProfile: {
      networkPlugin: 'azure'
      loadBalancerSku: 'standard'
    }
    addonProfiles: {
      omsagent: empty(logWorkspaceId)
        ? { enabled: false }
        : {
            enabled: true
            config: {
              logAnalyticsWorkspaceResourceID: logWorkspaceId
            }
          }
    }
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
  }
}

output clusterId string = aks.id
output clusterName string = aks.name
output kubeletIdentityObjectId string = aks.properties.identityProfile.kubeletidentity.objectId
output oidcIssuerUrl string = aks.properties.oidcIssuerProfile.issuerURL
output plannedClusterName string = clusterName
output plannedLocation string = location
