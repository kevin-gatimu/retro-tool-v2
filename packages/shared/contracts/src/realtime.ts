export type RealtimeBackend = 'socket-io' | 'convex'

export interface RealtimeFeatureFlags {
  estimatesRealtimeBackend: RealtimeBackend
  retrosRealtimeBackend: RealtimeBackend
  notificationsRealtimeBackend: RealtimeBackend
}

export interface ProjectionSyncEnvelope<TPayload> {
  eventId: string
  eventType: string
  aggregateId: string
  aggregateType: 'estimate' | 'retro'
  occurredAt: string
  payload: TPayload
}

export interface EstimateProjectionPayload {
  sessionId: string
  currentRoundId?: string
  status: 'waiting' | 'voting' | 'revealed' | 'completed'
  updatedAt: string
}

export interface RetroProjectionPayload {
  retroId: string
  status:
    | 'draft'
    | 'waiting'
    | 'active'
    | 'grouping'
    | 'voting'
    | 'discussing'
    | 'completed'
  currentDiscussionCardId?: string
  currentDiscussionActionItemId?: string
  updatedAt: string
}

export interface NotificationProjectionPayload {
  notificationId: string
  userId: string
  type: string
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: string
  updatedAt: string
}