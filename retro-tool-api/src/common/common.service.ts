import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, or } from 'drizzle-orm';
import * as userSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import * as teamSchema from '../teams/schema';
import {
  ORG_MEMBER_ROLES,
  TAdminActionLogAction,
  TEAM_MEMBER_TAGS,
  USER_ROLES,
} from './enums';
import { generateId } from 'src/lib/utils';
import type { OrgContext, TeamContext, UserContext } from '../lib/rbac';

@Injectable()
export class CommonService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase<
      typeof userSchema & typeof orgSchema & typeof teamSchema
    >,
  ) {}

  /**
   * SYSTEM-LEVEL CHECKS
   */

  /** Fetch the user's system role string. */
  private async getUserRole(userId: string): Promise<string | null> {
    const [user] = await this.database
      .select({ role: userSchema.user.role })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, userId))
      .limit(1);

    return user?.role ?? null;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return (await this.getUserRole(userId)) === USER_ROLES.SuperAdmin;
  }

  async isSystemAdmin(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === USER_ROLES.SuperAdmin || role === USER_ROLES.SystemAdmin;
  }

  /**
   * ORGANIZATION-LEVEL CHECKS
   */

  /** Fetch the user's org membership role string. */
  private async getOrgMemberRole(
    userId: string,
    orgId: string,
  ): Promise<string | null> {
    const [member] = await this.database
      .select({ role: orgSchema.organizationMember.role })
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(orgSchema.organizationMember.organizationId, orgId),
        ),
      )
      .limit(1);

    return member?.role ?? null;
  }

  async isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
    const role = await this.getOrgMemberRole(userId, orgId);
    return role === ORG_MEMBER_ROLES.Owner || role === ORG_MEMBER_ROLES.Admin;
  }

  async isOrgOwner(userId: string, orgId: string): Promise<boolean> {
    return (
      (await this.getOrgMemberRole(userId, orgId)) === ORG_MEMBER_ROLES.Owner
    );
  }

  async isOrgMember(userId: string, orgId: string): Promise<boolean> {
    return (await this.getOrgMemberRole(userId, orgId)) !== null;
  }

  /**
   * TEAM-LEVEL CHECKS
   */

  /** Fetch the user's team membership tag. */
  private async getTeamMemberTag(
    userId: string,
    teamId: string,
  ): Promise<string | null> {
    const [member] = await this.database
      .select({ tag: teamSchema.teamMember.tag })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);

    return member?.tag ?? null;
  }

  async isTeamLead(userId: string, teamId: string): Promise<boolean> {
    return (
      (await this.getTeamMemberTag(userId, teamId)) === TEAM_MEMBER_TAGS.Lead
    );
  }

  async canManageTeam(userId: string, teamId: string): Promise<boolean> {
    const isAdmin = await this.isSystemAdmin(userId);
    if (isAdmin) return true;

    const [team] = await this.database
      .select()
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    if (!team) return false;

    const isOrgAdmin = await this.isOrgAdmin(userId, team.organizationId);
    const isTeamLead = await this.isTeamLead(userId, teamId);

    return isOrgAdmin || isTeamLead;
  }

  async isTeamMember(userId: string, teamId: string): Promise<boolean> {
    return (await this.getTeamMemberTag(userId, teamId)) !== null;
  }

  /**
   * REQUIREMENTS CHECKS
   * (for validating if user can perform certain actions based on their role)
   */

  // Require system admin role (super-admin or system-admin)
  async requireSystemAdmin(userId: string): Promise<void> {
    const isAdmin = await this.isSystemAdmin(userId);
    if (!isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
  }

  // Require super-admin role for privileged system-role transitions
  async requireSuperAdmin(userId: string): Promise<void> {
    const isSuperAdmin = await this.isSuperAdmin(userId);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  /**
   * LOG ACTIONS
   * (for logging important actions performed by users, especially admins)
   */

  // Log admin action (e.g. user approved/rejected, role changed, etc.)
  async logAdminAction(
    adminId: string,
    targetUserId: string,
    action: TAdminActionLogAction,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.database.insert(userSchema.adminActionLog).values({
      id: generateId(),
      adminId,
      targetUserId,
      action,
      details: details ? JSON.stringify(details) : null,
      createdAt: new Date(),
    });
  }

  /**
   * EXIST CHECKS
   */

  // Check if any admin exists (for bootstrapping) and if any user exists at all (for the sign-up banner).
  async checkAdminExists(): Promise<{ exists: boolean; hasAnyUser: boolean }> {
    const [anyUser] = await this.database
      .select({ id: userSchema.user.id })
      .from(userSchema.user)
      .limit(1);

    if (!anyUser) return { exists: false, hasAnyUser: false };

    const [admin] = await this.database
      .select({ id: userSchema.user.id })
      .from(userSchema.user)
      .where(
        or(
          eq(userSchema.user.role, USER_ROLES.SystemAdmin),
          eq(userSchema.user.role, USER_ROLES.SuperAdmin),
        ),
      )
      .limit(1);

    return { exists: !!admin, hasAnyUser: true };
  }

  // ============================================================================
  // RBAC Context Builders
  // Build typed context objects for use with rbac.ts permission functions.
  // ============================================================================

  /**
   * Build an OrgContext for the given user + org.
   * Pass this to canPerformOrgAction() / isOrgAdmin() / etc.
   */
  async buildOrgContext(userId: string, orgId: string): Promise<OrgContext> {
    const [user] = await this.database
      .select({ id: userSchema.user.id, role: userSchema.user.role })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, userId))
      .limit(1);

    if (!user) {
      return {
        user: { id: userId, role: USER_ROLES.Member },
        orgRole: null,
        isSuperAdmin: false,
        isSystemAdmin: false,
      };
    }

    const userCtx: UserContext = {
      id: user.id,
      role: user.role as UserContext['role'],
    };

    const [membership] = await this.database
      .select({ role: orgSchema.organizationMember.role })
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(orgSchema.organizationMember.organizationId, orgId),
        ),
      )
      .limit(1);

    const ctx: OrgContext = {
      user: userCtx,
      orgRole: (membership?.role ?? null) as OrgContext['orgRole'],
      isSuperAdmin: user.role === USER_ROLES.SuperAdmin,
      isSystemAdmin:
        user.role === USER_ROLES.SuperAdmin ||
        user.role === USER_ROLES.SystemAdmin,
    };

    return ctx;
  }

  /**
   * Build a TeamContext for the given user + team.
   * Automatically resolves the team's org for org-level role.
   * Pass this to canPerformTeamAction() / isTeamLead() / etc.
   */
  async buildTeamContext(userId: string, teamId: string): Promise<TeamContext> {
    const [user] = await this.database
      .select({ id: userSchema.user.id, role: userSchema.user.role })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, userId))
      .limit(1);

    if (!user) {
      return {
        user: { id: userId, role: USER_ROLES.Member },
        orgRole: null,
        teamTag: null,
        isSuperAdmin: false,
        isSystemAdmin: false,
      };
    }

    const userCtx: UserContext = {
      id: user.id,
      role: user.role as UserContext['role'],
    };

    const [team] = await this.database
      .select({ organizationId: teamSchema.team.organizationId })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    let orgRole: TeamContext['orgRole'] = null;
    if (team) {
      const [orgMembership] = await this.database
        .select({ role: orgSchema.organizationMember.role })
        .from(orgSchema.organizationMember)
        .where(
          and(
            eq(orgSchema.organizationMember.userId, userId),
            eq(
              orgSchema.organizationMember.organizationId,
              team.organizationId,
            ),
          ),
        )
        .limit(1);
      orgRole = (orgMembership?.role ?? null) as TeamContext['orgRole'];
    }

    const [teamMembership] = await this.database
      .select({ tag: teamSchema.teamMember.tag })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);

    const ctx: TeamContext = {
      user: userCtx,
      orgRole,
      teamTag: (teamMembership?.tag ?? null) as TeamContext['teamTag'],
      isSuperAdmin: user.role === USER_ROLES.SuperAdmin,
      isSystemAdmin:
        user.role === USER_ROLES.SuperAdmin ||
        user.role === USER_ROLES.SystemAdmin,
    };

    return ctx;
  }
}
