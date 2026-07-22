# Projection load-test harness

Locally reproduce the **write-burst → single Convex worker** bottleneck to
validate the Tier-1 scaling changes (see
[docs/architecture/socket-io-elimination-plan.md](../../docs/architecture/socket-io-elimination-plan.md)
§6). Measures the *relative* before/after effect of each change; treat absolute
numbers as directional (local Postgres is faster than Azure Flexible Server).

## Why constrain Convex

Staging/production run the self-hosted Convex backend on a **single-worker Azure
App Service B1** (`numberOfWorkers: 1`, ~1 vCPU). That single worker is the
throughput ceiling under burst. Your local Convex container runs unconstrained
on your full dev CPU, so an unconstrained local test is meaningless. The
`docker-compose.loadtest.yml` override pins the Convex container to ≈B1.

## Run it

```bash
# 1. Start the stack with the load-test override (constrained Convex).
docker compose --env-file docker/.env \
  -f docker/docker-compose.local.yml \
  -f docker/docker-compose.loadtest.yml up -d --build

# 2. Migrate + seed templates + the load fixture (team of N; default 50).
pnpm --dir retro-tool-api db:migrate
pnpm --dir retro-tool-api db:seed:templates
LOADTEST_TEAM_SIZE=50 pnpm --dir retro-tool-api db:seed:load
#   → prints { teamId, retroId, ownerEmail, password }

# 3. In one terminal, watch the outbox drain:
node docker/loadtest/watch-outbox.mjs

# 4. In another, fire the burst (use the retroId from step 2):
API=http://localhost:8000 RETRO_ID=<retroId> \
  node docker/loadtest/burst.mjs --rate 40 --duration 60

# 5. In a third, watch the Convex worker CPU:
docker stats retro-tool-convex-backend
```

## The four signals

| Signal | Where | "Bad" looks like |
|---|---|---|
| Outbox queue depth + lag | `watch-outbox.mjs` (`pending`, `oldest`) | `pending` climbs and never drains; `oldest` grows to seconds |
| Convex worker saturation | `docker stats` on the Convex container | CPU pinned at the 1.0 limit for the whole burst |
| OCC conflict/retry errors | `docker compose logs convex-backend` | rising "changed while this mutation was being run" errors |
| Client latency / errors | `burst.mjs` summary (p50/p90/p99, failed) | p99 growing into seconds; non-zero failed |

## Before/after protocol

1. **Baseline:** on `staging` (before Tier 1), sweep `--rate` and
   `LOADTEST_TEAM_SIZE` until `pending` diverges or p99 exceeds your UX budget.
   Record the breaking point.
2. **After Tier 1** (this branch): re-run the identical sweep. Expect the
   coalescing (S3) to collapse repeated cards on the same board, the bounded
   concurrency + backoff (S5) to keep the queue draining, and the keep-alive
   pool (S4) to cut per-POST latency.
3. Compare peak `pending`, drain time after the burst, Convex CPU headroom, and
   client p99 at your 90th-percentile team size.

> S1/S2 (eliminating the per-member fan-out) are the largest lever and are a
> separate follow-up — this harness is what produces the baseline that decides
> how far they need to go.

## Tuning knobs (in `retro-tool-api/src/convex-admin/projection-outbox.service.ts`)

- `DELIVERY_CONCURRENCY` — deliveries in flight at once.
- `BACKOFF_BASE_MS` / `BACKOFF_MAX_MS` — failed-row retry backoff.
- `COALESCE_DEBOUNCE_MS` / `COALESCE_MAX_WAIT_MS` — per-entity coalescing window
  (set debounce to 0 to disable coalescing and measure its contribution).
