import { mutation, query, internalMutation } from './server'
import { v } from 'convex/values'
import { getCallerTeamIds, isAdminRole, requireIdentity } from './lib/authz'
import { LIST_PROJECTION_CAP } from './lib/limits'
import { rateLimiter } from './rateLimits'

const retroStatus = v.union(
  v.literal('draft'),
  v.literal('waiting'),
  v.literal('active'),
  v.literal('grouping'),
  v.literal('voting'),
  v.literal('discussing'),
  v.literal('completed'),
)

// ── Lightweight projection (used by list pages) ──────────────────────────────

export const upsertRetroProjection = internalMutation({
  args: {
    retroId: v.string(),
    teamId: v.string(),
    status: retroStatus,
    currentDiscussionCardId: v.optional(v.string()),
    currentDiscussionActionItemId: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existingProjection = await ctx.db
      .query('liveRetroSessions')
      .withIndex('by_retro_id', (queryBuilder) =>
        queryBuilder.eq('retroId', args.retroId),
      )
      .unique()

    const nextProjection = {
      retroId: args.retroId,
      teamId: args.teamId,
      status: args.status,
      currentDiscussionCardId: args.currentDiscussionCardId,
      currentDiscussionActionItemId: args.currentDiscussionActionItemId,
      updatedAt: args.updatedAt,
    }

    if (existingProjection) {
      if (args.updatedAt < existingProjection.updatedAt) {
        return { retroId: args.retroId, operation: 'noop' as const }
      }
      await ctx.db.patch(existingProjection._id, nextProjection)
      return { retroId: args.retroId, operation: 'updated' as const }
    }

    await ctx.db.insert('liveRetroSessions', nextProjection)
    return { retroId: args.retroId, operation: 'created' as const }
  },
})

export const deleteRetroProjection = internalMutation({
  args: {
    retroId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingProjection = await ctx.db
      .query('liveRetroSessions')
      .withIndex('by_retro_id', (queryBuilder) =>
        queryBuilder.eq('retroId', args.retroId),
      )
      .unique()

    if (!existingProjection) {
      return { retroId: args.retroId, operation: 'noop' as const }
    }

    await ctx.db.delete(existingProjection._id)

    // Also clean up board snapshots for all users.
    const boards = await ctx.db
      .query('liveRetroBoards')
      .withIndex('by_retro_id', (q) => q.eq('retroId', args.retroId))
      .collect()
    for (const board of boards) {
      await ctx.db.delete(board._id)
    }

    return { retroId: args.retroId, operation: 'deleted' as const }
  },
})

export const getRetroProjection = query({
  args: {
    retroId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    const projection = await ctx.db
      .query('liveRetroSessions')
      .withIndex('by_retro_id', (queryBuilder) =>
        queryBuilder.eq('retroId', args.retroId),
      )
      .unique()

    if (!projection) {
      return null
    }

    return {
      retroId: projection.retroId,
      status: projection.status,
      currentDiscussionCardId: projection.currentDiscussionCardId,
      currentDiscussionActionItemId: projection.currentDiscussionActionItemId,
      updatedAt: new Date(projection.updatedAt).toISOString(),
    }
  },
})

export const listRecentRetroProjections = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const projections = await ctx.db.query('liveRetroSessions').collect()

    // Scope to the caller's teams (`null` = admin, pass all) — invalidation
    // signal only, but stops cross-tenant retro enumeration.
    const teamIds = isAdminRole(identity.role)
      ? null
      : await getCallerTeamIds(ctx, identity.subject)

    return projections
      .filter((projection) => !teamIds || teamIds.has(projection.teamId))
      .sort((left, right) => left.retroId.localeCompare(right.retroId))
      .slice(0, LIST_PROJECTION_CAP)
      .map((projection) => ({
        retroId: projection.retroId,
        status: projection.status,
        updatedAt: new Date(projection.updatedAt).toISOString(),
      }))
  },
})

// ── Full board snapshot (used by the retro detail page) ──────────────────────

export const upsertRetroBoard = internalMutation({
  args: {
    retroId: v.string(),
    userId: v.string(),
    snapshot: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = (
      await ctx.db
      .query('liveRetroBoards')
      .withIndex('by_retro_id', (q) => q.eq('retroId', args.retroId))
      .collect()
    ).find((board) => board.userId === args.userId)

    if (existing) {
      if (args.updatedAt < existing.updatedAt) {
        return { retroId: args.retroId, operation: 'noop' as const }
      }
      await ctx.db.patch(existing._id, {
        snapshot: args.snapshot,
        updatedAt: args.updatedAt,
      })
      return { retroId: args.retroId, operation: 'updated' as const }
    }

    await ctx.db.insert('liveRetroBoards', {
      retroId: args.retroId,
      userId: args.userId,
      snapshot: args.snapshot,
      updatedAt: args.updatedAt,
    })
    return { retroId: args.retroId, operation: 'created' as const }
  },
})

export const getRetroBoard = query({
  args: {
    retroId: v.string(),
    // Deprecated: identity is derived server-side from the JWT. Kept optional so
    // older clients that still send it don't fail arg validation (removed once
    // all clients are updated). The value is ignored for authorization.
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const board = (
      await ctx.db
      .query('liveRetroBoards')
      .withIndex('by_retro_id', (q) => q.eq('retroId', args.retroId))
      .collect()
    ).find((item) => item.userId === identity.subject)

    if (!board) {
      return null
    }

    return {
      retroId: board.retroId,
      snapshot: board.snapshot,
      updatedAt: board.updatedAt,
    }
  },
})

// ── Typing indicators (Adding Cards phase) ────────────────────────────────────

export const startTyping = mutation({
  args: {
    retroId: v.string(),
    // Deprecated: derived from identity server-side. Ignored for authorization.
    userId: v.optional(v.string()),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await rateLimiter.limit(ctx, 'liveInteraction', {
      key: identity.subject,
      throws: true,
    })
    const existing = (
      await ctx.db
        .query('liveTyping')
        .withIndex('by_retro', (q) => q.eq('retroId', args.retroId))
        .collect()
    ).find((r) => r.userId === identity.subject)

    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: Date.now(),
        displayName: args.displayName,
      })
    } else {
      await ctx.db.insert('liveTyping', {
        retroId: args.retroId,
        userId: identity.subject,
        displayName: args.displayName,
        updatedAt: Date.now(),
      })
    }
  },
})

export const stopTyping = mutation({
  args: {
    retroId: v.string(),
    // Deprecated: derived from identity server-side. Ignored for authorization.
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await rateLimiter.limit(ctx, 'liveInteraction', {
      key: identity.subject,
      throws: true,
    })
    const existing = (
      await ctx.db
        .query('liveTyping')
        .withIndex('by_retro', (q) => q.eq('retroId', args.retroId))
        .collect()
    ).find((r) => r.userId === identity.subject)

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})

export const getTypingUsers = query({
  args: {
    retroId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    return ctx.db
      .query('liveTyping')
      .withIndex('by_retro', (q) => q.eq('retroId', args.retroId))
      .collect()
  },
})

// ── Ready status (Adding Cards phase) ────────────────────────────────────────

export const setReadyStatus = mutation({
  args: {
    retroId: v.string(),
    // Deprecated: derived from identity server-side. Ignored for authorization.
    userId: v.optional(v.string()),
    displayName: v.string(),
    isReady: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await rateLimiter.limit(ctx, 'liveInteraction', {
      key: identity.subject,
      throws: true,
    })
    const existing = (
      await ctx.db
        .query('liveReadyStatus')
        .withIndex('by_retro', (q) => q.eq('retroId', args.retroId))
        .collect()
    ).find((r) => r.userId === identity.subject)

    if (existing) {
      await ctx.db.patch(existing._id, {
        isReady: args.isReady,
        displayName: args.displayName,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert('liveReadyStatus', {
        retroId: args.retroId,
        userId: identity.subject,
        displayName: args.displayName,
        isReady: args.isReady,
        updatedAt: Date.now(),
      })
    }
  },
})

export const getReadyStatus = query({
  args: {
    retroId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    return ctx.db
      .query('liveReadyStatus')
      .withIndex('by_retro', (q) => q.eq('retroId', args.retroId))
      .collect()
  },
})

export const clearAllReady = mutation({
  args: {
    retroId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    const statuses = await ctx.db
      .query('liveReadyStatus')
      .withIndex('by_retro', (q) => q.eq('retroId', args.retroId))
      .collect()
    for (const status of statuses) {
      await ctx.db.delete(status._id)
    }
  },
})
