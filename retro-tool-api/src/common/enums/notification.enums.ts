export const NOTIFICATION_TYPES = {
  UserSignup: 'user_signup',
  TeamJoinRequest: 'team_join_request',
  TeamJoinApproved: 'team_join_approved',
  TeamJoinRejected: 'team_join_rejected',
  OrgInvite: 'org_invite',
  RetroCreated: 'retro_created',
  RetroLobbyOpen: 'retro_lobby_open',
  RetroStarted: 'retro_started',
  RetroCompleted: 'retro_completed',
  ActionItemAssigned: 'action_item_assigned',
  ActionItemDueSoon: 'action_item_due_soon',
  EstimateSessionCreated: 'estimate_session_created',
} as const;

export type TNotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
