import { mutation, query } from './server'
import { v } from 'convex/values'

const estimateSessionStatus = v.union(
  v.literal('waiting'),
  v.literal('voting'),
  v.literal('revealed'),
  v.literal('completed'),
)

// ── Lightweight projection (used by list pages) ──────────────────────────────

export const upsertSessionProjection = mutation({
  args: {
    sessionId: v.string(),
    teamId: v.string(),
    status: estimateSessionStatus,
    currentRoundId: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existingProjection = await ctx.db
      .query('liveEstimateSessions')
      .withIndex('by_session_id', (queryBuilder) =>
        queryBuilder.eq('sessionId', args.sessionId),
      )
      .unique()

    const nextProjection = {
      sessionId: args.sessionId,
      teamId: args.teamId,
      status: args.status,
      currentRoundId: args.currentRoundId,
      updatedAt: args.updatedAt,
    }

    if (existingProjection) {
      await ctx.db.patch(existingProjection._id, nextProjection)
      return { sessionId: args.sessionId, operation: 'updated' as const }
    }

    await ctx.db.insert('liveEstimateSessions', nextProjection)
    return { sessionId: args.sessionId, operation: 'created' as const }
  },
})

export const deleteSessionProjection = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('liveEstimateSessions')
      .withIndex('by_session_id', (q) =>
        q.eq('sessionId', args.sessionId),
      )
      .unique()

    if (!existing) {
      return { sessionId: args.sessionId, operation: 'noop' as const }
    }

    await ctx.db.delete(existing._id)

    // Also clean up board snapshots for all users.
    const boards = await ctx.db
      .query('liveEstimateBoards')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    for (const board of boards) {
      await ctx.db.delete(board._id)
    }

    return { sessionId: args.sessionId, operation: 'deleted' as const }
  },
})

export const getSessionProjection = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const projection = await ctx.db
      .query('liveEstimateSessions')
      .withIndex('by_session_id', (queryBuilder) =>
        queryBuilder.eq('sessionId', args.sessionId),
      )
      .unique()

    if (!projection) {
      return null
    }

    return {
      sessionId: projection.sessionId,
      currentRoundId: projection.currentRoundId,
      status: projection.status,
      updatedAt: new Date(projection.updatedAt).toISOString(),
    }
  },
})

export const listActiveSessionProjections = query({
  args: {},
  handler: async (ctx) => {
    const projections = await ctx.db.query('liveEstimateSessions').collect()

    return projections
      .filter((projection) => projection.status !== 'completed')
      .sort((left, right) => left.sessionId.localeCompare(right.sessionId))
      .map((projection) => ({
        sessionId: projection.sessionId,
        status: projection.status,
        updatedAt: new Date(projection.updatedAt).toISOString(),
      }))
  },
})

// ── Full board snapshot (used by the estimate detail page) ───────────────────

export const upsertEstimateBoard = mutation({
  args: {
    sessionId: v.string(),
    userId: v.string(),
    snapshot: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = (
      await ctx.db
      .query('liveEstimateBoards')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    ).find((board) => board.userId === args.userId)

    if (existing) {
      await ctx.db.patch(existing._id, {
        snapshot: args.snapshot,
        updatedAt: args.updatedAt,
      })
      return { sessionId: args.sessionId, operation: 'updated' as const }
    }

    await ctx.db.insert('liveEstimateBoards', {
      sessionId: args.sessionId,
      userId: args.userId,
      snapshot: args.snapshot,
      updatedAt: args.updatedAt,
    })
    return { sessionId: args.sessionId, operation: 'created' as const }
  },
})

export const getEstimateBoard = query({
  args: {
    sessionId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const board = (
      await ctx.db
      .query('liveEstimateBoards')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    ).find((item) => item.userId === args.userId)

    if (!board) {
      return null
    }

    return {
      sessionId: board.sessionId,
      snapshot: board.snapshot,
      updatedAt: board.updatedAt,
    }
  },
})