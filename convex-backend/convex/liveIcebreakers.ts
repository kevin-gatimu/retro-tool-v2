import { query, internalMutation } from './server'
import { v } from 'convex/values'
import { getCallerTeamIds, isAdminRole, requireIdentity } from './lib/authz'
import { LIST_PROJECTION_CAP } from './lib/limits'

const icebreakerSessionStatus = v.union(
  v.literal('waiting'),
  v.literal('curating'),
  v.literal('presenting'),
  v.literal('completed'),
)

// ── Lightweight projection (used by list pages) ──────────────────────────────

export const upsertSessionProjection = internalMutation({
  args: {
    sessionId: v.string(),
    teamId: v.string(),
    status: icebreakerSessionStatus,
    currentPromptId: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existingProjection = await ctx.db
      .query('liveIcebreakerSessions')
      .withIndex('by_session_id', (queryBuilder) =>
        queryBuilder.eq('sessionId', args.sessionId),
      )
      .unique()

    const nextProjection = {
      sessionId: args.sessionId,
      teamId: args.teamId,
      status: args.status,
      currentPromptId: args.currentPromptId,
      updatedAt: args.updatedAt,
    }

    if (existingProjection) {
      await ctx.db.patch(existingProjection._id, nextProjection)
      return { sessionId: args.sessionId, operation: 'updated' as const }
    }

    await ctx.db.insert('liveIcebreakerSessions', nextProjection)
    return { sessionId: args.sessionId, operation: 'created' as const }
  },
})

export const deleteSessionProjection = internalMutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('liveIcebreakerSessions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .unique()

    if (!existing) {
      return { sessionId: args.sessionId, operation: 'noop' as const }
    }

    await ctx.db.delete(existing._id)

    // Also clean up board snapshots for all users.
    const boards = await ctx.db
      .query('liveIcebreakerBoards')
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
    await requireIdentity(ctx)
    const projection = await ctx.db
      .query('liveIcebreakerSessions')
      .withIndex('by_session_id', (queryBuilder) =>
        queryBuilder.eq('sessionId', args.sessionId),
      )
      .unique()

    if (!projection) {
      return null
    }

    return {
      sessionId: projection.sessionId,
      currentPromptId: projection.currentPromptId,
      status: projection.status,
      updatedAt: new Date(projection.updatedAt).toISOString(),
    }
  },
})

export const listActiveSessionProjections = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const projections = await ctx.db.query('liveIcebreakerSessions').collect()

    // Scope to the caller's teams (`null` = admin, pass all) — invalidation
    // signal only, but stops cross-tenant session enumeration.
    const teamIds = isAdminRole(identity.role)
      ? null
      : await getCallerTeamIds(ctx, identity.subject)

    return projections
      .filter(
        (projection) =>
          projection.status !== 'completed' &&
          (!teamIds || teamIds.has(projection.teamId)),
      )
      .sort((left, right) => left.sessionId.localeCompare(right.sessionId))
      .slice(0, LIST_PROJECTION_CAP)
      .map((projection) => ({
        sessionId: projection.sessionId,
        status: projection.status,
        updatedAt: new Date(projection.updatedAt).toISOString(),
      }))
  },
})

// ── Full board snapshot (used by the icebreaker detail page) ─────────────────

export const upsertIcebreakerBoard = internalMutation({
  args: {
    sessionId: v.string(),
    userId: v.string(),
    snapshot: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = (
      await ctx.db
        .query('liveIcebreakerBoards')
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

    await ctx.db.insert('liveIcebreakerBoards', {
      sessionId: args.sessionId,
      userId: args.userId,
      snapshot: args.snapshot,
      updatedAt: args.updatedAt,
    })
    return { sessionId: args.sessionId, operation: 'created' as const }
  },
})

export const getIcebreakerBoard = query({
  args: {
    sessionId: v.string(),
    // Deprecated: identity is derived server-side from the JWT. Kept optional so
    // older clients that still send it don't fail arg validation. The value is
    // ignored for authorization.
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const board = (
      await ctx.db
        .query('liveIcebreakerBoards')
        .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
        .collect()
    ).find((item) => item.userId === identity.subject)

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
