# Azure Resources Guide for Retro Tool

This document is a self-contained package for migrating **Retro Tool** to a new Azure account

## Architecture

Retro Tool is a **pnpm monorepo**: a React UI (Static Web App), a NestJS REST + Socket.IO API (containerised App Service), a PostgreSQL system of record, and a Convex Cloud realtime projection layer. PostgreSQL is the authoritative store; Convex holds only live collaboration snapshots that the API pushes after each mutation.

```
                                  USER BROWSER
                                  (React SPA)
                                       |
            .......................... | ..........................
            :                          |                          :
   static assets                 REST / WebSocket            subscribe
            :                          |                          :
            v                          v                          :
   ...................        ...................                 :
   :  Static Web App :        : App Service for :                 :
   :  (UI hosting)   :        :   Containers    :                 :
   :  West Europe    :        : NestJS REST+WS  :                 :
   :.................:        :....... .........:                 :
                                  |    |   |  \                   :
                       reads/     |    |   |   \ send email       :
                       writes     |    |   |    \                 :
                                  v    |   |     v                :
                       ...............  |  |  ............        :
                       : PostgreSQL  :  |  |  : Resend   :        :
                       : Flexible    :  |  |  : (email)  :        :
                       : Server      :  |  |  :..........:        :
                       :.............:  |  |                      :
                                        |  | push snapshots       :
                       hosted on /      |  +----------------+     :
                       runs on plan     |                   |     :
                                        v                   v     v
                       ...................        ......................
                       : App Service     :        :   Convex Cloud     :
                       : Plan (P0v3)     :        : realtime projection:
                       :.................:        :....................:

                       ...................        ......................
                       : Container       :<-pull--:  Managed Identity  :
                       : Registry (ACR)  :  image :  (AcrPull)         :
                       : retrotool       :        :....................:
                       :.................:

                       OAuth (Microsoft): browser sign-in + API session validation


   CI/CD:  GitHub Actions --build+push image--> ACR
           GitHub Actions --deploy container--> App Service
           GitHub Actions --run migrations----> PostgreSQL
           GitHub Actions --upload build------> Static Web App
```

---

## Azure service inventory

These are the seven Azure resources to recreate in the new account. Names below reflect the current deployment; rename as needed for the new subscription.

| # | Resource                                 | Type                                          | SKU / Configuration                                                                                                                                                                 | Region             | Purpose                                                                                                                  |
| - | ---------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1 | `ASP-retrotoolproductionrg-be95`       | App Service Plan                              | **P0v3**, Linux, 1 instance, zone-redundancy disabled                                                                                                                         | South Africa North | Hosts the API App Service.                                                                                               |
| 2 | retrotool API                            | App Service (for Containers)                  | Linux container, image pulled from ACR, uses managed identity for pull                                                                                                              | South Africa North | NestJS REST + Socket.IO backend.                                                                                         |
| 3 | Static Web App                           | Static Web App                                | **Standard**                                                                                                                                                                  | West Europe        | Hosts the React UI (edge-served).                                                                                        |
| 4 | `retro-tool-db-server`                 | Azure Database for PostgreSQL Flexible Server | **Burstable Standard_B1ms** (1 vCore / 2 GiB RAM), 32 GiB Premium SSD (P4), storage autogrow on, **PostgreSQL 17**, HA disabled, 7-day backups, admin login `pgadmin` | South Africa North | System of record (durable business data).                                                                                |
| 5 | `retrotool` (`retrotool.azurecr.io`) | Container Registry                            | **Standard**, admin user disabled                                                                                                                                             | South Africa North | Stores the API Docker images.                                                                                            |
| 6 | User-assigned Managed Identity           | Managed Identity                              | Assigned to the API App Service                                                                                                                                                     | South Africa North | Grants App Service `AcrPull` on the registry (passwordless image pull).                                                |
| 7 | Azure App Registration                   | App Registration (Entra ID)                   | Multi-tenant or single-tenant; federated credentials for GitHub Actions OIDC; redirect URIs for Better Auth OAuth                                                                   | Global             | **Microsoft OAuth** — Better Auth social login. Uses the shared Azure App Registration; add the new redirect URI. |

**Role assignments to recreate**

| Identity                                            | Role                          | Scope                                                  |
| --------------------------------------------------- | ----------------------------- | ------------------------------------------------------ |
| User-assigned Managed Identity (#6)                 | `AcrPull`                   | Container Registry (#5)                                |
| GitHub Actions App Registration (service principal) | `Contributor`               | Subscription or resource group                         |
| GitHub Actions App Registration (service principal) | `User Access Administrator` | Subscription (only if it must manage role assignments) |

> The current setup uses a single resource group (`retro_tool`). Keep one resource group per environment in the new account.

---

## Migration checklist

Recreate resources in this order in the new account:

1. **Resource group** — one per environment (e.g. `retro-tool-production-rg`) in South Africa North.
2. **Container Registry** — Standard SKU; keep admin user disabled.
3. **User-assigned Managed Identity** — grant it `AcrPull` on the registry.
4. **PostgreSQL Flexible Server** — Burstable B1ms, 32 GiB, PostgreSQL 17; enable "Allow public access from Azure services"; create the `retro_tool_db` database.
5. **App Service Plan** — P0v3, Linux, South Africa North.
6. **App Service (Containers)** — assign the managed identity, point it at `retrotool.azurecr.io`, set all application settings.
7. **Static Web App** — Standard SKU, West Europe; capture the deployment token.
8. **Azure App Registration** — for GitHub Actions OIDC and Microsoft OAuth; add federated credentials per branch/environment and the new redirect URI.

## Notes & constraints

- **Static Web App region**: not available in South Africa North; keep it in a supported region (ie West Europe today). It is edge-delivered, so latency is unaffected.
