import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  liveEstimateSessions: defineTable({
    sessionId: v.string(),
    teamId: v.string(),
    status: v.union(
      v.literal('waiting'),
      v.literal('voting'),
      v.literal('revealed'),
      v.literal('completed'),
    ),
    currentRoundId: v.optional(v.string()),
    revealedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_session_id', ['sessionId'])
    .index('by_team_id', ['teamId']),

  liveRetroSessions: defineTable({
    retroId: v.string(),
    teamId: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('waiting'),
      v.literal('active'),
      v.literal('grouping'),
      v.literal('voting'),
      v.literal('discussing'),
      v.literal('completed'),
    ),
    currentDiscussionCardId: v.optional(v.string()),
    currentDiscussionActionItemId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_retro_id', ['retroId'])
    .index('by_team_id', ['teamId']),

  livePresence: defineTable({
    scopeType: v.union(v.literal('estimate'), v.literal('retro')),
    scopeId: v.string(),
    userId: v.string(),
    displayName: v.string(),
    joinedAt: v.number(),
    heartbeatAt: v.number(),
  })
    .index('by_scope', ['scopeType', 'scopeId'])
    .index('by_scope_user', ['scopeType', 'scopeId', 'userId']),
})