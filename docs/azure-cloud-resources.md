# Azure Cloud Resources

This document describes every Azure resource deployed for Retro Tool, the configuration choices, and approximate monthly costs in GBP (UK South region, April 2026 pricing).

> Costs are estimates based on Azure public pricing. Actual bills depend on usage, reserved instances, and Azure discounts.

---

## Resource Summary

| Resource | Staging | Production |
|---|---|---|
| Static Web App | Free | Standard |
| App Service Plan | Free F1 | Premium V4 P0V4 |
| Web App (API) | Free F1 | Premium V4 P0V4, zone-redundant |
| Container Registry | Premium | Premium |
| PostgreSQL Flexible Server | Shared (B1ms, Burstable) | Shared (B1ms, Burstable) |

> Both environments **share a single PostgreSQL server** deployed in the production resource group.

---

## Staging Environment

### Static Web App — Free

| Property | Value |
|---|---|
| SKU | Free |
| Region | UK South |
| Bandwidth | 100 GB/month included |
| Custom domains | 2 |
| Tags | `Production: Production` |

**Cost: £0/month**

---

### App Service Plan + Web App — Free F1

| Property | Value |
|---|---|
| SKU | F1 (Free) |
| OS | Linux |
| Region | UK South |
| vCPU | Shared |
| RAM | 1 GB |
| Storage | 1 GB |
| CPU limit | 60 minutes/day |
| Custom domains | Not supported |
| Always On | Disabled |
| Zone redundancy | Not supported |
| Tags | `Production: Production` |

**Cost: £0/month**

> Limitations: No custom domain, no always-on (app sleeps after inactivity), 60 CPU-minute/day cap. Suitable for testing and QA only.

---

## Production Environment

### Static Web App — Standard

| Property | Value |
|---|---|
| SKU | Standard |
| Region | UK South |
| Bandwidth | 100 GB/month included |
| Custom domains | Unlimited |
| Staging environments | Up to 10 |
| Tags | `Production: Production` |

**Cost: ~£7.50/month** (~$9/month)

---

### App Service Plan + Web App — Premium V4 P0V4

| Property | Value |
|---|---|
| SKU | P0v4 (Premium V4) |
| OS | Linux |
| Region | UK South |
| vCPU | 1 vCPU |
| RAM | 4 GB |
| Storage | 250 GB |
| Always On | Enabled |
| Custom domains | Unlimited |
| Zone redundancy | Enabled |
| Auto-scale | Supported |
| Tags | `Production: Production` |

**Cost: ~£55–£65/month** (zone redundancy bills minimum 3 instances)

> Zone redundancy automatically spans 3 availability zones. You are billed for at least 3 P0v4 instances when enabled (~£18–£22/instance/month).

---

## Shared Resources

### Azure Container Registry — Premium

Used by both staging and production to store the NestJS API Docker images.

| Property | Value |
|---|---|
| SKU | Premium |
| Region | UK South |
| Storage included | 500 GB |
| Geo-replication | Not enabled |
| Retention policy | 30 days |

**Cost: ~£33/month**

> Premium SKU is required for features like geo-replication, private link, and dedicated throughput. If geo-replication is not needed, downgrading to Standard (~£17/month) is possible.

---

### PostgreSQL Flexible Server — Burstable B1ms

One server shared between staging and production (separate databases or the same database with separate schemas).

| Property | Value |
|---|---|
| Compute tier | Burstable |
| Compute size | Standard_B1ms |
| vCPU | 1 |
| RAM | 2 GB |
| Storage | 32 GB |
| PostgreSQL version | 16 |
| High availability | Disabled |
| Backup retention | 7 days |
| Geo-redundant backup | Disabled |
| Region | UK South |
| Workload type | Dev/Test |

**Cost: ~£13–£15/month**

> Burstable B1ms is sufficient for low-to-moderate traffic. For higher production load, consider upgrading to `Standard_D2ds_v4` (General Purpose, 2 vCPU, 8 GB RAM, ~£80/month).

---

## One-off Migration Container (ACI)

A temporary Azure Container Instance is spun up during each API deployment to run database migrations. It is deleted immediately after.

| Property | Value |
|---|---|
| CPU | 1 vCPU |
| Memory | 1 GB |
| Lifetime | < 5 minutes per deployment |

**Cost: < £0.01 per deployment** (negligible)

---

## Convex Cloud

Convex functions are deployed to **Convex Cloud** (not Azure). Convex Cloud pricing depends on your plan:

| Plan | Cost | Notes |
|---|---|---|
| Starter | Free | Up to 1M function calls/month, 1 GB storage |
| Pro | ~$25/month per project | Higher limits, team features |

See [convex.dev/pricing](https://www.convex.dev/pricing) for current pricing.

> You need **two Convex Cloud projects** — one for staging, one for production.

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
| Static Web App (Standard) | ~£7.50 |
| App Service P0v4 × 3 zones | ~£55–£65 |
| **Production subtotal** | **~£63–£73** |

### Shared

| Resource | Monthly Cost |
|---|---|
| Container Registry (Premium) | ~£33 |
| PostgreSQL Flexible Server (B1ms) | ~£13–£15 |
| **Shared subtotal** | **~£46–£48** |

### Grand Total

| | Monthly |
|---|---|
| **Minimum (staging + shared)** | **~£46–£48** |
| **Full (staging + production + shared)** | **~£109–£121** |

---

## Cost Optimisation Options

| Option | Saving | Trade-off |
|---|---|---|
| Downgrade ACR to Standard | ~£16/month | No geo-replication or private link |
| Disable zone redundancy (production) | ~£35–£45/month | Reduced availability during zone failure |
| Use reserved instances (1-year) for App Service | ~30% | Upfront commitment |
| Stop staging App Service when not in use | ~£0 vs free tier (already free) | N/A — staging is already Free F1 |
| Upgrade PostgreSQL only when needed | — | Scale up compute when traffic demands it |
