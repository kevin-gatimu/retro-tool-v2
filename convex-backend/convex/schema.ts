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

  // Full retro board snapshot pushed from NestJS after each mutation.
  // The UI subscribes to this instead of polling the REST API.
  liveRetroBoards: defineTable({
    retroId: v.string(),
    userId: v.string(),
    // JSON-serialised RetroDetail (cards, votes, comments, action items, etc.)
    snapshot: v.string(),
    updatedAt: v.number(),
  })
    .index('by_retro_id', ['retroId'])
    .index('by_retro_user', ['retroId', 'userId']),

  // Full estimate session snapshot pushed from NestJS after each mutation.
  liveEstimateBoards: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    // JSON-serialised EstimateSession (rounds, votes, participants, etc.)
    snapshot: v.string(),
    updatedAt: v.number(),
  })
    .index('by_session_id', ['sessionId'])
    .index('by_session_user', ['sessionId', 'userId']),

  liveIcebreakerSessions: defineTable({
    sessionId: v.string(),
    teamId: v.string(),
    status: v.union(
      v.literal('waiting'),
      v.literal('curating'),
      v.literal('presenting'),
      v.literal('completed'),
    ),
    currentPromptId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_session_id', ['sessionId'])
    .index('by_team_id', ['teamId']),

  // Full icebreaker session snapshot pushed from NestJS after each mutation.
  liveIcebreakerBoards: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    // JSON-serialised icebreaker SessionDetail (deck, prompts, responses, etc.)
    snapshot: v.string(),
    updatedAt: v.number(),
  })
    .index('by_session_id', ['sessionId'])
    .index('by_session_user', ['sessionId', 'userId']),

  liveStandupEntries: defineTable({
    standupId: v.string(),
    entryDate: v.string(),
    teamId: v.string(),
    updatedAt: v.number(),
  })
    .index('by_standup_id', ['standupId'])
    .index('by_standup_date', ['standupId', 'entryDate'])
    .index('by_team_id', ['teamId']),

  // Full daily standup room snapshot pushed from NestJS after each mutation.
  liveStandupBoards: defineTable({
    standupId: v.string(),
    entryDate: v.string(),
    userId: v.string(),
    // JSON-serialised StandupEntryDetail (submissions, comments, reactions, etc.)
    snapshot: v.string(),
    updatedAt: v.number(),
  })
    .index('by_standup_id', ['standupId'])
    .index('by_standup_date', ['standupId', 'entryDate'])
    .index('by_standup_date_user', ['standupId', 'entryDate', 'userId']),

  liveNotifications: defineTable({
    notificationId: v.string(),
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_notification_id', ['notificationId'])
    .index('by_user_id', ['userId'])
    .index('by_user_read', ['userId', 'read']),

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

  // Ephemeral typing indicators — cleared when user stops typing or leaves.
  liveTyping: defineTable({
    retroId: v.string(),
    userId: v.string(),
    displayName: v.string(),
    updatedAt: v.number(),
  })
    .index('by_retro', ['retroId'])
    .index('by_retro_user', ['retroId', 'userId']),

  // Per-user ready status during the active (Adding Cards) phase.
  liveReadyStatus: defineTable({
    retroId: v.string(),
    userId: v.string(),
    displayName: v.string(),
    isReady: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_retro', ['retroId'])
    .index('by_retro_user', ['retroId', 'userId']),
})