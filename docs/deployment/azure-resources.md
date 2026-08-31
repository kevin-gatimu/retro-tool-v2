# Azure Resources Guide for Retro Tool

> Snapshot of the resources **actually running today** (including legacy pre-Bicep names), for
> migrating the live account to a new subscription. For the Bicep command reference and the
> self-hosted Convex stack's full resource list, see
> [`../infra/provisioning.md`](../infra/provisioning.md#self-hosted-convex); for an ordered,
> from-scratch bring-up runbook (including the Convex bootstrap), see
> [`./new-azure-subscription.md`](./new-azure-subscription.md).

This document is a self-contained package for migrating **Retro Tool** to a new Azure account.

## Architecture

Retro Tool is a **pnpm monorepo**: a React UI (Static Web App), a NestJS REST API (containerised App Service), a PostgreSQL system of record, and a **self-hosted Convex** realtime projection layer running as its own container on Azure App Service — staging and production both self-host (see [`../infra/provisioning.md#self-hosted-convex`](../infra/provisioning.md#self-hosted-convex)). `develop` is not a deployed Azure environment at all — no resource group, App Service, or Convex deployment exists for it; all `develop`-branch work happens locally against the self-hosted Docker Convex container, the same as any other branch. Convex is the sole realtime transport — there are no WebSocket gateways in the API. PostgreSQL is the authoritative store; Convex holds only live collaboration snapshots that the API pushes after each mutation.

```text
                                  USER BROWSER
                                  (React SPA)
                                       |
            .......................... | ..........................
            :                          |                          :
   static assets                     REST                    subscribe
            :                          |                          :
            v                          v                          :
   ...................        ...................                 :
   :  Static Web App :        : App Service for :                 :
   :  (UI hosting)   :        :   Containers    :                 :
   :  West Europe    :        :   NestJS REST   :                 :
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
                       : App Service     :<-same--:  Self-hosted       :
                       : Plan (shared,   : plan   :  Convex (own App   :
                       : B1 Basic today) :        :  Service container):
                       :.................:        :....................:

                       ...................        ......................
                       : Container       :<-pull--:  Managed Identities:
                       : Registry (ACR)  :  image :  (API's + Convex's,:
                       : retrotool       :        :   each AcrPull)    :
                       :.................:        :....................:

                       OAuth (Microsoft): browser sign-in + API session validation


   CI/CD:  GitHub Actions --build+push image--> ACR
           GitHub Actions --deploy container--> API App Service
           GitHub Actions --run migrations----> PostgreSQL
           GitHub Actions --upload build------> Static Web App
           GitHub Actions --deploy container--> Convex App Service
                                                 (staging: auto on push;
                                                  production: manual only)
```

> This ASCII sketch is a simplified mental model. The full topology (all
> environments, Key Vault, storage share, Log Analytics) is diagrammed in
> [`../architecture/cloud.md`](../architecture/cloud.md).

---

## Azure service inventory

These are the core Azure resources to recreate in the new account (table A). The self-hosted
Convex stack (table B) is a separate, later addition that shares this same resource group, ACR,
and PostgreSQL server. Names below reflect the current deployment; rename as needed for the new
subscription.

### A. Core app stack

| # | Resource | Type | SKU / Configuration | Region | Purpose |
| - | --- | --- | --- | --- | --- |
| 1 | `ASP-retrotoolproductionrg-be95` | App Service Plan | **B1 Basic**, Linux, 1 instance, zone-redundancy disabled — manually scaled down from the Bicep default (P0v3) so the API can share the plan with self-hosted Convex at no extra cost | South Africa North | Hosts the API App Service **and** the self-hosted Convex App Service (table B, #1). |
| 2 | retrotool API | App Service (for Containers) | Linux container, image pulled from ACR, uses managed identity for pull | South Africa North | NestJS REST backend (no WebSocket gateways — Convex is the sole realtime transport). |
| 3 | Static Web App | Static Web App | **Standard** | West Europe | Hosts the React UI (edge-served). |
| 4 | `retro-tool-db-server` | Azure Database for PostgreSQL Flexible Server | **Burstable Standard_B1ms** (1 vCore / 2 GiB RAM), 32 GiB Premium SSD (P4), storage autogrow on, **PostgreSQL 17**, HA disabled, 7-day backups, admin login `pgadmin` | South Africa North | System of record (durable business data). Also hosts the separate `retrotool_convex_prod` database used by table B, #6. |
| 5 | `retrotool` (`retrotool.azurecr.io`) | Container Registry | **Standard**, admin user disabled | South Africa North | Stores the API **and** Convex Docker images. |
| 6 | User-assigned Managed Identity | Managed Identity | Assigned to the API App Service | South Africa North | Grants App Service `AcrPull` on the registry (passwordless image pull). |
| 7 | Azure App Registration | App Registration (Entra ID) | Multi-tenant or single-tenant; federated credentials for GitHub Actions OIDC; redirect URIs for Better Auth OAuth | Global | **Microsoft OAuth** — Better Auth social login. Uses the shared Azure App Registration; add the new redirect URI. |

#### Role assignments to recreate (table A)

| Identity | Role | Scope |
| --- | --- | --- |
| User-assigned Managed Identity (#6) | `AcrPull` | Container Registry (#5) |
| GitHub Actions App Registration (service principal) | `Contributor` | Subscription or resource group |
| GitHub Actions App Registration (service principal) | `User Access Administrator` | Subscription (only if it must manage role assignments) |

> The current setup uses a single resource group (`retro_tool`). Keep one resource group per environment in the new account.

### B. Self-hosted Convex stack (production)

Provisioned by `infra/convex-production.bicep` (staging's equivalent is `infra/convex-staging.bicep`),
into the **same** resource group as table A. Full field-by-field detail:
[`../infra/provisioning.md#self-hosted-convex`](../infra/provisioning.md#self-hosted-convex).

| # | Resource | Type | SKU / Configuration | Region | Purpose |
| - | --- | --- | --- | --- | --- |
| 1 | `retrotool-prod-convex` | App Service (for Containers) | Linux container, `WEBSITES_PORT=3210`, HTTPS-only, WebSockets on, `/version` health check, exactly one worker, **shares table A's #1 App Service Plan** | South Africa North | Self-hosted Convex backend (open-source binary, digest-pinned image). |
| 2 | `retrotool-prod-convex-identity` | User-assigned Managed Identity | — | South Africa North | Holds `AcrPull` on the ACR (table A, #5) and Key Vault Secrets User on #4 below. |
| 3 | Storage account + `convex-data` share | Storage Account + Azure Files | — | South Africa North | Durable Convex state, mounted at `/convex/data`; survives restarts/image swaps. |
| 4 | `retrotool-prod-cvx-<hash>` | Key Vault | RBAC-authorized, soft-delete on | South Africa North | Stores the Convex `INSTANCE_SECRET` and `POSTGRES_URL` as version-pinned secret references. |
| 5 | `retrotool-prod-convex-logs` | Log Analytics workspace | PerGB2018, 30-day retention | South Africa North | App Service diagnostic logs/metrics for the Convex Web App. |
| 6 | `retrotool_convex_prod` | PostgreSQL database | Separate database on table A's #4 server, dedicated least-privilege role (`convex_prod`) | South Africa North | Convex's own storage — never shares a role with `retro_tool_db`. |

#### Role assignments to recreate (table B)

| Identity | Role | Scope |
| --- | --- | --- |
| Convex runtime identity (#2) | `AcrPull` | Container Registry (table A, #5) |
| Convex runtime identity (#2) | Key Vault Secrets User | Key Vault (#4) |

> Deploy is `workflow_dispatch`-only for production
> ([`deploy-convex-production.yml`](../../.github/workflows/deploy-convex-production.yml)) — there is
> no automated production Convex release pipeline; staging's equivalent
> ([`deploy-convex.yml`](../../.github/workflows/deploy-convex.yml)) runs automatically on push.

---

## Migration checklist

Recreate resources in this order in the new account:

1. **Resource group** — one per environment (e.g. `retro-tool-production-rg`) in South Africa North.
2. **Container Registry** — Standard SKU; keep admin user disabled.
3. **User-assigned Managed Identity** — grant it `AcrPull` on the registry.
4. **PostgreSQL Flexible Server** — Burstable B1ms, 32 GiB, PostgreSQL 17; enable "Allow public access from Azure services"; create the `retro_tool_db` database.
5. **App Service Plan** — B1 Basic if you intend to share it with self-hosted Convex (see step 9); the Bicep default is P0v3 if you'd rather keep them on separate plans.
6. **App Service (Containers)** — assign the managed identity, point it at `retrotool.azurecr.io`, set all application settings.
7. **Static Web App** — Standard SKU, West Europe; capture the deployment token.
8. **Azure App Registration** — for GitHub Actions OIDC and Microsoft OAuth; add federated credentials per branch/environment and the new redirect URI.
9. **Self-hosted Convex stack** (table B) — Convex database + role on the PostgreSQL server from step 4, then the Key Vault, storage share, Log Analytics workspace, runtime identity, and Convex App Service. Full ordered steps (including gotchas): [`new-azure-subscription.md`](./new-azure-subscription.md#6-provision-the-self-hosted-convex-stack).

## Notes & constraints

- **Static Web App region**: not available in South Africa North; keep it in a supported region (ie West Europe today). It is edge-delivered, so latency is unaffected.
- **Convex is single-instance.** The open-source Convex backend does not support scale-out, autoscale, or deployment slots — table B's App Service is pinned to exactly one worker.
