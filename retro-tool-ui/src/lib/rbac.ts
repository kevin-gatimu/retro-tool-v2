/**
 * Role-Based Access Control (RBAC) Utility
 *
 * Mirrors the backend implementation in retro-tool-api/src/lib/rbac.ts.
 * See docs/security/authorization-rbac.md for the full specification.
 *
 * Role Hierarchy:
 * ===============
 *
 * 1. Super Admin (user.role = "super-admin")
 *    - One user only — the root administrator
 *    - Promote/demote System Admins
 *    - Full access to all system, org, team, and retro ops
 *    - Suspend/unsuspend any user
 *
 * 2. System Admin (user.role = "system-admin")
 *    - Create and delete organizations
 *    - View and manage all organizations
 *    - Suspend user accounts
 *    - Assign/revoke Organization Admin roles
 *    - Full access to all org, team, and retro ops
 *
 * 3. Org Admin (user.role = "org-admin")
 *    Sub-roles via organizationMember.role:
 *    - Owner: delete org, transfer ownership, promote/demote admins
 *    - Admin: create/delete teams, invite/remove members, promote team leads
 *
 * 4. Team Lead (user.role = "team-lead")
 *    - Invite/remove members from their team
 *    - Approve/reject join requests
 *    - Update their team details
 *
 * 5. Member (user.role = "member")
 *    - Request to join teams
 *    - Participate in retro sessions
 */

import type { TUserRole } from '@/common/enums/user.enums'

// ============================================================================
// Role Types
// ============================================================================

export type UserRole = TUserRole
export type OrgRole = 'org-owner' | 'org-admin' | 'member' | null
export type TeamTag = 'team-lead' | 'member' | null

// ============================================================================
// Action Types
// ============================================================================

export type SystemAction =
  | 'system:promote_system_admin'
  | 'system:demote_system_admin'
  | 'system:suspend_user'
  | 'system:unsuspend_user'
  | 'system:view_all_orgs'

export type OrgAction =
  | 'org:create'
  | 'org:read'
  | 'org:update'
  | 'org:delete'
  | 'org:invite_member'
  | 'org:remove_member'
  | 'org:promote_to_admin'
  | 'org:demote_admin'
  | 'org:transfer_ownership'
  | 'org:promote_team_lead'
  | 'org:demote_team_lead'

export type TeamAction =
  | 'team:create'
  | 'team:read'
  | 'team:update'
  | 'team:delete'
  | 'team:invite_member'
  | 'team:remove_member'
  | 'team:view_join_requests'
  | 'team:approve_join_request'
  | 'team:reject_join_request'
  | 'team:self_demote_lead'

export type RetroAction =
  | 'retro:create'
  | 'retro:read'
  | 'retro:update'
  | 'retro:start'
  | 'retro:end'
  | 'retro:delete'
  | 'retro:participate'

// ============================================================================
// Context Objects
// ============================================================================

export interface UserContext {
  userId: string
  role: UserRole
}

export interface OrgContext {
  user: UserContext
  /** null = caller is not a member of this org */
  orgRole: OrgRole
  isSuperAdmin: boolean
  isSystemAdmin: boolean
}

export interface TeamContext {
  user: UserContext
  /** null = caller is not a member of this org */
  orgRole: OrgRole
  /** null = caller is not a member of this team */
  teamTag: TeamTag
  isSuperAdmin: boolean
  isSystemAdmin: boolean
}

// ============================================================================
// Role Guard Helpers (pure — operate on role strings or context objects)
// ============================================================================

export function isSuperAdmin(role?: UserRole): boolean {
  return role === 'super-admin'
}

export function isSystemAdmin(role?: UserRole): boolean {
  return role === 'super-admin' || role === 'system-admin'
}

export function isOrgAdminCtx(ctx: OrgContext): boolean {
  return (
    ctx.isSuperAdmin ||
    ctx.isSystemAdmin ||
    ctx.orgRole === 'org-owner' ||
    ctx.orgRole === 'org-admin'
  )
}

export function isOrgOwnerCtx(ctx: OrgContext): boolean {
  return ctx.isSuperAdmin || ctx.isSystemAdmin || ctx.orgRole === 'org-owner'
}

export function isTeamLeadCtx(ctx: TeamContext): boolean {
  return (
    ctx.isSuperAdmin ||
    ctx.isSystemAdmin ||
    ctx.orgRole === 'org-owner' ||
    ctx.orgRole === 'org-admin' ||
    ctx.teamTag === 'team-lead'
  )
}

// ============================================================================
// Convenience helpers that work directly from role strings
// (use in components where you have the user.role from session)
// ============================================================================

/** True if user can access the admin panel at all */
export function canAccessAdminPanel(role?: UserRole): boolean {
  return isSystemAdmin(role)
}

/** True if user can promote/demote system-admins */
export function canManageSystemAdmins(role?: UserRole): boolean {
  return isSuperAdmin(role)
}

/** True if user can manage any user account (approve, suspend, etc.) */
export function canManageUsers(role?: UserRole): boolean {
  return isSystemAdmin(role)
}

/** True if user can view all organizations */
export function canViewAllOrgs(role?: UserRole): boolean {
  return isSystemAdmin(role)
}

// ============================================================================
// Permission Matrices
// ============================================================================

export function canPerformSystemAction(
  role: UserRole | undefined,
  action: SystemAction,
): boolean {
  switch (action) {
    case 'system:promote_system_admin':
    case 'system:demote_system_admin':
    case 'system:unsuspend_user':
      return isSuperAdmin(role)
    case 'system:suspend_user':
    case 'system:view_all_orgs':
      return isSystemAdmin(role)
    default:
      return false
  }
}

export function canPerformOrgAction(
  ctx: OrgContext,
  action: OrgAction,
): boolean {
  const superOrSystem = ctx.isSuperAdmin || ctx.isSystemAdmin
  const orgAdminOrAbove =
    superOrSystem || ctx.orgRole === 'org-owner' || ctx.orgRole === 'org-admin'
  const ownerOrAbove = superOrSystem || ctx.orgRole === 'org-owner'

  switch (action) {
    case 'org:create':
      return superOrSystem
    case 'org:read':
      return superOrSystem || ctx.orgRole !== null
    case 'org:update':
    case 'org:invite_member':
    case 'org:remove_member':
    case 'org:promote_team_lead':
    case 'org:demote_team_lead':
      return orgAdminOrAbove
    case 'org:delete':
    case 'org:promote_to_admin':
    case 'org:demote_admin':
    case 'org:transfer_ownership':
      return ownerOrAbove
    default:
      return false
  }
}

export function canPerformTeamAction(
  ctx: TeamContext,
  action: TeamAction,
): boolean {
  const superOrSystem = ctx.isSuperAdmin || ctx.isSystemAdmin
  const orgAdminOrAbove =
    superOrSystem || ctx.orgRole === 'org-owner' || ctx.orgRole === 'org-admin'
  const teamLeadOrAbove = orgAdminOrAbove || ctx.teamTag === 'team-lead'
  const isAMember = ctx.teamTag !== null

  switch (action) {
    case 'team:create':
    case 'team:delete':
      return orgAdminOrAbove
    case 'team:read':
      return superOrSystem || orgAdminOrAbove || isAMember
    case 'team:update':
    case 'team:invite_member':
    case 'team:remove_member':
    case 'team:view_join_requests':
    case 'team:approve_join_request':
    case 'team:reject_join_request':
    case 'team:self_demote_lead':
      return teamLeadOrAbove
    default:
      return false
  }
}

export function canPerformRetroAction(
  role: UserRole,
  action: RetroAction,
  options?: { isCreator?: boolean },
): boolean {
  switch (action) {
    case 'retro:create':
    case 'retro:read':
    case 'retro:participate':
      return true
    case 'retro:update':
    case 'retro:start':
    case 'retro:end':
    case 'retro:delete':
      return role !== 'member' || (options?.isCreator ?? false)
    default:
      return false
  }
}

// ============================================================================
// Context Builders (client-side, from already-loaded data)
// ============================================================================

/** Build an OrgContext from data already available in the component */
export function buildOrgContext(
  user: UserContext,
  orgRole: OrgRole,
): OrgContext {
  return {
    user,
    orgRole,
    isSuperAdmin: user.role === 'super-admin',
    isSystemAdmin: user.role === 'super-admin' || user.role === 'system-admin',
  }
}

/** Build a TeamContext from data already available in the component */
export function buildTeamContext(
  user: UserContext,
  orgRole: OrgRole,
  teamTag: TeamTag,
): TeamContext {
  return {
    user,
    orgRole,
    teamTag,
    isSuperAdmin: user.role === 'super-admin',
    isSystemAdmin: user.role === 'super-admin' || user.role === 'system-admin',
  }
}

// ============================================================================
// Legacy helpers (backward-compatible wrappers)
// ============================================================================

/** @deprecated Use isSystemAdmin(role) or canPerformTeamAction(ctx, ...) */
export function canManageTeam(
  role: UserRole,
  orgRole: OrgRole,
  teamTag: TeamTag,
): boolean {
  return (
    isSystemAdmin(role) ||
    orgRole === 'org-owner' ||
    orgRole === 'org-admin' ||
    teamTag === 'team-lead'
  )
}

/** @deprecated Use canPerformOrgAction(ctx, 'org:invite_member') */
export function canManageOrgMembers(role: UserRole, orgRole: OrgRole): boolean {
  return (
    isSystemAdmin(role) || orgRole === 'org-owner' || orgRole === 'org-admin'
  )
}

/** @deprecated Use canPerformRetroAction(role, 'retro:participate') */
export function canRunRetro(
  role: UserRole,
  orgRole: OrgRole,
  teamTag: TeamTag,
): boolean {
  return (
    isSystemAdmin(role) ||
    orgRole === 'org-owner' ||
    orgRole === 'org-admin' ||
    teamTag === 'team-lead' ||
    teamTag === 'member'
  )
}
