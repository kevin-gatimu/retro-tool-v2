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
// Organizations
// ---------------------------------------------------------------------------
export const ORGANIZATIONS_ENDPOINTS = {
  LIST: '/api/organizations',
  LIST_ALL: '/api/organizations?all=true&page=1&limit=1000',

  BY_ID: (id: string) => `/api/organizations/${id}`,
  LEAVE: (id: string) => `/api/organizations/${id}/leave`,
  INVITE: (id: string) => `/api/organizations/${id}/invite`,
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
  ME: '/api/reports/me',
  TEAM_METRICS: (teamId: string) => `/api/reports/teams/${teamId}/metrics`,
  TEAM_HEALTH: (teamId: string) => `/api/reports/teams/${teamId}/health`,
  TEAM_ACTION_ITEMS: (teamId: string) =>
    `/api/reports/teams/${teamId}/action-items`,
  TEAM_ESTIMATE_KPIS: (teamId: string) =>
    `/api/reports/teams/${teamId}/estimate-kpis`,
  ORG_TEMPLATES: (orgId: string) =>
    `/api/reports/organizations/${orgId}/templates`,
  ORG_OVERVIEW: (orgId: string) =>
    `/api/reports/organizations/${orgId}/overview`,
  SYSTEM: '/api/reports/system',
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
// Convex Admin
// ---------------------------------------------------------------------------
export const CONVEX_ADMIN_ENDPOINTS = {
  METRICS_OPERATIONAL: '/api/convex-admin/metrics/operational',
  METRICS_USAGE: '/api/convex-admin/metrics/usage',
  CRON_CONFIG: '/api/convex-admin/cron-config',
  CLEAR_TABLES: '/api/convex-admin/clear-tables',
} as const
