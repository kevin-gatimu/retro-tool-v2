import { query, internalMutation } from './server'
import { v } from 'convex/values'
import { requireIdentity } from './lib/authz'

// ── Lightweight projection (used by the polls list page) ─────────────────────
//
// PostgreSQL is the source of truth. NestJS pushes this projection after each
// poll mutation; the UI subscribes to `listPollProjections`, and on any change
// invalidates the REST-backed `['polls']` query (which re-applies per-viewer
// authorization). We intentionally store no vote data here — anonymity and
// membership scoping stay server-side in the REST endpoint.

export const upsertPollProjection = internalMutation({
  args: {
    pollId: v.string(),
    teamId: v.string(),
    isClosed: v.boolean(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('livePolls')
      .withIndex('by_poll_id', (q) => q.eq('pollId', args.pollId))
      .unique()

    if (existing) {
      // Stale-guard: ignore an out-of-order sync that predates what we have.
      if (args.updatedAt < existing.updatedAt) {
        return { pollId: args.pollId, operation: 'noop' as const }
      }
      await ctx.db.patch(existing._id, {
        teamId: args.teamId,
        isClosed: args.isClosed,
        updatedAt: args.updatedAt,
      })
      return { pollId: args.pollId, operation: 'updated' as const }
    }

    await ctx.db.insert('livePolls', {
      pollId: args.pollId,
      teamId: args.teamId,
      isClosed: args.isClosed,
      updatedAt: args.updatedAt,
    })
    return { pollId: args.pollId, operation: 'created' as const }
  },
})

export const deletePollProjection = internalMutation({
  args: {
    pollId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('livePolls')
      .withIndex('by_poll_id', (q) => q.eq('pollId', args.pollId))
      .unique()

    if (!existing) {
      return { pollId: args.pollId, operation: 'noop' as const }
    }

    await ctx.db.delete(existing._id)
    return { pollId: args.pollId, operation: 'deleted' as const }
  },
})

export const listPollProjections = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx)
    const projections = await ctx.db.query('livePolls').collect()

    return projections
      .sort((left, right) => left.pollId.localeCompare(right.pollId))
      .map((projection) => ({
        pollId: projection.pollId,
        isClosed: projection.isClosed,
        updatedAt: new Date(projection.updatedAt).toISOString(),
      }))
  },
})
