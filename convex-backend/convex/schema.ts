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

  // Lightweight poll projection pushed from NestJS after each mutation.
  // Drives the polls list; the UI invalidates and refetches the REST list
  // (which applies per-viewer authorization) whenever this table changes.
  livePolls: defineTable({
    pollId: v.string(),
    teamId: v.string(),
    isClosed: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_poll_id', ['pollId'])
    .index('by_team_id', ['teamId']),

  // Lightweight survey projection pushed from NestJS after each mutation.
  // Drives the surveys list + active-count badge; the UI invalidates and
  // refetches the REST endpoints (which apply per-viewer authorization).
  liveSurveys: defineTable({
    surveyId: v.string(),
    scope: v.union(v.literal('team'), v.literal('org'), v.literal('system')),
    teamId: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    isClosed: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_survey_id', ['surveyId'])
    .index('by_team_id', ['teamId'])
    .index('by_org_id', ['organizationId']),

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

  // Per-user online presence for estimate sessions. A high-frequency,
  // low-value signal (join/leave flaps), so it gets its own direct Convex path
  // — clients call `setPresence` and subscribe to `getSessionPresence` — instead
  // of riding the coalesced projection-outbox → board fan-out. Mirrors the retro
  // `liveReadyStatus` shape.
  liveEstimatePresence: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    displayName: v.string(),
    online: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_user', ['sessionId', 'userId']),

  // Team-membership projection (userId → teamId) pushed from NestJS after each
  // membership mutation. Convex has no team data of its own, so team-scoped
  // read queries (list projections, team stats) use this table to filter results
  // to teams the authenticated caller actually belongs to — closing the
  // cross-tenant read gap. PostgreSQL remains the source of truth.
  liveTeamMembers: defineTable({
    userId: v.string(),
    teamId: v.string(),
    updatedAt: v.number(),
  })
    .index('by_user_id', ['userId'])
    .index('by_team_user', ['teamId', 'userId']),
})