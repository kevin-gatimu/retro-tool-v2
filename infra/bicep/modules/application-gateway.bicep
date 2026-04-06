// ─────────────────────────────────────────────────────────────
// Application Gateway for Convex Backend (HTTPS → HTTP)
// Provides SSL termination for Azure Container Instance
// ─────────────────────────────────────────────────────────────

param location string
param appGatewayName string
param convexBackendFqdn string
param convexBackendPort int = 3210
param tags object = {}

// Virtual Network for Application Gateway (required)
resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: '${appGatewayName}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'appGatewaySubnet'
        properties: {
          addressPrefix: '10.0.0.0/24'
        }
      }
    ]
  }
}

// Public IP for Application Gateway
resource publicIp 'Microsoft.Network/publicIPAddresses@2023-05-01' = {
  name: '${appGatewayName}-pip'
  location: location
  tags: tags
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: {
      domainNameLabel: appGatewayName
    }
  }
}

// Self-signed SSL certificate (base64-encoded PFX)
// WARNING: This is a SELF-SIGNED certificate for TESTING ONLY
// For production, replace with a real certificate from Azure Key Vault or Let's Encrypt
// 
// To generate your own self-signed cert for testing:
// 1. openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=convex.local"
// 2. openssl pkcs12 -export -out cert.pfx -inkey key.pem -in cert.pem -password pass:ConvexSSL123
// 3. base64 cert.pfx > cert.b64
// 
// For PRODUCTION: Use Azure Key Vault to store your certificate securely
@secure()
param sslCertificateData string
@secure()
param sslCertificatePassword string

resource appGateway 'Microsoft.Network/applicationGateways@2023-05-01' = {
  name: appGatewayName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'Standard_v2'
      tier: 'Standard_v2'
      capacity: 1
    }
    gatewayIPConfigurations: [
      {
        name: 'appGatewayIpConfig'
        properties: {
          subnet: {
            id: '${vnet.id}/subnets/appGatewaySubnet'
          }
        }
      }
    ]
    frontendIPConfigurations: [
      {
        name: 'appGatewayFrontendIP'
        properties: {
          publicIPAddress: {
            id: publicIp.id
          }
        }
      }
    ]
    frontendPorts: [
      {
        name: 'port_443'
        properties: {
          port: 443
        }
      }
      {
        name: 'port_80'
        properties: {
          port: 80
        }
      }
    ]
    backendAddressPools: [
      {
        name: 'convexBackendPool'
        properties: {
          backendAddresses: [
            {
              fqdn: convexBackendFqdn
            }
          ]
        }
      }
    ]
    backendHttpSettingsCollection: [
      {
        name: 'convexHttpSettings'
        properties: {
          port: convexBackendPort
          protocol: 'Http'
          cookieBasedAffinity: 'Disabled'
          requestTimeout: 30
          pickHostNameFromBackendAddress: true
        }
      }
    ]
    httpListeners: [
      {
        name: 'httpsListener'
        properties: {
          frontendIPConfiguration: {
            id: resourceId(
              'Microsoft.Network/applicationGateways/frontendIPConfigurations',
              appGatewayName,
              'appGatewayFrontendIP'
            )
          }
          frontendPort: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', appGatewayName, 'port_443')
          }
          protocol: 'Https'
          sslCertificate: {
            id: resourceId('Microsoft.Network/applicationGateways/sslCertificates', appGatewayName, 'appGatewaySslCert')
          }
        }
      }
      {
        name: 'httpListener'
        properties: {
          frontendIPConfiguration: {
            id: resourceId(
              'Microsoft.Network/applicationGateways/frontendIPConfigurations',
              appGatewayName,
              'appGatewayFrontendIP'
            )
          }
          frontendPort: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', appGatewayName, 'port_80')
          }
          protocol: 'Http'
        }
      }
    ]
    requestRoutingRules: [
      {
        name: 'httpsRule'
        properties: {
          ruleType: 'Basic'
          priority: 100
          httpListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'httpsListener')
          }
          backendAddressPool: {
            id: resourceId(
              'Microsoft.Network/applicationGateways/backendAddressPools',
              appGatewayName,
              'convexBackendPool'
            )
          }
          backendHttpSettings: {
            id: resourceId(
              'Microsoft.Network/applicationGateways/backendHttpSettingsCollection',
              appGatewayName,
              'convexHttpSettings'
            )
          }
        }
      }
      {
        name: 'httpToHttpsRedirect'
        properties: {
          ruleType: 'Basic'
          priority: 200
          httpListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'httpListener')
          }
          redirectConfiguration: {
            id: resourceId(
              'Microsoft.Network/applicationGateways/redirectConfigurations',
              appGatewayName,
              'httpToHttps'
            )
          }
        }
      }
    ]
    redirectConfigurations: [
      {
        name: 'httpToHttps'
        properties: {
          redirectType: 'Permanent'
          targetListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'httpsListener')
          }
          includePath: true
          includeQueryString: true
        }
      }
    ]
    sslCertificates: [
      {
        name: 'appGatewaySslCert'
        properties: {
          data: sslCertificateData
          password: sslCertificatePassword
        }
      }
    ]
  }
}

output appGatewayId string = appGateway.id
output appGatewayName string = appGateway.name
output appGatewayFqdn string = publicIp.properties.dnsSettings.fqdn
output convexHttpsUrl string = 'https://${publicIp.properties.dnsSettings.fqdn}'
