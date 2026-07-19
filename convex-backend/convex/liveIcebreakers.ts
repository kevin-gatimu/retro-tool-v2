import { query, mutation, internalMutation } from './server'
import { ConvexError, v } from 'convex/values'
import type { GenericQueryCtx, GenericMutationCtx } from 'convex/server'
import type { DataModel } from './_generated/dataModel'
import {
  assertTeamMembership,
  getCallerTeamIds,
  isAdminRole,
  requireIdentity,
} from './lib/authz'
import {
  LIST_PROJECTION_CAP,
  MAX_REACTIONS_PER_SESSION,
  REACTION_TTL_MS,
} from './lib/limits'
import { rateLimiter } from './rateLimits'

type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>

/**
 * Gate a caller's access to a session's live reaction signals.
 *
 * Returns `'missing'` if the session projection doesn't exist — this is normal
 * during teardown: ending a session deletes its projection while other users'
 * reaction subscriptions are still briefly live, so treating a missing session
 * as Forbidden would throw at every subscriber right after End. Callers decide
 * what to do (the query returns nothing; the mutation rejects).
 *
 * When the session DOES exist, the caller must belong to its team (or be a
 * system admin) — otherwise `assertTeamMembership` throws `Forbidden`, so an
 * authenticated user still can't touch another team's session.
 */
async function checkSessionMembership(
  ctx: Ctx,
  identity: { subject: string; role?: string },
  sessionId: string,
): Promise<'ok' | 'missing'> {
  const session = await ctx.db
    .query('liveIcebreakerSessions')
    .withIndex('by_session_id', (q) => q.eq('sessionId', sessionId))
    .unique()

  if (!session) {
    return 'missing'
  }

  await assertTeamMembership(ctx, identity, session.teamId)
  return 'ok'
}

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
    // Read only this user's row via the composite index. The per-member board
    // fan-out pushes many users' boards for the same session concurrently; a
    // `by_session_id` scan would put every board row in each call's read-set,
    // so concurrent upserts overlap and fail Convex's OCC retry. Scoping to
    // (sessionId, userId) keeps each call's read/write set disjoint.
    const existing = await ctx.db
      .query('liveIcebreakerBoards')
      .withIndex('by_session_user', (q) =>
        q.eq('sessionId', args.sessionId).eq('userId', args.userId),
      )
      .unique()

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
    const board = await ctx.db
      .query('liveIcebreakerBoards')
      .withIndex('by_session_user', (q) =>
        q.eq('sessionId', args.sessionId).eq('userId', identity.subject),
      )
      .unique()

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

// ── Live reactions (direct, ephemeral fast path — mirrors retro typing) ───────
//
// During the presenting phase anyone can react to a great answer (celebrate /
// applause / fire). Each click broadcasts to every participant, who fires the
// same confetti burst. This is a high-frequency, transient signal, so it takes
// its own direct Convex path instead of the coalesced projection-outbox: the
// client calls `sendReaction` and subscribes to `getRecentReactions`. Nothing
// is durable — rows self-expire (REACTION_TTL_MS) and never touch PostgreSQL.

const reactionKind = v.union(
  v.literal('celebrate'),
  v.literal('applause'),
  v.literal('fire'),
)

export const sendReaction = mutation({
  args: {
    sessionId: v.string(),
    kind: reactionKind,
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await rateLimiter.limit(ctx, 'liveInteraction', {
      key: identity.subject,
      throws: true,
    })
    // Only members of the session's team may broadcast into it. A missing
    // session (already ended) can't be reacted to.
    if ((await checkSessionMembership(ctx, identity, args.sessionId)) !== 'ok') {
      throw new ConvexError('Forbidden')
    }

    await ctx.db.insert('liveIcebreakerReactions', {
      sessionId: args.sessionId,
      userId: identity.subject,
      kind: args.kind,
      createdAt: Date.now(),
    })

    // Opportunistically prune this session's expired reactions so the table
    // self-trims without a cron. Bounded by MAX_REACTIONS_PER_SESSION, and the
    // read is scoped to this session so it never scans the whole table.
    const cutoff = Date.now() - REACTION_TTL_MS
    const stale = await ctx.db
      .query('liveIcebreakerReactions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .take(MAX_REACTIONS_PER_SESSION)
    for (const row of stale) {
      if (row.createdAt < cutoff) {
        await ctx.db.delete(row._id)
      }
    }
  },
})

export const getRecentReactions = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    // Only members of the session's team may read its reactions. If the session
    // is gone (ended), return nothing rather than throwing — other users'
    // subscriptions stay live for a moment after End and would otherwise error.
    if (
      (await checkSessionMembership(ctx, identity, args.sessionId)) !== 'ok'
    ) {
      return []
    }
    const cutoff = Date.now() - REACTION_TTL_MS
    const rows = await ctx.db
      .query('liveIcebreakerReactions')
      .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
      .take(MAX_REACTIONS_PER_SESSION)

    // Only surface still-"recent" reactions. Each row's _id is a stable unique
    // key the client dedupes on, so a burst is fired exactly once per viewer.
    return rows
      .filter((row) => row.createdAt >= cutoff)
      .map((row) => ({
        id: row._id,
        userId: row.userId,
        kind: row.kind,
        createdAt: row.createdAt,
      }))
  },
})
