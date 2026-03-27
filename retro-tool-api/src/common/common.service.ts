import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as userSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import * as teamSchema from '../teams/schema';
import { TAdminActionLogAction } from './enums';
import { generateId } from 'src/lib/utils';
import type { OrgContext, TeamContext, UserContext } from '../lib/rbac';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache-keys';

@Injectable()
export class CommonService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase<
      typeof userSchema & typeof orgSchema & typeof teamSchema
    >,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * SYSTEM-LEVEL CHECKS
   * Cached via userRole key (TTL: 120s).
   */

  /** Fetch + cache the user's system role string. */
  private async getUserRole(userId: string): Promise<string | null> {
    const cacheKey = CacheKeys.userRole(userId);
    const cached = await this.cacheService.get<string>(cacheKey);
    if (cached !== null) return cached;

    const [user] = await this.database
      .select({ role: userSchema.user.role })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, userId))
      .limit(1);

    const role = user?.role ?? null;
    if (role) await this.cacheService.set(cacheKey, role, 120);
    return role;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return (await this.getUserRole(userId)) === 'super-admin';
  }

  async isSystemAdmin(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === 'super-admin' || role === 'system-admin';
  }

  /**
   * ORGANIZATION-LEVEL CHECKS
   * Cached via rbacOrg key (TTL: 120s). Shares cache with buildOrgContext.
   */

  /** Fetch + cache the user's org membership role string. */
  private async getOrgMemberRole(
    userId: string,
    orgId: string,
  ): Promise<string | null> {
    // Try to reuse the full OrgContext cache first
    const cacheKey = CacheKeys.rbacOrg(orgId, userId);
    const cached = await this.cacheService.get<OrgContext>(cacheKey);
    if (cached) return cached.orgRole;

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
    return role === 'org-owner' || role === 'org-admin';
  }

  async isOrgOwner(userId: string, orgId: string): Promise<boolean> {
    return (await this.getOrgMemberRole(userId, orgId)) === 'org-owner';
  }

  async isOrgMember(userId: string, orgId: string): Promise<boolean> {
    return (await this.getOrgMemberRole(userId, orgId)) !== null;
  }

  /**
   * TEAM-LEVEL CHECKS
   * Cached via rbacTeam key (TTL: 120s). Shares cache with buildTeamContext.
   */

  /** Fetch + cache the user's team membership tag. */
  private async getTeamMemberTag(
    userId: string,
    teamId: string,
  ): Promise<string | null> {
    const cacheKey = CacheKeys.rbacTeam(teamId, userId);
    const cached = await this.cacheService.get<TeamContext>(cacheKey);
    if (cached) return cached.teamTag;

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
    return (await this.getTeamMemberTag(userId, teamId)) === 'team-lead';
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

  // Check if any system admin exists (used for bootstrapping first admin)
  async checkAdminExists(): Promise<{ exists: boolean }> {
    const [admin] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.role, 'system-admin'))
      .limit(1);

    if (admin) return { exists: true };

    const [superAdmin] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.role, 'super-admin'))
      .limit(1);

    return { exists: !!superAdmin };
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
    const cacheKey = CacheKeys.rbacOrg(orgId, userId);
    const cached = await this.cacheService.get<OrgContext>(cacheKey);
    if (cached) return cached;

    const [user] = await this.database
      .select({ id: userSchema.user.id, role: userSchema.user.role })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, userId))
      .limit(1);

    if (!user) {
      return {
        user: { id: userId, role: 'member' },
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
      isSuperAdmin: user.role === 'super-admin',
      isSystemAdmin:
        user.role === 'super-admin' || user.role === 'system-admin',
    };

    await this.cacheService.set(cacheKey, ctx, 120);
    return ctx;
  }

  /**
   * Build a TeamContext for the given user + team.
   * Automatically resolves the team's org for org-level role.
   * Pass this to canPerformTeamAction() / isTeamLead() / etc.
   */
  async buildTeamContext(userId: string, teamId: string): Promise<TeamContext> {
    const cacheKey = CacheKeys.rbacTeam(teamId, userId);
    const cached = await this.cacheService.get<TeamContext>(cacheKey);
    if (cached) return cached;

    const [user] = await this.database
      .select({ id: userSchema.user.id, role: userSchema.user.role })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, userId))
      .limit(1);

    if (!user) {
      return {
        user: { id: userId, role: 'member' },
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
      isSuperAdmin: user.role === 'super-admin',
      isSystemAdmin:
        user.role === 'super-admin' || user.role === 'system-admin',
    };

    await this.cacheService.set(cacheKey, ctx, 120);
    return ctx;
  }
}
