import { defineApp } from 'convex/server'
import rateLimiter from '@convex-dev/rate-limiter/convex.config'
import aggregate from '@convex-dev/aggregate/convex.config'

const app = defineApp()

// ── Rate Limiter ─────────────────────────────────────────────────────────────
// Single instance; individual named limits are defined in rateLimits.ts
app.use(rateLimiter)

// ── Aggregates ───────────────────────────────────────────────────────────────
// Each named instance tracks a separate denormalized counter / sum tree.
// Source data lives in PostgreSQL; NestJS writes to these via HTTP Admin API.

/** Retro completions per team — enables team retro count & timeline queries */
app.use(aggregate, { name: 'retrosCompletedByTeam' })

/** Card creation per team+user — enables per-user and per-team card counts */
app.use(aggregate, { name: 'cardsByTeamUser' })

/** Votes cast per team+user — enables per-user and per-team vote counts */
app.use(aggregate, { name: 'votesByTeamUser' })

/** Action items per team grouped by status — enables completion-rate queries */
app.use(aggregate, { name: 'actionItemsByTeamStatus' })

/** Estimate sessions per team — enables estimate session count & timeline */
app.use(aggregate, { name: 'estimateSessionsByTeam' })

/** Global retro count across all teams — system-level overview */
app.use(aggregate, { name: 'systemRetros' })

/** Global user count — system-level overview */
app.use(aggregate, { name: 'systemUsers' })

export default app
