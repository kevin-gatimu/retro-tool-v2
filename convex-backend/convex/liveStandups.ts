import { query, internalMutation } from './server'
import { v } from 'convex/values'
import { requireIdentity } from './lib/authz'

// ── Lightweight projection (one row per standup day) ─────────────────────────

export const upsertEntryProjection = internalMutation({
  args: {
    standupId: v.string(),
    entryDate: v.string(),
    teamId: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Read only this day's row via the composite index. Concurrent projection
    // upserts for different dates of the same standup would otherwise share a
    // `by_standup_id` read-set and fail Convex's OCC retry. Scoping to
    // (standupId, entryDate) keeps each call's read/write set disjoint.
    const existingProjection = await ctx.db
      .query('liveStandupEntries')
      .withIndex('by_standup_date', (q) =>
        q.eq('standupId', args.standupId).eq('entryDate', args.entryDate),
      )
      .unique()

    const nextProjection = {
      standupId: args.standupId,
      entryDate: args.entryDate,
      teamId: args.teamId,
      updatedAt: args.updatedAt,
    }

    if (existingProjection) {
      await ctx.db.patch(existingProjection._id, nextProjection)
      return { standupId: args.standupId, operation: 'updated' as const }
    }

    await ctx.db.insert('liveStandupEntries', nextProjection)
    return { standupId: args.standupId, operation: 'created' as const }
  },
})

export const deleteStandupProjection = internalMutation({
  args: {
    standupId: v.string(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query('liveStandupEntries')
      .withIndex('by_standup_id', (q) => q.eq('standupId', args.standupId))
      .collect()
    for (const entry of entries) {
      await ctx.db.delete(entry._id)
    }

    // Also clean up board snapshots for all users and dates.
    const boards = await ctx.db
      .query('liveStandupBoards')
      .withIndex('by_standup_id', (q) => q.eq('standupId', args.standupId))
      .collect()
    for (const board of boards) {
      await ctx.db.delete(board._id)
    }

    return { standupId: args.standupId, operation: 'deleted' as const }
  },
})

// ── Full board snapshot (used by the daily standup room page) ────────────────

export const upsertStandupBoard = internalMutation({
  args: {
    standupId: v.string(),
    entryDate: v.string(),
    userId: v.string(),
    snapshot: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Read only this user's row via the full composite index. The per-member
    // board fan-out pushes many users' boards for the same standup/date
    // concurrently; a `by_standup_id` scan would put every board row in each
    // call's read-set, so concurrent upserts overlap and fail Convex's OCC
    // retry. Scoping to (standupId, entryDate, userId) keeps each call's
    // read/write set disjoint.
    const existing = await ctx.db
      .query('liveStandupBoards')
      .withIndex('by_standup_date_user', (q) =>
        q
          .eq('standupId', args.standupId)
          .eq('entryDate', args.entryDate)
          .eq('userId', args.userId),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        snapshot: args.snapshot,
        updatedAt: args.updatedAt,
      })
      return { standupId: args.standupId, operation: 'updated' as const }
    }

    await ctx.db.insert('liveStandupBoards', {
      standupId: args.standupId,
      entryDate: args.entryDate,
      userId: args.userId,
      snapshot: args.snapshot,
      updatedAt: args.updatedAt,
    })
    return { standupId: args.standupId, operation: 'created' as const }
  },
})

export const getStandupBoard = query({
  args: {
    standupId: v.string(),
    entryDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const board = await ctx.db
      .query('liveStandupBoards')
      .withIndex('by_standup_date_user', (q) =>
        q
          .eq('standupId', args.standupId)
          .eq('entryDate', args.entryDate)
          .eq('userId', identity.subject),
      )
      .unique()

    if (!board) {
      return null
    }

    return {
      standupId: board.standupId,
      entryDate: board.entryDate,
      snapshot: board.snapshot,
      updatedAt: board.updatedAt,
    }
  },
})
