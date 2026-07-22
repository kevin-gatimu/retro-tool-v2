import { defineApp } from 'convex/server'
import rateLimiter from '@convex-dev/rate-limiter/convex.config'

const app = defineApp()

// ── Rate Limiter ─────────────────────────────────────────────────────────────
// Single instance; individual named limits are defined in rateLimits.ts
app.use(rateLimiter)

// ── Aggregates (retired) ─────────────────────────────────────────────────────
// The @convex-dev/aggregate counters that once backed liveReports.ts were
// retired with the reports v2 redesign: historical/analytical reporting is
// answered by PostgreSQL (the system of record) via /api/reports/v2/*, and
// nothing subscribed to the aggregate-backed queries. See
// REPORTS-REDESIGN-PLAN.md §7.

export default app
