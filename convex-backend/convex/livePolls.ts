import { query, internalMutation } from './server'
import { v } from 'convex/values'
import { getCallerTeamIds, isAdminRole, requireIdentity } from './lib/authz'
import { LIST_PROJECTION_CAP } from './lib/limits'

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
    const identity = await requireIdentity(ctx)
    const projections = await ctx.db.query('livePolls').collect()

    // Scope to teams the caller belongs to. `null` means "admin — pass all".
    // This is only an invalidation signal — the UI refetches the REST list which
    // re-applies per-viewer authorization — but scoping stops cross-tenant
    // enumeration.
    const teamIds = isAdminRole(identity.role)
      ? null
      : await getCallerTeamIds(ctx, identity.subject)

    return projections
      .filter((projection) => !teamIds || teamIds.has(projection.teamId))
      .sort((left, right) => left.pollId.localeCompare(right.pollId))
      .slice(0, LIST_PROJECTION_CAP)
      .map((projection) => ({
        pollId: projection.pollId,
        isClosed: projection.isClosed,
        updatedAt: new Date(projection.updatedAt).toISOString(),
      }))
  },
})
