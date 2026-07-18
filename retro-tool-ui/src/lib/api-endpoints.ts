// Centralized API endpoint constants.
// Static paths are plain strings; parameterized paths are arrow functions.

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const USERS_ENDPOINTS = {
  ME: '/api/users/me',
  LIST: '/api/users',
  SEARCH: '/api/users/search',
  BULK_STATUS: '/api/users/bulk/status',
  ADMIN_LOGS: '/api/users/admin/logs',
  ADMIN_BOOTSTRAP: '/api/users/admin/bootstrap',
  ADMIN_CHECK: '/api/users/admin/exists',

  BY_ID: (id: string) => `/api/users/${id}`,
  DETAILS: (id: string) => `/api/users/${id}/details`,
  STATUS: (id: string) => `/api/users/${id}/status`,
  ROLE: (id: string) => `/api/users/${id}/role`,
  PROMOTE_SYSTEM_ADMIN: (id: string) => `/api/users/${id}/promote-system-admin`,
  DEMOTE_SYSTEM_ADMIN: (id: string) => `/api/users/${id}/demote-system-admin`,
  SUSPEND: (id: string) => `/api/users/${id}/suspend`,
  REACTIVATE: (id: string) => `/api/users/${id}/reactivate`,
} as const

// ---------------------------------------------------------------------------
// Invitations (unified — works for both org and team tokens)
// ---------------------------------------------------------------------------
export const INVITATIONS_ENDPOINTS = {
  PREVIEW: (token: string) => `/api/invitations/preview/${token}`,
  ACCEPT: (token: string) => `/api/invitations/${token}/accept`,
} as const

// ---------------------------------------------------------------------------
// Email OTP (server-driven; proxies to Better Auth's emailOTP plugin)
// ---------------------------------------------------------------------------
export const OTP_ENDPOINTS = {
  SEND: '/api/otp/send',
  SIGN_IN: '/api/otp/sign-in',
  VERIFY_EMAIL: '/api/otp/verify-email',
  RESET_PASSWORD_SEND: '/api/otp/reset-password/send',
  RESET_PASSWORD: '/api/otp/reset-password',
} as const

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------
export const ORGANIZATIONS_ENDPOINTS = {
  LIST: '/api/organizations',
  LIST_ALL: '/api/organizations?all=true&page=1&limit=1000',
  BULK_SETUP: '/api/organizations/bulk-setup',

  BY_ID: (id: string) => `/api/organizations/${id}`,
  LEAVE: (id: string) => `/api/organizations/${id}/leave`,
  INVITE: (id: string) => `/api/organizations/${id}/invite`,
  INVITATIONS: (id: string) => `/api/organizations/${id}/invitations`,
  REVOKE_INVITATION: (id: string, invId: string) =>
    `/api/organizations/${id}/invitations/${invId}`,
  RESEND_INVITATION: (id: string, invId: string) =>
    `/api/organizations/${id}/invitations/${invId}/resend`,
  ADD_MEMBER: (id: string) => `/api/organizations/${id}/members`,
  CHECK_INVITE_EMAIL: (id: string) =>
    `/api/organizations/${id}/check-invite-email`,
  MEMBERS: (id: string) => `/api/organizations/${id}/members`,
  MEMBER_BY_ID: (id: string, memberId: string) =>
    `/api/organizations/${id}/members/${memberId}`,
  MEMBER_ROLE: (id: string, memberId: string) =>
    `/api/organizations/${id}/members/${memberId}/role`,
} as const

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
export const TEAMS_ENDPOINTS = {
  LIST: '/api/teams',

  BY_ID: (id: string) => `/api/teams/${id}`,
  JOIN: (id: string) => `/api/teams/${id}/join`,
  LEAVE: (id: string) => `/api/teams/${id}/leave`,
  MEMBERS: (id: string) => `/api/teams/${id}/members`,
  MEMBER_BY_ID: (id: string, memberId: string) =>
    `/api/teams/${id}/members/${memberId}`,
  MEMBER_JOB_ROLE: (id: string, memberId: string) =>
    `/api/teams/${id}/members/${memberId}/job-role`,
  JOIN_REQUESTS: (id: string) => `/api/teams/${id}/join-requests`,
  JOIN_REQUEST_BY_ID: (id: string, requestId: string) =>
    `/api/teams/${id}/join-requests/${requestId}`,
  JOIN_REQUEST_APPROVE: (id: string, requestId: string) =>
    `/api/teams/${id}/join-requests/${requestId}/approve`,
  JOIN_REQUEST_REJECT: (id: string, requestId: string) =>
    `/api/teams/${id}/join-requests/${requestId}/reject`,
  JOIN_REQUESTS_BULK_APPROVE: (id: string) =>
    `/api/teams/${id}/join-requests/bulk-approve`,
  JOIN_REQUESTS_ALL: '/api/teams/join-requests/all',
  INVITE: (id: string) => `/api/teams/${id}/invite`,
  INVITATIONS: (id: string) => `/api/teams/${id}/invitations`,
  REVOKE_INVITATION: (id: string, invId: string) =>
    `/api/teams/${id}/invitations/${invId}`,
  RESEND_INVITATION: (id: string, invId: string) =>
    `/api/teams/${id}/invitations/${invId}/resend`,
  CHECK_INVITE_EMAIL: (id: string) => `/api/teams/${id}/check-invite-email`,
} as const

// ---------------------------------------------------------------------------
// Retros
// ---------------------------------------------------------------------------
export const RETROS_ENDPOINTS = {
  LIST: '/api/retros',
  DASHBOARD: '/api/retros/dashboard',
  CARDS: '/api/retros/cards',
  TEMPLATES: '/api/retros/templates',

  BY_ID: (id: string) => `/api/retros/${id}`,
  LOBBY: (id: string) => `/api/retros/${id}/lobby`,
  START: (id: string) => `/api/retros/${id}/start`,
  GROUPING: (id: string) => `/api/retros/${id}/grouping`,
  VOTING: (id: string) => `/api/retros/${id}/voting`,
  DISCUSSION: (id: string) => `/api/retros/${id}/discussion`,
  COMPLETE: (id: string) => `/api/retros/${id}/complete`,
  JOIN: (id: string) => `/api/retros/${id}/join`,
  ACTION_ITEMS: (id: string) => `/api/retros/${id}/action-items`,

  CARD_BY_ID: (cardId: string) => `/api/retros/cards/${cardId}`,
  MERGE_CARDS: (id: string) => `/api/retros/${id}/merge-cards`,
  UNMERGE_CARD: (id: string, cardId: string) =>
    `/api/retros/${id}/cards/${cardId}/unmerge`,
  CARD_VOTE: (cardId: string) => `/api/retros/cards/${cardId}/vote`,
  CARD_COMMENTS: (cardId: string) => `/api/retros/cards/${cardId}/comments`,
  COMMENT_BY_ID: (commentId: string) => `/api/retros/comments/${commentId}`,

  TEMPLATE_BY_ID: (templateId: string) => `/api/retros/templates/${templateId}`,

  DISCUSS_CARD: (retroId: string, cardId: string) =>
    `/api/retros/${retroId}/cards/${cardId}/discuss`,
  DISCUSS_ACTION_ITEM: (retroId: string, actionItemId: string) =>
    `/api/retros/${retroId}/action-items/${actionItemId}/discuss`,
  MARK_DISCUSSED: (retroId: string, cardId: string) =>
    `/api/retros/${retroId}/cards/${cardId}/mark-discussed`,
  CARRY_FORWARD: (retroId: string) => `/api/retros/${retroId}/carry-forward`,
  PREVIOUS_CARRIED_FORWARD: (retroId: string) =>
    `/api/retros/${retroId}/previous-carried-forward`,
  SEND_REPORT: (retroId: string) => `/api/retros/${retroId}/send-report`,
} as const

// ---------------------------------------------------------------------------
// Estimates (story estimate sessions)
// ---------------------------------------------------------------------------
export const ESTIMATES_ENDPOINTS = {
  LIST: '/api/estimates',
  ACTIVE: '/api/estimates/active',
  HISTORY: '/api/estimates/history',

  BY_ID: (id: string) => `/api/estimates/${id}`,
  PERMANENT_DELETE: (id: string) => `/api/estimates/${id}/permanent`,
  JOIN: (id: string) => `/api/estimates/${id}/join`,
  VOTES: (id: string) => `/api/estimates/${id}/votes`,
  REVEAL: (id: string) => `/api/estimates/${id}/reveal`,
  CLEAR: (id: string) => `/api/estimates/${id}/clear`,
  START_ROUND: (id: string) => `/api/estimates/${id}/rounds/start`,
  STORY: (id: string) => `/api/estimates/${id}/story`,
  TIMER: (id: string) => `/api/estimates/${id}/timer`,
  CONSENSUS: (id: string) => `/api/estimates/${id}/consensus`,
  REVOTE: (id: string) => `/api/estimates/${id}/revote`,
  SEND_REPORT: (id: string) => `/api/estimates/${id}/send-report`,

  // Convex-only live write path (socket-io-elimination-plan Phase 2). These
  // mirror the Socket.IO gateway commands 1:1 and are wired into the hook in
  // Phase 3; the socket path above stays active until then.
  PARTICIPANT: (id: string) => `/api/estimates/${id}/participant`,
  VOTE: (id: string) => `/api/estimates/${id}/vote`,
  ROUND: (id: string) => `/api/estimates/${id}/round`,
  END: (id: string) => `/api/estimates/${id}/end`,
} as const

// ---------------------------------------------------------------------------
// Icebreakers (icebreaker sessions)
// ---------------------------------------------------------------------------
export const ICEBREAKERS_ENDPOINTS = {
  LIST: '/api/icebreakers',
  ACTIVE: '/api/icebreakers/active',
  HISTORY: '/api/icebreakers/history',

  BY_ID: (id: string) => `/api/icebreakers/${id}`,
  PERMANENT_DELETE: (id: string) => `/api/icebreakers/${id}/permanent`,
  JOIN: (id: string) => `/api/icebreakers/${id}/join`,
  SWIPE: (id: string) => `/api/icebreakers/${id}/swipe`,
  ADVANCE: (id: string) => `/api/icebreakers/${id}/advance`,
  TIMER: (id: string) => `/api/icebreakers/${id}/timer`,
} as const

// ---------------------------------------------------------------------------
// Standups (async daily standups)
// ---------------------------------------------------------------------------
export const STANDUPS_ENDPOINTS = {
  LIST: '/api/standups',
  ACTIVITY: (from: string, to: string) =>
    `/api/standups/activity?from=${from}&to=${to}`,

  BY_ID: (id: string) => `/api/standups/${id}`,
  ENTRY: (id: string, date: string) => `/api/standups/${id}/entries/${date}`,
  SUBMISSION: (id: string, date: string) =>
    `/api/standups/${id}/entries/${date}/submission`,
  COMMENTS: (submissionId: string) =>
    `/api/standups/submissions/${submissionId}/comments`,
  COMMENT_BY_ID: (commentId: string) => `/api/standups/comments/${commentId}`,
  REACTIONS: (submissionId: string) =>
    `/api/standups/submissions/${submissionId}/reactions`,
  REACTION_BY_EMOJI: (submissionId: string, emoji: string) =>
    `/api/standups/submissions/${submissionId}/reactions/${encodeURIComponent(emoji)}`,
  SEND_REPORT: (id: string) => `/api/standups/${id}/send-report`,
  SKIP_DAY: (id: string, date: string) =>
    `/api/standups/${id}/skip-days/${date}`,
} as const

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------
export const POLLS_ENDPOINTS = {
  LIST: '/api/polls',
  ACTIVE_COUNT: '/api/polls/active-count',

  BY_ID: (id: string) => `/api/polls/${id}`,
  VOTE: (id: string) => `/api/polls/${id}/vote`,
  CLOSED: (id: string) => `/api/polls/${id}/closed`,
  EMAIL: (id: string) => `/api/polls/${id}/email`,
} as const

// ---------------------------------------------------------------------------
// Surveys (team-, org-, or system-scoped questionnaires)
// ---------------------------------------------------------------------------
export const SURVEYS_ENDPOINTS = {
  LIST: '/api/surveys',
  ACTIVE_COUNT: '/api/surveys/active-count',

  BY_ID: (id: string) => `/api/surveys/${id}`,
  RESPOND: (id: string) => `/api/surveys/${id}/respond`,
  CLOSED: (id: string) => `/api/surveys/${id}/closed`,
  EMAIL: (id: string) => `/api/surveys/${id}/email`,
} as const

// ---------------------------------------------------------------------------
// Sessions (auth / user sessions)
// ---------------------------------------------------------------------------
export const SESSIONS_ENDPOINTS = {
  LIST: '/api/sessions',
  REVOKE: '/api/sessions/revoke',
  REVOKE_OTHERS: '/api/sessions/others',
} as const

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const NOTIFICATIONS_ENDPOINTS = {
  LIST: '/api/notifications',
  UNREAD_COUNT: '/api/notifications/unread-count',
  READ_ALL: '/api/notifications/read-all',
  PUSH_VAPID_KEY: '/api/notifications/push-vapid-key',
  PUSH_SUBSCRIBE: '/api/notifications/push-subscribe',

  MARK_READ: (id: string) => `/api/notifications/${id}/read`,
} as const

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export const REPORTS_ENDPOINTS = {
  // v2 role dashboards (REPORTS-REDESIGN-PLAN) — composite chart-ready payloads
  V2_ME: '/api/reports/v2/me',
  V2_TEAM: (teamId: string) => `/api/reports/v2/teams/${teamId}`,
  V2_TEAM_MEMBERS: (teamId: string) =>
    `/api/reports/v2/teams/${teamId}/members`,
  V2_ORG: (orgId: string) => `/api/reports/v2/organizations/${orgId}`,
  V2_ORG_TEAMS: (orgId: string) =>
    `/api/reports/v2/organizations/${orgId}/teams`,
  V2_PLATFORM: '/api/reports/v2/platform',
  V2_PLATFORM_ORGS: '/api/reports/v2/platform/organizations',
} as const

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------
export const USER_PREFERENCES_ENDPOINTS = {
  BASE: '/api/user-preferences',
} as const

// ---------------------------------------------------------------------------
// Action Items
// ---------------------------------------------------------------------------
export const ACTION_ITEMS_ENDPOINTS = {
  LIST: '/api/action-items',

  BY_ID: (id: string) => `/api/action-items/${id}`,
  COMMENTS: (id: string) => `/api/action-items/${id}/comments`,
  COMMENT_BY_ID: (id: string) => `/api/action-items/comments/${id}`,
  LIKES: (id: string) => `/api/action-items/${id}/likes`,
} as const

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------
export const REMINDERS_ENDPOINTS = {
  LIST: '/api/reminders',

  BY_ID: (id: string) => `/api/reminders/${id}`,
} as const

// ---------------------------------------------------------------------------
// Digests
// ---------------------------------------------------------------------------
export const DIGESTS_ENDPOINTS = {
  LIST: '/api/digests',

  BY_ID: (id: string) => `/api/digests/${id}`,
} as const

// ---------------------------------------------------------------------------
// Estimate Templates
// ---------------------------------------------------------------------------
export const ESTIMATE_TEMPLATES_ENDPOINTS = {
  LIST: '/api/estimates/templates',
  SEED: '/api/estimates/templates/seed',
  BY_ID: (id: string) => `/api/estimates/templates/${id}`,
} as const

// ---------------------------------------------------------------------------
// Icebreaker Templates
// ---------------------------------------------------------------------------
export const ICEBREAKER_TEMPLATES_ENDPOINTS = {
  LIST: '/api/icebreakers/templates',
  SEED: '/api/icebreakers/templates/seed',
  BY_ID: (id: string) => `/api/icebreakers/templates/${id}`,
} as const

// ---------------------------------------------------------------------------
// Templates (alias — served via retros endpoint)
// ---------------------------------------------------------------------------
export const TEMPLATES_ENDPOINTS = {
  LIST: RETROS_ENDPOINTS.TEMPLATES,
  SEED: '/api/retros/templates/seed',
  BY_ID: RETROS_ENDPOINTS.TEMPLATE_BY_ID,
} as const

// ---------------------------------------------------------------------------
// Team Roles
// ---------------------------------------------------------------------------
export const TEAM_ROLES_ENDPOINTS = {
  LIST: '/api/team-roles',
  SEED: '/api/team-roles/seed',
  BY_ID: (id: string) => `/api/team-roles/${id}`,
  ORG_LIST: (orgId: string) => `/api/organizations/${orgId}/team-roles`,
  ORG_ADMIN_LIST: (orgId: string) =>
    `/api/organizations/${orgId}/team-roles/admin`,
  ORG_BY_ID: (orgId: string, id: string) =>
    `/api/organizations/${orgId}/team-roles/${id}`,
  ORG_ACTIVATION: (orgId: string, id: string) =>
    `/api/organizations/${orgId}/team-roles/${id}/activation`,
} as const

// ---------------------------------------------------------------------------
// Convex admin (operational metrics, cron config, table maintenance)
// ---------------------------------------------------------------------------
export const CONVEX_ADMIN_ENDPOINTS = {
  METRICS_OPERATIONAL: '/api/convex-admin/metrics/operational',
  METRICS_USAGE: '/api/convex-admin/metrics/usage',
  CRON_CONFIG: '/api/convex-admin/cron-config',
  CLEAR_TABLES: '/api/convex-admin/clear-tables',
} as const

// -
