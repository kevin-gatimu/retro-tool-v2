# Scaling self-hosted Convex beyond a single writer

> Companion to [`../architecture/socket-io-elimination-plan.md`](../architecture/socket-io-elimination-plan.md) §6.4. That plan states: *"Self-hosted Convex is single-writer by design — vertical scale only (bump the B1 App Service SKU) if Tier 1 + Tier 2 still saturate it."* This document answers: **what do we actually do when a single self-hosted Convex instance becomes the throughput ceiling and vertical scaling runs out?**
>
> Status: **proposed, for review.**

## 0. Executive summary

- **There is no horizontal scaling path for open-source self-hosted Convex.** Its own README states self-hosted "is not optimized for scale" and the [architecture](https://stack.convex.dev/how-convex-works) uses a **single committer** that is "the sole writer to the transaction log." No read replicas, no sharding, no multi-backend clustering exists in the OSS product. Confirmed against the current [self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md) and [docs.convex.dev/self-hosting](https://docs.convex.dev/self-hosting), which explicitly steers scale-sensitive users to the cloud product.
- **The vertical ladder on App Service is real but shallow for a single instance.** From the B1 the repo runs today (`numberOfWorkers: 1`, 1 vCPU / 1.75 GB), the practical single-instance ceiling on Premium v3 is **P3v3 (8 vCPU / 32 GB)** or memory-optimized **P3mv3 (8 vCPU / 64 GB)**. Beyond that a single Web App cannot go without scaling *out* — which Convex OSS cannot use.
- **The correct escalation is: (1) exhaust write-reduction (S1/S2 + coalescing) → (2) climb the vertical ladder → (3) terminal step is Convex Cloud for the env that outgrows it.** Sharding across multiple self-hosted instances is technically possible but is a footgun for a projection keyed by retro/session id, and is *not* recommended over Convex Cloud for a cost-conscious team.
- **Because Postgres is the system of record and Convex is a rebuildable projection**, moving one environment to Convex Cloud is low-risk: no data migration, just re-point `CONVEX_SYNC_URL` / `VITE_CONVEX_URL` and re-seed the projection. That optionality is the whole reason this is a tractable problem.

---

## 1. Vertical scaling headroom on Azure App Service

The Convex container runs on a dedicated Linux Web App for Containers (`infra/modules/convex-app-service.bicep`), today **B1, `numberOfWorkers: 1`**, `alwaysOn: true`, `webSocketsEnabled: true`, BYO Azure Files mount. Scale-out/slots are deliberately disallowed because the OSS backend is single-instance.

### 1.1 The realistic single-instance vertical ladder (Linux, East US, pay-as-you-go)

| SKU | vCPU | RAM | ~$/hr (Linux) | ~$/mo (×730) | Notes |
|---|---|---|---|---|---|
| **B1** (today) | 1 | 1.75 GB | $0.017 | **~$12** | Current staging Convex. |
| B2 | 2 | 3.5 GB | $0.034 | ~$25 | Basic scale-up. |
| B3 | 4 | 7 GB | $0.067 | ~$49 | Top of Basic. |
| S1 | 1 | 1.75 GB | $0.095 | ~$69 | Standard adds autoscale/slots (irrelevant here); same HW as B1. |
| **P0v3** | 1 | 4 GB | $0.0775 | ~$57 | Cheapest Premium v3; 4 GB RAM at ~B2 price. |
| **P1v3** | 2 | 8 GB | $0.155 | ~$113 | Premium v3 "small". |
| **P2v3** | 4 | 16 GB | $0.31 | ~$226 | |
| **P3v3** | 8 | 32 GB | $0.62 | ~$453 | **Practical single-instance ceiling (general purpose).** |
| P1mv3 | 2 | 16 GB | $0.186 | ~$136 | Memory-optimized (2× RAM/core). |
| P2mv3 | 4 | 32 GB | $0.372 | ~$272 | |
| **P3mv3** | 8 | 64 GB | $0.744 | ~$543 | **Max single-instance RAM on Premium v3.** |

Specs: Premium v3 memory-to-core ratio per [Configure Premium V3 tier](https://learn.microsoft.com/azure/app-service/app-service-configure-premium-v3-tier); Basic B1/B2/B3 = 1/2/4 cores at 1.75/3.5/7 GB per [App Service plans / pricing tiers](https://learn.microsoft.com/azure/app-service/overview-hosting-plans#pricing-tiers). Prices are live retail meters from the [Azure Retail Prices API](https://prices.azure.com/api/retail/prices) (East US, USD), corroborated by the [App Service Linux pricing page](https://azure.microsoft.com/pricing/details/app-service/linux/). Premium v4 SKUs exist at similar/slightly-lower prices and are a drop-in newer-hardware alternative once broadly available.

### 1.2 The practical ceiling of a single Web App instance

App Service scales two independent ways — scale *up* (bigger SKU) and scale *out* (more instances) ([Scale up an app](https://learn.microsoft.com/azure/app-service/manage-scale-up)). Convex OSS can only use scale-*up*, so the single-instance ceiling is the **largest SKU**, not the tier's scale-out max:

- Basic scales out to 3, Standard to 10, Premium v2/v3/v4 to 30 instances ([App Service limits](https://learn.microsoft.com/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-app-service-limits)) — **all irrelevant** because we pin `numberOfWorkers: 1`.
- The realistic single-instance ceiling is **P3v3 (8 vCPU / 32 GB)** for CPU-bound projection load, or **P3mv3 (8 vCPU / 64 GB)** if memory (WebSocket fan-out, subscription state) is the constraint. Higher per-instance means Isolated v2 (an App Service Environment costing hundreds–thousands/month) — not sensible for a projection layer.
- **WebSocket note:** Linux apps support ~50k concurrent WebSocket connections per instance on paid SKUs ([App Service limits, footnote 7](https://learn.microsoft.com/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-app-service-limits)) — connection count is unlikely to be the ceiling; CPU on the single committer is.

**Bottom line: the usable vertical ladder is B1 → B2/B3 → P0v3/P1v3/P2v3 → P3v3/P3mv3, then you're out of runway on a single instance** — roughly **1→8 vCPU**, one order of magnitude of CPU headroom over today's B1.

---

## 2. Does self-hosted Convex have ANY horizontal / scale path? — No.

- **Single committer, by design.** "The **committer** in our system is the **sole writer to the transaction log**." — [How Convex works](https://stack.convex.dev/how-convex-works). This is why writes cannot be parallelized across nodes.
- **Self-hosted OSS is explicitly not built for scale.** The [self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md): self-hosted "supports all the free-tier features of the cloud-hosted product. **The cloud-hosted product is optimized for scale.**" No mention of multiple instances, horizontal scaling, read replicas, sharding, or clustering.
- **Docs steer scale-sensitive users to Cloud.** [docs.convex.dev/self-hosting](https://docs.convex.dev/self-hosting): "Self hosting is not for everyone. If you're looking for a more hands-off solution, we recommend using the Convex-hosted product."
- **Reads scale within the single instance; writes do not.** Convex caches query results and fans one write out to all subscribers over WebSocket ([realtime](https://docs.convex.dev/realtime)) — this is exactly what S1's "let Convex fan out" lever exploits — but there is **no read-replica model** in OSS; reads and writes share the one backend process and its one DB connection.

**Honest finding: there is no horizontal path for OSS Convex. The only levers are (a) write less, (b) make the one instance bigger, or (c) leave OSS for Convex Cloud.** Anything that "parallelizes" self-hosted Convex means running *N independent backends* (sharding, §3 Rank 4) — N unscaled systems, not one scaled one.

---

## 3. When vertical runs out — the realistic options, ranked

Ranked for a cost-conscious team whose Convex is **only a rebuildable projection layer** (Postgres is source of truth).

### Rank 1 — Reduce write volume further (S1/S2 + coalescing) — *do this first, before any scaling spend*

Highest-leverage, code-only, zero new infra; already scoped as Tier 1 (S1/S2) in the elimination plan.

**Quantified headroom.** One board action today costs **≈ N+1 Convex POSTs and ≈ 14N+ Postgres queries** for a team of N because the projection writes a **separate per-user snapshot per member**. S1 ("project once to a shared board doc, let Convex fan out to the N subscribers") collapses that to **~1 POST** per action:
- Team of 8: **~9 POSTs → 1** (~8–9× reduction).
- Team of 15 (~90th-pctile large retro): **~16 POSTs → 1** (~16× reduction).

S2 (delta `db.patch` instead of whole-board `JSON.stringify` + replace — [writing data](https://docs.convex.dev/database/writing-data)) shrinks each write's payload and OCC read-set on top.

**Why first:** an ~8–16× write cut is *more* single-writer headroom than the entire vertical ladder (~10× CPU B1→P3v3) — at **$0/mo** vs ~$450/mo. For realistic team sizes this very likely means the ceiling is never reached.

- **Cons:** changes the Convex projection data model *and* the UI read contract; the per-user permission filtering the current snapshot bakes in must be reproduced with a shared-doc + per-user-overlay design without leaking content — the main correctness risk.

### Rank 2 — Vertical bump the App Service SKU — *the mechanical, low-effort step*

Climb §1.1: **B1 → B2/B3 → P0v3/P1v3/P2v3 → P3v3 (or P3mv3 for memory pressure).** Scale-up "takes only seconds… without changing code or redeploying" ([Scale up an app](https://learn.microsoft.com/azure/app-service/manage-scale-up)) — a one-line `planSkuName`/`planSkuTier` change in the Bicep module.

- **Pros:** trivial; no architecture change; up to ~10× CPU over B1.
- **Cons:** finite (P3v3/P3mv3 is the wall); still a single instance / single point of failure (a restart pauses live updates until reconcile — the P1 backstop poll is the mitigation); pays for peak 24/7 (no scale-to-zero on dedicated tiers).
- **Cost:** ~$12/mo (B1) → ~$226/mo (P2v3) → ~$453/mo (P3v3) → ~$543/mo (P3mv3).

### Rank 3 (terminal) — Move the outgrown environment to Convex Cloud

The vendor's own answer to "self-hosted ran out of scale." Low-risk here because our Convex is a **rebuildable projection**: re-point `CONVEX_SYNC_URL`/`CONVEX_SYNC_ADMIN_KEY` (API) and `VITE_CONVEX_URL` (UI), deploy the same `convex/` functions, let the outbox + nightly reconciliation repopulate — no durable-data migration. **Production already runs on Convex Cloud**, so this is a known, deployed configuration.

Convex Cloud pricing ([convex.dev/pricing](https://www.convex.dev/pricing)):

| Plan | Price | Included / mo | Concurrency |
|---|---|---|---|
| Starter / Free | $0 + pay-as-you-go | 1M calls, 0.5 GB DB, 1 GB files | — |
| **Professional** | **$25 / developer / mo** | 25M calls, 50 GB DB, 100 GB files | 10,000 concurrent sessions, 256 queries, 512 actions |
| Business / Enterprise | $2,500/mo min | "Unlimited", custom scaling | Customizable |

- **Pros:** scaling is the vendor's problem; managed HA; no App Service ceiling; low-risk cutover; Pro quota dwarfs realistic retro/estimate load.
- **Cons:** recurring per-dev cost; projection data leaves self-hosted control (never the source of truth); Cloud's numeric limits are **not stated to apply** to OSS ([limits](https://docs.convex.dev/production/state/limits)).
- **Cost:** $25/dev/mo (Pro) — for a small team, comparable to or cheaper than a P3v3 plan, and it removes the ceiling *and* the SPOF.

### Rank 4 (avoid) — Shard by entity across multiple self-hosted instances

Route board X to `hash(X) % N`; each instance stays single-writer, the fleet parallelizes. Feasible in principle (projection keyed by disjoint entity ids) but a **footgun**:
- UI must know *which* instance to subscribe to per board (routing/discovery that doesn't exist; `VITE_CONVEX_URL` is build-time baked).
- **Cross-entity queries break** — `listRecentRetroProjections`, notifications roomed by `user:{id}`, any team-/user-wide view span shards and can't be one subscription.
- Sync layer must fan writes to the right shard and hold N admin keys; N× ops (containers, Azure Files mounts, backing DBs, health checks, base cost); rebalancing reshuffles every board when N changes.
- **Verdict:** don't. Convex Cloud gives the same parallelism with none of this. Sharding would only make sense under a hard no-cloud (data-residency) constraint *and* load a single P3mv3 can't serve — an unlikely corner.

### Rank 5 (situational, complementary) — Read-path offload to Postgres/REST

Since Postgres is source of truth, serve large boards via REST + polling (the P1 backstop, 15–30 s) and reserve Convex realtime for smaller boards. A **pressure-relief valve**, not a scaling tier.
- **Cons:** large boards lose true realtime; a per-board-size routing heuristic adds UI complexity.
- **Use as:** a targeted mitigation for a handful of pathologically large boards, at any stage.

### Azure Container Apps vs App Service for the Convex container

**No meaningful vertical advantage, arguably worse here.** A single ACA container maxes at **4 vCPU / 8 GiB on Consumption** ([config](https://learn.microsoft.com/azure/container-apps/containers#configuration)); exceeding it needs a Dedicated workload profile ([profiles](https://learn.microsoft.com/azure/container-apps/workload-profiles-overview#profile-details)) — more cost/complexity than App Service P3mv3. ACA is built to autoscale replicas; forcing `minReplicas = maxReplicas = 1` (no scale-to-zero, since a WebSocket backend must stay warm) fights the platform. **Stay on App Service** with `numberOfWorkers: 1` + `alwaysOn` + WebSockets.

---

## 4. Decision tree / triggers

Signals from the load-test harness ([`../../docker/loadtest/`](../../docker/loadtest/README.md)) and App Service `AllMetrics` + Log Analytics; outbox depth from `projection_outbox`; OCC errors are Convex [conflict errors](https://docs.convex.dev/error).

| Signal | Green | Amber (act soon) | Red (act now) |
|---|---|---|---|
| **Convex CPU %** (`CpuPercentage`) | < 50% sustained | 50–75% during bursts | > 80% sustained / pegged at peak |
| **OCC conflict / retry rate** | ~0 | occasional under burst | rising / retry storms |
| **Outbox depth / delivery lag** | drains each tick | backlog builds then drains | grows monotonically; lag > single-digit s |
| **Board-update latency (p95)** | < ~1 s | 1–3 s under burst | > 3 s sustained / stale boards |

Ordered escalation:

```
0. BASELINE — harness at 90th-pctile team size + a deliberately large team.
1. WRITE-REDUCTION FIRST (Rank 1). Trigger: any Amber under burst.
   Ship S1 + S2 + coalescing. Re-baseline. ~8–16× cut. → realistic sizes STOP HERE.
2. VERTICAL BUMP (Rank 2). Trigger: still Amber/Red AND CPU is the binding constraint.
   B1 → B2/B3 → P0v3/P1v3/P2v3 → P3v3 (P3mv3 if RAM-bound). One-line Bicep change; re-baseline.
3. TERMINAL (Rank 3). Trigger: Red persists at P3v3/P3mv3 for that environment.
   Move THAT env to Convex Cloud (re-point URLs, deploy functions, reconcile repopulates).
   Keep self-hosted only where load stays green. (Do NOT shard; read-path offload is a relief valve.)
```

The judgment encoded: **write-reduction buys more headroom than the entire vertical ladder, for free — so it always precedes any scaling spend.** Vertical is the cheap mechanical middle. Convex Cloud is the ceiling-remover of last resort, made safe by the rebuildable projection.

---

## 5. Cost framing

| Rung | SKU | vCPU / RAM | ~$/mo |
|---|---|---|---|
| Today | B1 | 1 / 1.75 GB | ~$12 |
| +1 | B2 | 2 / 3.5 GB | ~$25 |
| +2 | B3 | 4 / 7 GB | ~$49 |
| Premium entry | P0v3 | 1 / 4 GB | ~$57 |
| | P1v3 | 2 / 8 GB | ~$113 |
| | P2v3 | 4 / 16 GB | ~$226 |
| **Ceiling** | P3v3 | 8 / 32 GB | ~$453 |
| Ceiling (RAM) | P3mv3 | 8 / 64 GB | ~$543 |
| **Convex Cloud Pro** | — | managed | **~$25 / developer** |

Reserved-instance / savings-plan discounts on Premium v3 can cut App Service figures materially ([manage costs](https://learn.microsoft.com/azure/app-service/overview-manage-costs#optimize-costs)). **Framing:** write-reduction is $0; the vertical ladder tops out ~$450–540/mo for a still-single-instance-still-a-SPOF box — at which point Convex Cloud Pro (~$25/dev/mo) is comparable/cheaper *and* removes the ceiling and the SPOF. Treat vertical as a bridge, not a destination; reserve big vertical spend only for a hard no-cloud constraint.

---

## 6. Recommendation

1. **Ship write-reduction first (S1 kill-the-fan-out + S2 delta writes + S3 coalescing).** Free, already scoped, ~8–16× cut exceeds the whole vertical ladder. Gate on a harness baseline.
2. **If a single worker still saturates on CPU, climb the vertical ladder** (one-line Bicep SKU changes, re-baseline each rung). Cheap, mechanical, finite.
3. **When P3v3/P3mv3 is exhausted for an environment, move that environment to Convex Cloud** — low-risk (rebuildable projection, prod already runs it). Keep self-hosting where load stays green.
4. **Do not shard self-hosted Convex; do not move the container to ACA** for a higher ceiling. Use **read-path offload** as a targeted relief valve.
5. **Stay on App Service** (`numberOfWorkers: 1` + `alwaysOn` + WebSockets), keeping the P1 REST backstop + degraded-mode banner as the single-instance SPOF mitigation at every rung below Convex Cloud.

The throughline: **write less (free) → scale up (cheap, finite) → Convex Cloud (removes the ceiling, made safe by the rebuildable projection).**

---

**Sources:** [how Convex works](https://stack.convex.dev/how-convex-works) · [self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md) · [self-hosting docs](https://docs.convex.dev/self-hosting) · [Convex realtime](https://docs.convex.dev/realtime) · [Convex pricing](https://www.convex.dev/pricing) · [Convex limits](https://docs.convex.dev/production/state/limits) · [Convex OCC errors](https://docs.convex.dev/error) · [App Service pricing tiers](https://learn.microsoft.com/azure/app-service/overview-hosting-plans#pricing-tiers) · [scale up](https://learn.microsoft.com/azure/app-service/manage-scale-up) · [Premium v3 specs](https://learn.microsoft.com/azure/app-service/app-service-configure-premium-v3-tier) · [App Service limits](https://learn.microsoft.com/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-app-service-limits) · [manage costs](https://learn.microsoft.com/azure/app-service/overview-manage-costs#optimize-costs) · [App Service Linux pricing](https://azure.microsoft.com/pricing/details/app-service/linux/) · [Retail Prices API](https://prices.azure.com/api/retail/prices) · [ACA containers](https://learn.microsoft.com/azure/container-apps/containers#configuration) · [ACA workload profiles](https://learn.microsoft.com/azure/container-apps/workload-profiles-overview#profile-details) · [ACA scale](https://learn.microsoft.com/azure/container-apps/scale-app)
