/**
 * Centralized cache key builders.
 *
 * Convention: retro-tool:{scope}:{entity}:{id}[:{sub}]
 *
 * Every key used by CacheService MUST be built through one of these
 * functions so that invalidation stays consistent.
 */

const PREFIX = 'retro-tool';

// ── RBAC ──────────────────────────────────────────────────────────

export const CacheKeys = {
  /** Org-level RBAC context for a user */
  rbacOrg: (orgId: string, userId: string) =>
    `${PREFIX}:rbac:org:${orgId}:user:${userId}`,

  /** Team-level RBAC context for a user */
  rbacTeam: (teamId: string, userId: string) =>
    `${PREFIX}:rbac:team:${teamId}:user:${userId}`,

  /** User system role (super-admin / system-admin check) */
  userRole: (userId: string) => `${PREFIX}:user:${userId}:role`,

  /** Pattern: all RBAC keys for a user (org + team) */
  rbacUserPattern: (userId: string) => `${PREFIX}:rbac:*:user:${userId}`,

  // ── Notifications ───────────────────────────────────────────────

  /** Notification list for a user */
  notificationList: (userId: string) =>
    `${PREFIX}:notifications:${userId}:list`,

  // ── WebSocket sessions ──────────────────────────────────────────

  /** Validated WS session token */
  wsSession: (token: string) => `${PREFIX}:session:ws:${token}`,

  // ── Reports ─────────────────────────────────────────────────────

  teamMetrics: (teamId: string, period: string, userId: string) =>
    `${PREFIX}:reports:team:${teamId}:metrics:${period}:${userId}`,

  healthScore: (teamId: string, period: string) =>
    `${PREFIX}:reports:team:${teamId}:health:${period}`,

  actionItemAnalytics: (teamId: string, period: string) =>
    `${PREFIX}:reports:team:${teamId}:action-items:${period}`,

  templateUsageMetrics: (orgId: string) =>
    `${PREFIX}:reports:org:${orgId}:template-usage`,

  orgOverview: (
    orgId: string,
    period: string,
    page = 1,
    limit = 8,
    search?: string,
  ) =>
    `${PREFIX}:reports:org:${orgId}:overview:${period}:p:${page}:l:${limit}:s:${search?.trim() || 'all'}`,

  systemOverview: (page = 1, limit = 8, search?: string) =>
    `${PREFIX}:reports:system:p:${page}:l:${limit}:s:${search?.trim() || 'all'}`,

  userStats: (userId: string, period?: string, teamId?: string) =>
    `${PREFIX}:reports:user:${userId}:stats:${period ?? 'all'}:${teamId ?? 'all'}`,

  reportsTeamPattern: (teamId: string) => `${PREFIX}:reports:team:${teamId}:*`,

  estimateKPIs: (teamId: string, period: string) =>
    `${PREFIX}:reports:team:${teamId}:estimate-kpis:${period}`,

  reportsOrgPattern: (orgId: string) => `${PREFIX}:reports:org:${orgId}:*`,

  reportsUserPattern: (userId: string) => `${PREFIX}:reports:user:${userId}:*`,

  reportsSystemPattern: () => `${PREFIX}:reports:system:*`,

  reportsAllPattern: () => `${PREFIX}:reports:*`,

  // ── Templates ───────────────────────────────────────────────────

  templateList: (userId: string) => `${PREFIX}:templates:user:${userId}`,

  templateById: (id: string) => `${PREFIX}:template:${id}`,

  /** Pattern: all template list caches */
  templateListPattern: () => `${PREFIX}:templates:*`,

  // ── Retro board ─────────────────────────────────────────────────

  retroDetail: (retroId: string, userId: string) =>
    `${PREFIX}:retro:${retroId}:detail:${userId}`,

  /** Shared retro snapshot (cards, votes, comments, participants) */
  retroSnapshot: (retroId: string) => `${PREFIX}:retro:${retroId}:snapshot`,

  /** Pattern: all cached views for a retro */
  retroPattern: (retroId: string) => `${PREFIX}:retro:${retroId}:*`,

  /** Recent retros list for a user */
  retroRecent: (userId: string, page = 1, limit = 12) =>
    `${PREFIX}:retro:recent:user:${userId}:p:${page}:l:${limit}`,

  /** Pattern: all recent retro list caches */
  retroRecentPattern: () => `${PREFIX}:retro:recent:user:*`,

  // ── Story estimates ─────────────────────────────────────────────

  estimateSessions: (userId: string) =>
    `${PREFIX}:estimates:user:${userId}:sessions`,

  estimateActiveSessions: (userId: string) =>
    `${PREFIX}:estimates:user:${userId}:active`,

  estimateDetail: (sessionId: string, userId: string) =>
    `${PREFIX}:estimates:session:${sessionId}:detail:user:${userId}`,

  /** Shared estimate snapshot (participants, rounds, votes) */
  estimateSnapshot: (sessionId: string) =>
    `${PREFIX}:estimates:session:${sessionId}:snapshot`,

  estimateHistory: (
    userId: string,
    page = 1,
    limit = 15,
    teamId: string | undefined = undefined,
    search?: string,
  ) =>
    `${PREFIX}:estimates:user:${userId}:history:p:${page}:l:${limit}:team:${teamId ?? 'all'}:s:${search?.trim() || 'all'}`,

  estimateSessionPattern: (sessionId: string) =>
    `${PREFIX}:estimates:session:${sessionId}:*`,

  estimateUserPattern: (userId: string) =>
    `${PREFIX}:estimates:user:${userId}:*`,

  estimateAllPattern: () => `${PREFIX}:estimates:*`,

  // ── Org & team lists ────────────────────────────────────────────

  userOrgs: (userId: string, page = 1, limit = 10, search?: string) =>
    `${PREFIX}:orgs:user:${userId}:p:${page}:l:${limit}:s:${search?.trim() || 'all'}`,

  userOrgsPattern: (userId: string) => `${PREFIX}:orgs:user:${userId}:*`,

  orgTeams: (
    orgId: string,
    userId: string,
    page = 1,
    limit = 10,
    search?: string,
  ) =>
    `${PREFIX}:org:${orgId}:teams:user:${userId}:p:${page}:l:${limit}:s:${search?.trim() || 'all'}`,

  orgTeamsPattern: (orgId: string, userId: string) =>
    `${PREFIX}:org:${orgId}:teams:user:${userId}:*`,

  orgTeamsOrgPattern: (orgId: string) => `${PREFIX}:org:${orgId}:teams:user:*`,
} as const;
