import { ForbiddenException } from '@nestjs/common';

// ============================================================================
// Role Types
// ============================================================================

export type UserRole =
  | 'super-admin'
  | 'system-admin'
  | 'org-admin'
  | 'team-lead'
  | 'member';

export type OrgRole = 'org-owner' | 'org-admin' | 'member';

// ============================================================================
// Action Types
// ============================================================================

export type SystemAction =
  | 'system:promote_system_admin'
  | 'system:demote_system_admin'
  | 'system:suspend_user'
  | 'system:unsuspend_user'
  | 'system:view_all_orgs';

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
  | 'org:demote_team_lead';

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
  | 'team:self_demote_lead';

export type RetroAction =
  | 'retro:create'
  | 'retro:read'
  | 'retro:update'
  | 'retro:start'
  | 'retro:end'
  | 'retro:delete'
  | 'retro:participate';

// ============================================================================
// Context Objects
// ============================================================================

export interface UserContext {
  id: string;
  role: UserRole;
}

export interface OrgContext {
  user: UserContext;
  /** null = caller is not a member of this org */
  orgRole: OrgRole | null;
  isSuperAdmin: boolean;
  isSystemAdmin: boolean;
}

export interface TeamContext {
  user: UserContext;
  /** null = caller is not a member of this org */
  orgRole: OrgRole | null;
  /** null = caller is not a member of this team */
  teamTag: 'team-lead' | 'member' | null;
  isSuperAdmin: boolean;
  isSystemAdmin: boolean;
}

// ============================================================================
// Role Guard Helpers (pure — operate on context objects, no DB)
// ============================================================================

export function isSuperAdmin(user: UserContext): boolean {
  return user.role === 'super-admin';
}

export function isSystemAdmin(user: UserContext): boolean {
  return user.role === 'super-admin' || user.role === 'system-admin';
}

export function isOrgAdmin(ctx: OrgContext): boolean {
  return (
    ctx.isSuperAdmin ||
    ctx.isSystemAdmin ||
    ctx.orgRole === 'org-owner' ||
    ctx.orgRole === 'org-admin'
  );
}

export function isOrgOwner(ctx: OrgContext): boolean {
  return ctx.isSuperAdmin || ctx.isSystemAdmin || ctx.orgRole === 'org-owner';
}

export function isTeamLead(ctx: TeamContext): boolean {
  return (
    ctx.isSuperAdmin ||
    ctx.isSystemAdmin ||
    ctx.orgRole === 'org-owner' ||
    ctx.orgRole === 'org-admin' ||
    ctx.teamTag === 'team-lead'
  );
}

// ============================================================================
// Permission Matrices
// ============================================================================

export function canPerformSystemAction(
  user: UserContext,
  action: SystemAction,
): boolean {
  switch (action) {
    case 'system:promote_system_admin':
    case 'system:demote_system_admin':
    case 'system:unsuspend_user':
      return isSuperAdmin(user);
    case 'system:suspend_user':
    case 'system:view_all_orgs':
      return isSystemAdmin(user);
    default:
      return false;
  }
}

export function canPerformOrgAction(
  ctx: OrgContext,
  action: OrgAction,
): boolean {
  const superOrSystem = ctx.isSuperAdmin || ctx.isSystemAdmin;
  const orgAdminOrAbove =
    superOrSystem || ctx.orgRole === 'org-owner' || ctx.orgRole === 'org-admin';
  const ownerOrAbove = superOrSystem || ctx.orgRole === 'org-owner';

  switch (action) {
    case 'org:create':
      return superOrSystem;
    case 'org:read':
      return superOrSystem || ctx.orgRole !== null;
    case 'org:update':
    case 'org:invite_member':
    case 'org:remove_member':
    case 'org:promote_team_lead':
    case 'org:demote_team_lead':
      return orgAdminOrAbove;
    case 'org:delete':
    case 'org:promote_to_admin':
    case 'org:demote_admin':
    case 'org:transfer_ownership':
      return ownerOrAbove;
    default:
      return false;
  }
}

export function canPerformTeamAction(
  ctx: TeamContext,
  action: TeamAction,
): boolean {
  const superOrSystem = ctx.isSuperAdmin || ctx.isSystemAdmin;
  const orgAdminOrAbove =
    superOrSystem || ctx.orgRole === 'org-owner' || ctx.orgRole === 'org-admin';
  const teamLeadOrAbove = orgAdminOrAbove || ctx.teamTag === 'team-lead';
  const isAMember = ctx.teamTag !== null;

  switch (action) {
    case 'team:create':
    case 'team:delete':
      return orgAdminOrAbove;
    case 'team:read':
      return superOrSystem || orgAdminOrAbove || isAMember;
    case 'team:update':
    case 'team:invite_member':
    case 'team:remove_member':
    case 'team:view_join_requests':
    case 'team:approve_join_request':
    case 'team:reject_join_request':
    case 'team:self_demote_lead':
      return teamLeadOrAbove;
    default:
      return false;
  }
}

export function canPerformRetroAction(
  user: UserContext,
  action: RetroAction,
  options?: { isCreator?: boolean },
): boolean {
  switch (action) {
    case 'retro:create':
    case 'retro:read':
    case 'retro:participate':
      return true;
    case 'retro:update':
    case 'retro:start':
    case 'retro:end':
    case 'retro:delete':
      return user.role !== 'member' || (options?.isCreator ?? false);
    default:
      return false;
  }
}

// ============================================================================
// Assert Helper
// ============================================================================

/**
 * Throws ForbiddenException if condition is false.
 *
 * @example
 * assertPermission(isSuperAdmin(user), 'Only super-admin can do this')
 * assertPermission(canPerformOrgAction(ctx, 'org:delete'), 'Permission denied')
 */
export function assertPermission(
  condition: boolean,
  message = 'Permission denied',
): void {
  if (!condition) {
    throw new ForbiddenException(message);
  }
}
