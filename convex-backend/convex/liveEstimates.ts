import { query, mutation, internalMutation } from './server'
import { v } from 'convex/values'
import { getCallerTeamIds, isAdminRole, requireIdentity } from './lib/authz'
import { LIST_PROJECTION_CAP, MAX_PRESENCE_PER_SESSION } from './lib/limits'
import { rateLimiter } from './rateLimits'

const estimateSessionStatus = v.union(
  v.literal('waiting'),
  v.literal('voting'),
  v.literal('revealed'),
  v.literal('completed'),
)

// ── Lightweight projection (used by list pages) ──────────────────────────────

export const upsertSessionProjection = internalMutation({
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

export const deleteSessionProjection = internalMutation({
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
    await requireIdentity(ctx)
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
    const identity = await requireIdentity(ctx)
    const projections = await ctx.db.query('liveEstimateSessions').collect()

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

// ── Full board snapshot (used by the estimate detail page) ───────────────────

export const upsertEstimateBoard = internalMutation({
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
      .query('liveEstimateBoards')
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
    // Deprecated: identity is derived server-side from the JWT. Kept optional so
    // older clients that still send it don't fail arg validation (removed once
    // all clients are updated). The value is ignored for authorization.
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const board = await ctx.db
      .query('liveEstimateBoards')
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

// ── Online presence (direct, fast path — mirrors retro ready-status) ─────────
//
// Presence (join/leave) is a high-frequency, low-value signal. Routing it
// through the projection-outbox → per-member board fan-out made the participant
// list / "N online" count lag and flap. These three functions give presence its
// own direct Convex path: the client calls `setPresence` on mount/unmount and
// subscribes to `getSessionPresence` (session page) / `listOnlineCounts` (list
// page), so join/leave reflects instantly without the board projection.

export const setPresence = mutation({
  args: {
    sessionId: v.string(),
    displayName: v.string(),
    online: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await rateLimiter.limit(ctx, 'liveInteraction', {
      key: identity.subject,
      throws: true,
    })
    // Scope the read to this caller's single (sessionId, userId) row so
    // concurrent presence writes from other members don't overlap read-sets
    // and fail Convex's OCC retry (same reasoning as the board upsert).
    const existing = await ctx.db
      .query('liveEstimatePresence')
      .withIndex('by_session_user', (q) =>
        q.eq('sessionId', args.sessionId).eq('userId', identity.subject),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        online: args.online,
        displayName: args.displayName,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert('liveEstimatePresence', {
        sessionId: args.sessionId,
        userId: identity.subject,
        displayName: args.displayName,
        online: args.online,
        updatedAt: Date.now(),
      })
    }
  },
})

export const getSessionPresence = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    const rows = await ctx.db
      .query('liveEstimatePresence')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .take(MAX_PRESENCE_PER_SESSION)

    // Return only what the UI needs — do not leak updatedAt / internal ids.
    return rows.map((row) => ({
      userId: row.userId,
      displayName: row.displayName,
      online: row.online,
    }))
  },
})

export const listOnlineCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)

    // Scope to the caller's teams the same way `listActiveSessionProjections`
    // does: admins see all, everyone else only sees sessions on teams they
    // belong to. The `liveEstimateSessions` projection is the authority on which
    // sessions exist and which team each belongs to, so we gate visibility there
    // and only surface counts for sessions present in that (bounded) table.
    const teamIds = isAdminRole(identity.role)
      ? null
      : await getCallerTeamIds(ctx, identity.subject)

    const sessions = await ctx.db
      .query('liveEstimateSessions')
      .take(LIST_PROJECTION_CAP)

    const visibleSessions = sessions.filter(
      (session) => !teamIds || teamIds.has(session.teamId),
    )

    const counts: { sessionId: string; onlineCount: number }[] = []
    for (const session of visibleSessions) {
      // Indexed read of only this session's presence rows keeps the read-set
      // tight (per the concurrency guidelines).
      const rows = await ctx.db
        .query('liveEstimatePresence')
        .withIndex('by_session', (q) => q.eq('sessionId', session.sessionId))
        .take(MAX_PRESENCE_PER_SESSION)
      counts.push({
        sessionId: session.sessionId,
        onlineCount: rows.filter((row) => row.online).length,
      })
    }

    return counts
  },
})
