# Azure Cloud Resources

This document describes every Azure resource deployed for Retro Tool, the configuration choices, and approximate monthly costs in GBP (East US 2 region, April 2026 pricing).

> Costs are estimates based on Azure public pricing. Actual bills depend on usage, reserved instances, and Azure discounts.

---

## Resource Summary

| Resource | Staging | Production |
|---|---|---|
| Static Web App | Free | Free |
| App Service Plan | Free F1 | Free F1 (upgrade to S1 once Standard VM quota approved) |
| Web App (API) | Free F1 | Free F1 |
| PostgreSQL Flexible Server | Shared (General Purpose D2ds_v4) | Shared (General Purpose D2ds_v4) |

> Both environments **share a single PostgreSQL server** deployed in the production resource group.

> No Azure Container Registry. The API is deployed via zip code deploy (not Docker/container).

---

## Staging Environment

### Static Web App — Free

| Property | Value |
|---|---|
| SKU | Free |
| Region | East US 2 |
| Bandwidth | 100 GB/month included |
| Custom domains | 2 |
| Deployment source | Deployment token |

**Cost: £0/month**

---

### App Service Plan + Web App — Free F1

| Property | Value |
|---|---|
| SKU | F1 (Free) |
| OS | Linux |
| Region | East US 2 |
| vCPU | Shared |
| RAM | 1 GB |
| Storage | 1 GB |
| CPU limit | 60 minutes/day |
| Custom domains | Not supported |
| Always On | Disabled |
| Zone redundancy | Not supported |
| Deployment method | Zip code deploy |

**Cost: £0/month**

> Limitations: No custom domain, no always-on (app sleeps after inactivity), 60 CPU-minute/day cap. Suitable for testing and QA only.

---

## Production Environment

### Static Web App — Free

| Property | Value |
|---|---|
| SKU | Free |
| Region | East US 2 |
| Bandwidth | 100 GB/month included |
| Custom domains | 2 |
| Deployment source | Deployment token |

**Cost: £0/month**

> Upgrade to Standard (~£7.50/month) when custom domains or more staging environments are needed.

---

### App Service Plan + Web App — Free F1

| Property | Value |
|---|---|
| SKU | F1 (Free) — temporary until Standard VM quota approved |
| OS | Linux |
| Region | East US 2 |
| vCPU | Shared |
| RAM | 1 GB |
| Storage | 1 GB |
| CPU limit | 60 minutes/day |
| Always On | Disabled |
| Deployment method | Zip code deploy |

**Cost: £0/month (temporary)**

> Target SKU is **S1 Standard** (~£14/month) once the Standard VMs quota is approved (Azure Portal → Subscriptions → Usage + quotas → Standard VMs → request increase). Upgrade: App Service → Scale up → S1 Standard.

---

## Shared Resources

### PostgreSQL Flexible Server — General Purpose D2ds_v4

One server shared between staging and production (separate databases).

| Property | Value |
|---|---|
| Compute tier | General Purpose |
| Compute size | Standard_D2ds_v4 |
| vCPU | 2 |
| RAM | 8 GB |
| Storage | 32 GB |
| PostgreSQL version | 16 |
| High availability | Disabled |
| Backup retention | 7 days |
| Geo-redundant backup | Disabled |
| Region | East US 2 |
| Workload type | Development |

**Cost: ~£55–£65/month**

> General Purpose tier is required — Burstable (B1ms) uses the Basic VMs quota which is exhausted on new Azure subscriptions.

---

## Convex Cloud

Convex functions are deployed to **Convex Cloud** (not self-hosted on Azure). One project per environment.

| Plan | Cost | Notes |
|---|---|---|
| Starter | Free | Up to 1M function calls/month, 1 GB storage |
| Pro | ~$25/month per project | Higher limits, team features |

See [convex.dev/pricing](https://www.convex.dev/pricing) for current pricing.

> You need **two Convex Cloud projects** — one for staging, one for production.

---

## DB Migrations

Migrations run directly on the GitHub Actions runner during each API deployment (`node dist/migrate.js`). No separate Azure resource is needed.

---

## Total Cost Estimates

### Staging

| Resource | Monthly Cost |
|---|---|
| Static Web App (Free) | £0 |
| App Service F1 | £0 |
| **Staging subtotal** | **£0** |

### Production

| Resource | Monthly Cost |
|---|---|
| Static Web App (Free) | £0 |
| App Service F1 (temporary) | £0 |
| App Service S1 (after quota) | ~£14 |
| **Production subtotal** | **£0 now / ~£14 after upgrade** |

### Shared

| Resource | Monthly Cost |
|---|---|
| PostgreSQL Flexible Server (D2ds_v4) | ~£55–£65 |
| **Shared subtotal** | **~£55–£65** |

### Grand Total

| | Monthly |
|---|---|
| **Current (F1 + shared)** | **~£55–£65** |
| **After S1 upgrade** | **~£69–£79** |

---

## Cost Optimisation Options

| Option | Saving | Trade-off |
|---|---|---|
| Downgrade PostgreSQL to Burstable B1ms (when quota allows) | ~£40–£50/month | Requires Basic VMs quota; lower compute ceiling |
| Use reserved instances (1-year) for PostgreSQL | ~30–40% | Upfront commitment |
| Upgrade App Service to S1 only in production | ~£7/month vs both envs | Staging stays on free tier anyway |
| Stop staging PostgreSQL database when not in use | Negligible (shared server) | N/A — single shared server |

---

## Upgrading App Service to S1

1. Azure Portal → Subscriptions → **Usage + quotas** → filter East US 2 → search **Standard VMs** → request limit increase (minimum 1)
2. Once approved: App Service → **Scale up** → **S1 Standard**
