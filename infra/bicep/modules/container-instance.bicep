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
param caddyAcmeEmail string
param caddyPersistCertificates bool = false
param caddyCertStorageAccountName string = ''
@secure()
param caddyCertStorageAccountKey string = ''
param caddyCertStorageShareName string = ''
param tags object = {}

// Constructed FQDN — ACI always uses this pattern
var containerFqdn = '${containerGroupName}.${location}.azurecontainer.io'

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
          port: 80
          protocol: 'TCP'
        }
        {
          port: 443
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
      // ── Convex backend (internal only — not exposed publicly) ──
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
            {
              name: 'DISABLE_BEACON'
              value: '1'
            }
          ]
        }
      }
      // ── Caddy sidecar — SSL termination + auto Let's Encrypt cert ──
      // Listens on 443, proxies to convex-backend on localhost:3210.
      // On first start it gets a real cert from Let's Encrypt automatically.
      // Containers in the same group share localhost.
      {
        name: 'caddy'
        properties: {
          image: 'caddy:alpine'
          command: [
            'caddy'
            'reverse-proxy'
            '--from'
            containerFqdn
            '--to'
            'localhost:3210'
            '--email'
            caddyAcmeEmail
          ]
          resources: {
            requests: {
              cpu: json('0.25')
              memoryInGB: json('0.5')
            }
          }
          ports: [
            {
              port: 80
              protocol: 'TCP'
            }
            {
              port: 443
              protocol: 'TCP'
            }
          ]
          volumeMounts: caddyPersistCertificates
            ? [
                {
                  name: 'caddy-cert-data'
                  mountPath: '/data'
                }
                {
                  name: 'caddy-cert-data'
                  mountPath: '/config'
                }
              ]
            : []
        }
      }
    ]
    volumes: caddyPersistCertificates
      ? [
          {
            name: 'caddy-cert-data'
            azureFile: {
              shareName: caddyCertStorageShareName
              storageAccountName: caddyCertStorageAccountName
              storageAccountKey: caddyCertStorageAccountKey
            }
          }
        ]
      : []
  }
}

output containerGroupId string = containerGroup.id
output containerGroupName string = containerGroup.name
output containerGroupFqdn string = containerGroup.properties.ipAddress.fqdn
output convexSyncUrl string = 'https://${containerGroup.properties.ipAddress.fqdn}'
