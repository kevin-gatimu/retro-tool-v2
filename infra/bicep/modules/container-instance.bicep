param location string
param containerGroupName string
param acrLoginServer string
param acrUsername string
@secure()
param acrPassword string
param convexImageTag string = 'latest'
param convexInstanceName string
@secure()
param convexInstanceSecret string
@secure()
param convexPostgresUrl string
param cpuCores int = 1
param memoryGB int = 2
param tags object = {}

resource containerGroup 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: containerGroupName
  location: location
  tags: tags
  properties: {
    osType: 'Linux'
    restartPolicy: 'Always'
    ipAddress: {
      type: 'Public'
      dnsNameLabel: containerGroupName
      ports: [
        {
          port: 3210
          protocol: 'TCP'
        }
        {
          port: 3211
          protocol: 'TCP'
        }
      ]
    }
    imageRegistryCredentials: [
      {
        server: acrLoginServer
        username: acrUsername
        password: acrPassword
      }
    ]
    containers: [
      {
        name: 'convex-backend'
        properties: {
          image: 'ghcr.io/get-convex/convex-backend:${convexImageTag}'
          resources: {
            requests: {
              cpu: cpuCores
              memoryInGB: memoryGB
            }
          }
          ports: [
            {
              port: 3210
              protocol: 'TCP'
            }
            {
              port: 3211
              protocol: 'TCP'
            }
          ]
          environmentVariables: [
            {
              name: 'INSTANCE_NAME'
              value: convexInstanceName
            }
            {
              name: 'INSTANCE_SECRET'
              secureValue: convexInstanceSecret
            }
            {
              name: 'POSTGRES_URL'
              secureValue: convexPostgresUrl
            }
          ]
        }
      }
    ]
  }
}

output containerGroupId string = containerGroup.id
output containerGroupName string = containerGroup.name
output containerGroupFqdn string = containerGroup.properties.ipAddress.fqdn
output convexSyncUrl string = 'https://${containerGroup.properties.ipAddress.fqdn}:3210'
