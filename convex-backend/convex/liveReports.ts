import { ConvexError } from 'convex/values'
import { query, internalMutation } from './server'
import { v } from 'convex/values'
import { Aggregate } from '@convex-dev/aggregate'
import { components } from './_generated/api'

// ── Aggregate instances ───────────────────────────────────────────────────────
// Each instance maps to a named component registered in convex.config.ts.
// Key tuples are used for prefix-based queries:
//   [teamId, ...]  → query "all for team" using prefix: [teamId]
//   [teamId, userId, ...] → query "user within team"
//
// SumValue is null for all — we only need counts.

/** Retro completions per team. Key: [teamId, completedAtMs] */
const retrosCompletedByTeam = new Aggregate<[string, number], string>(
  components.retrosCompletedByTeam,
)

/** Cards created per team+user. Key: [teamId, userId, createdAtMs] */
const cardsByTeamUser = new Aggregate<[string, string, number], string>(
  components.cardsByTeamUser,
)

/** Votes cast per team+user. Key: [teamId, userId, createdAtMs] */
const votesByTeamUser = new Aggregate<[string, string, number], string>(
  components.votesByTeamUser,
)

/** Action items per team+status. Key: [teamId, status, createdAtMs] */
const actionItemsByTeamStatus = new Aggregate<[string, string, number], string>(
  components.actionItemsByTeamStatus,
)

/** Estimate sessions per team. Key: [teamId, completedAtMs] */
const estimateSessionsByTeam = new Aggregate<[string, number], string>(
  components.estimateSessionsByTeam,
)

/** All retros globally. Key: [createdAtMs] */
const systemRetros = new Aggregate<[number], string>(components.systemRetros)

/** All users globally. Key: [createdAtMs] */
const systemUsers = new Aggregate<[number], string>(components.systemUsers)

// ── Helper ────────────────────────────────────────────────────────────────────

function requireSystemAdmin(
  identity: { tokenIdentifier: string; role?: string } | null,
): void {
  if (!identity) {
    throw new ConvexError('Unauthenticated')
  }
  if (identity.role !== 'admin') {
    throw new ConvexError('Forbidden: system admin required')
  }
}

// ── Write mutations (called from NestJS HTTP Admin API) ───────────────────────

export const upsertRetroStat = internalMutation({
  args: {
    retroId: v.string(),
    teamId: v.string(),
    completedAtMs: v.number(),
    operation: v.union(v.literal('insert'), v.literal('delete')),
  },
  handler: async (ctx, args) => {
    const key: [string, number] = [args.teamId, args.completedAtMs]
    if (args.operation === 'insert') {
      await retrosCompletedByTeam._insert(ctx, undefined, key, args.retroId)
      await systemRetros._insert(ctx, undefined, [args.completedAtMs], args.retroId)
    } else {
      await retrosCompletedByTeam._delete(ctx, undefined, key, args.retroId)
      await systemRetros._delete(ctx, undefined, [args.completedAtMs], args.retroId)
    }
    return { retroId: args.retroId, operation: args.operation }
  },
})

export const upsertCardStat = internalMutation({
  args: {
    cardId: v.string(),
    teamId: v.string(),
    userId: v.string(),
    createdAtMs: v.number(),
    operation: v.union(v.literal('insert'), v.literal('delete')),
  },
  handler: async (ctx, args) => {
    const key: [string, string, number] = [
      args.teamId,
      args.userId,
      args.createdAtMs,
    ]
    if (args.operation === 'insert') {
      await cardsByTeamUser._insert(ctx, undefined, key, args.cardId)
    } else {
      await cardsByTeamUser._delete(ctx, undefined, key, args.cardId)
    }
    return { cardId: args.cardId, operation: args.operation }
  },
})

export const upsertVoteStat = internalMutation({
  args: {
    voteId: v.string(),
    teamId: v.string(),
    userId: v.string(),
    createdAtMs: v.number(),
    operation: v.union(v.literal('insert'), v.literal('delete')),
  },
  handler: async (ctx, args) => {
    const key: [string, string, number] = [
      args.teamId,
      args.userId,
      args.createdAtMs,
    ]
    if (args.operation === 'insert') {
      await votesByTeamUser._insert(ctx, undefined, key, args.voteId)
    } else {
      await votesByTeamUser._delete(ctx, undefined, key, args.voteId)
    }
    return { voteId: args.voteId, operation: args.operation }
  },
})

export const upsertActionItemStat = internalMutation({
  args: {
    itemId: v.string(),
    teamId: v.string(),
    status: v.string(),
    prevStatus: v.optional(v.string()),
    createdAtMs: v.number(),
    operation: v.union(
      v.literal('insert'),
      v.literal('delete'),
      v.literal('update'),
    ),
  },
  handler: async (ctx, args) => {
    if (args.operation === 'insert') {
      await actionItemsByTeamStatus._insert(
        ctx,
        undefined,
        [args.teamId, args.status, args.createdAtMs],
        args.itemId,
      )
    } else if (args.operation === 'delete') {
      await actionItemsByTeamStatus._delete(ctx, undefined, [
        args.teamId,
        args.status,
        args.createdAtMs,
      ], args.itemId)
    } else if (args.operation === 'update' && args.prevStatus) {
      // Status changed — replace old key with new key
      await actionItemsByTeamStatus._delete(ctx, undefined, [
        args.teamId,
        args.prevStatus,
        args.createdAtMs,
      ], args.itemId)
      await actionItemsByTeamStatus._insert(
        ctx,
        undefined,
        [args.teamId, args.status, args.createdAtMs],
        args.itemId,
      )
    }
    return { itemId: args.itemId, operation: args.operation }
  },
})

export const upsertEstimateSessionStat = internalMutation({
  args: {
    sessionId: v.string(),
    teamId: v.string(),
    completedAtMs: v.number(),
    operation: v.union(v.literal('insert'), v.literal('delete')),
  },
  handler: async (ctx, args) => {
    const key: [string, number] = [args.teamId, args.completedAtMs]
    if (args.operation === 'insert') {
      await estimateSessionsByTeam._insert(ctx, undefined, key, args.sessionId)
    } else {
      await estimateSessionsByTeam._delete(ctx, undefined, key, args.sessionId)
    }
    return { sessionId: args.sessionId, operation: args.operation }
  },
})

export const upsertUserStat = internalMutation({
  args: {
    userId: v.string(),
    createdAtMs: v.number(),
    operation: v.union(v.literal('insert'), v.literal('delete')),
  },
  handler: async (ctx, args) => {
    if (args.operation === 'insert') {
      await systemUsers._insert(ctx, undefined, [args.createdAtMs], args.userId)
    } else {
      await systemUsers._delete(ctx, undefined, [args.createdAtMs], args.userId)
    }
    return { userId: args.userId, operation: args.operation }
  },
})

// ── Read queries (subscribed from the browser or called from NestJS) ──────────

export const getTeamStats = query({
  args: {
    teamId: v.string(),
    sinceMs: v.optional(v.number()),
    untilMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError('Unauthenticated')
    }

    const since = args.sinceMs
    const until = args.untilMs

    // Lower bound: [teamId] prefix start  Upper bound: open unless sinceMs/untilMs given
    const lowerBound = since
      ? { key: [args.teamId, since] as [string, number], inclusive: true }
      : undefined
    const upperBound = until
      ? { key: [args.teamId, until] as [string, number], inclusive: true }
      : undefined

    const [
      retroCount,
      cardCount,
      voteCount,
      completedItemCount,
      openItemCount,
      inProgressItemCount,
      sessionCount,
    ] = await Promise.all([
      retrosCompletedByTeam.count(ctx, {
        bounds: {
          lower: lowerBound ?? {
            key: [args.teamId, 0] as [string, number],
            inclusive: true,
          },
          upper: upperBound ?? {
            key: [args.teamId, Number.MAX_SAFE_INTEGER] as [string, number],
            inclusive: true,
          },
        },
      }),
      cardsByTeamUser.count(ctx, {
        bounds: {
          lower: {
            key: [args.teamId, '\u0000', since ?? 0] as [
              string,
              string,
              number,
            ],
            inclusive: true,
          },
          upper: {
            key: [args.teamId, '\uffff', until ?? Number.MAX_SAFE_INTEGER] as [
              string,
              string,
              number,
            ],
            inclusive: true,
          },
        },
      }),
      votesByTeamUser.count(ctx, {
        bounds: {
          lower: {
            key: [args.teamId, '\u0000', since ?? 0] as [
              string,
              string,
              number,
            ],
            inclusive: true,
          },
          upper: {
            key: [args.teamId, '\uffff', until ?? Number.MAX_SAFE_INTEGER] as [
              string,
              string,
              number,
            ],
            inclusive: true,
          },
        },
      }),
      actionItemsByTeamStatus.count(ctx, {
        bounds: {
          lower: {
            key: [args.teamId, 'completed', since ?? 0] as [
              string,
              string,
              number,
            ],
            inclusive: true,
          },
          upper: {
            key: [
              args.teamId,
              'completed',
              until ?? Number.MAX_SAFE_INTEGER,
            ] as [string, string, number],
            inclusive: true,
          },
        },
      }),
      actionItemsByTeamStatus.count(ctx, {
        bounds: {
          lower: {
            key: [args.teamId, 'open', since ?? 0] as [string, string, number],
            inclusive: true,
          },
          upper: {
            key: [args.teamId, 'open', until ?? Number.MAX_SAFE_INTEGER] as [
              string,
              string,
              number,
            ],
            inclusive: true,
          },
        },
      }),
      actionItemsByTeamStatus.count(ctx, {
        bounds: {
          lower: {
            key: [args.teamId, 'in_progress', since ?? 0] as [
              string,
              string,
              number,
            ],
            inclusive: true,
          },
          upper: {
            key: [
              args.teamId,
              'in_progress',
              until ?? Number.MAX_SAFE_INTEGER,
            ] as [string, string, number],
            inclusive: true,
          },
        },
      }),
      estimateSessionsByTeam.count(ctx, {
        bounds: {
          lower: {
            key: [args.teamId, since ?? 0] as [string, number],
            inclusive: true,
          },
          upper: {
            key: [args.teamId, until ?? Number.MAX_SAFE_INTEGER] as [
              string,
              number,
            ],
            inclusive: true,
          },
        },
      }),
    ])

    const totalItems =
      completedItemCount + openItemCount + inProgressItemCount
    const completionRate =
      totalItems > 0
        ? Math.round((completedItemCount / totalItems) * 100)
        : null

    return {
      teamId: args.teamId,
      retroCount,
      cardCount,
      voteCount,
      actionItems: {
        completed: completedItemCount,
        open: openItemCount,
        inProgress: inProgressItemCount,
        total: totalItems,
        completionRate,
      },
      estimateSessionCount: sessionCount,
    }
  },
})

export const getUserStats = query({
  args: {
    teamId: v.string(),
    // Deprecated: stats are scoped to the authenticated caller (derived from the
    // JWT). Kept optional for back-compat with older clients; ignored.
    userId: v.optional(v.string()),
    sinceMs: v.optional(v.number()),
    untilMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError('Unauthenticated')
    }
    // Always scope to the caller's own id — never a client-supplied userId.
    const userId = identity.subject

    const since = args.sinceMs ?? 0
    const until = args.untilMs ?? Number.MAX_SAFE_INTEGER

    const [cardCount, voteCount] = await Promise.all([
      cardsByTeamUser.count(ctx, {
        bounds: {
          lower: {
            key: [args.teamId, userId, since] as [string, string, number],
            inclusive: true,
          },
          upper: {
            key: [args.teamId, userId, until] as [string, string, number],
            inclusive: true,
          },
        },
      }),
      votesByTeamUser.count(ctx, {
        bounds: {
          lower: {
            key: [args.teamId, userId, since] as [string, string, number],
            inclusive: true,
          },
          upper: {
            key: [args.teamId, userId, until] as [string, string, number],
            inclusive: true,
          },
        },
      }),
    ])

    return {
      teamId: args.teamId,
      userId,
      cardCount,
      voteCount,
    }
  },
})

export const getSystemStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    requireSystemAdmin(
      identity as { tokenIdentifier: string; role?: string } | null,
    )

    const [totalRetros, totalUsers] = await Promise.all([
      systemRetros.count(ctx),
      systemUsers.count(ctx),
    ])

    return {
      totalRetros,
      totalUsers,
    }
  },
})
