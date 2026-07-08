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
    const existingProjection = (
      await ctx.db
        .query('liveStandupEntries')
        .withIndex('by_standup_id', (queryBuilder) =>
          queryBuilder.eq('standupId', args.standupId),
        )
        .collect()
    ).find((entry) => entry.entryDate === args.entryDate)

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
    const existing = (
      await ctx.db
        .query('liveStandupBoards')
        .withIndex('by_standup_id', (q) => q.eq('standupId', args.standupId))
        .collect()
    ).find(
      (board) =>
        board.entryDate === args.entryDate && board.userId === args.userId,
    )

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
    const board = (
      await ctx.db
        .query('liveStandupBoards')
        .withIndex('by_standup_id', (q) => q.eq('standupId', args.standupId))
        .collect()
    ).find(
      (item) =>
        item.entryDate === args.entryDate && item.userId === identity.subject,
    )

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
