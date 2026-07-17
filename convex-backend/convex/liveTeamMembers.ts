import { internalMutation } from './server'
import { v } from 'convex/values'

// ── Team-membership projection ───────────────────────────────────────────────
//
// PostgreSQL is the source of truth. NestJS pushes a (userId, teamId) row after
// each membership mutation (add/remove/join/leave). Convex holds no team data of
// its own, so team-scoped read queries (see `lib/authz.ts` `getCallerTeamIds`)
// use this table to filter results to teams the authenticated caller belongs to.
// These are `internalMutation`s — callable only via the NestJS admin key, never
// from a browser, so membership can't be forged from the client.

export const upsertMembership = internalMutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Query the composite index by its `teamId` prefix, then match userId in JS.
    // The `./server` wrappers are schema-generic, so a chained `.eq().eq()` isn't
    // typed here; a team's membership list is bounded, so the prefix scan is cheap.
    const existing = (
      await ctx.db
        .query('liveTeamMembers')
        .withIndex('by_team_user', (q) => q.eq('teamId', args.teamId))
        .collect()
    ).find((row) => row.userId === args.userId)

    if (existing) {
      // Stale-guard: ignore an out-of-order sync that predates what we have.
      if (args.updatedAt < existing.updatedAt) {
        return { operation: 'noop' as const }
      }
      await ctx.db.patch(existing._id, { updatedAt: args.updatedAt })
      return { operation: 'updated' as const }
    }

    await ctx.db.insert('liveTeamMembers', {
      userId: args.userId,
      teamId: args.teamId,
      updatedAt: args.updatedAt,
    })
    return { operation: 'created' as const }
  },
})

export const deleteMembership = internalMutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = (
      await ctx.db
        .query('liveTeamMembers')
        .withIndex('by_team_user', (q) => q.eq('teamId', args.teamId))
        .collect()
    ).find((row) => row.userId === args.userId)

    if (!existing) {
      return { operation: 'noop' as const }
    }

    await ctx.db.delete(existing._id)
    return { operation: 'deleted' as const }
  },
})

// How many stale rows to delete per prune transaction. Keeps each mutation well
// within Convex's per-transaction document-write limit; the NestJS reconcile
// loop repeats the call until the table is clean.
const PRUNE_BATCH_SIZE = 200

/**
 * Reconciliation is mark-and-sweep, driven in bounded steps so no single
 * mutation does unbounded work (Convex query/mutation guidelines):
 *
 *  1. NestJS reads every `team_member` row from Postgres and calls
 *     `upsertMembership` per row, stamping each with the reconcile timestamp.
 *  2. NestJS then calls `pruneStaleMemberships` (this function) repeatedly until
 *     `done` is true, deleting rows older than that timestamp — memberships that
 *     no longer exist in Postgres — one bounded batch per call.
 *
 * A row's `updatedAt` is only bumped by a real membership push or by step 1, so
 * "older than the reconcile timestamp" precisely identifies stale projections.
 */
export const pruneStaleMemberships = internalMutation({
  args: {
    olderThan: v.number(),
  },
  handler: async (ctx, args) => {
    // No index on updatedAt, so filter post-scan — but the .take() keeps each
    // batch bounded regardless, and the caller repeats until `done`.
    const stale = await ctx.db
      .query('liveTeamMembers')
      .filter((q) => q.lt(q.field('updatedAt'), args.olderThan))
      .take(PRUNE_BATCH_SIZE)

    await Promise.all(stale.map((row) => ctx.db.delete(row._id)))

    // A full batch means there may be more stale rows; the caller calls again.
    return { deleted: stale.length, done: stale.length < PRUNE_BATCH_SIZE }
  },
})
