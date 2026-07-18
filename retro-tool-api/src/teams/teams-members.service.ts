import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, count } from 'drizzle-orm';
import * as teamSchema from './schema';
import * as orgSchema from '../organizations/schema';
import * as userSchema from '../auth/schema';
import { generateId } from '../lib/utils';
import { AddTeamMemberDto, UpdateTeamMemberDto } from './dto';
import { CommonService } from '../common/common.service';
import { TeamsMembersProjectionSyncService } from './teams-members-projection-sync.service';
import { TEAM_MEMBER_TAGS, USER_STATUSES } from '../common/enums';

type Database = NodePgDatabase<
  typeof teamSchema & typeof orgSchema & typeof userSchema
>;

/**
 * Team membership management: listing members, add/remove, role/tag updates,
 * and self join/leave. Split out of TeamsService (which was ~1,380 lines) so
 * membership operations live apart from team CRUD, queries, and join requests.
 */
@Injectable()
export class TeamsMembersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
    private readonly commonService: CommonService,
    private readonly membersProjectionSync: TeamsMembersProjectionSyncService,
  ) {}

  /**
   * Get team members
   */
  async getTeamMembers(userId: string, teamId: string, page = 1, limit = 10) {
    // Check if user has access
    const isAdmin = await this.commonService.isSystemAdmin(userId);
    const isTeamMember = await this.commonService.isTeamMember(userId, teamId);

    if (!isAdmin && !isTeamMember) {
      throw new ForbiddenException('You do not have access to this team');
    }

    // Get the team's organizationId for org role lookup
    const [team] = await this.database
      .select({ organizationId: teamSchema.team.organizationId })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    const offset = (page - 1) * limit;

    const members = await this.database
      .select({
        userId: teamSchema.teamMember.userId,
        teamId: teamSchema.teamMember.teamId,
        roleId: teamSchema.teamMember.roleId,
        roleName: teamSchema.teamRole.name,
        tag: teamSchema.teamMember.tag,
        createdAt: teamSchema.teamMember.createdAt,
        orgRole: orgSchema.organizationMember.role,
        userRow: userSchema.user,
      })
      .from(teamSchema.teamMember)
      .innerJoin(
        userSchema.user,
        eq(userSchema.user.id, teamSchema.teamMember.userId),
      )
      .leftJoin(
        teamSchema.teamRole,
        eq(teamSchema.teamRole.id, teamSchema.teamMember.roleId),
      )
      .leftJoin(
        orgSchema.organizationMember,
        and(
          eq(orgSchema.organizationMember.userId, teamSchema.teamMember.userId),
          eq(
            orgSchema.organizationMember.organizationId,
            team?.organizationId ?? '',
          ),
        ),
      )
      .where(eq(teamSchema.teamMember.teamId, teamId))
      .orderBy(desc(teamSchema.teamMember.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalCount] = await this.database
      .select({ count: count() })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));

    return {
      members: members.map((m) => ({
        userId: m.userId,
        teamId: m.teamId,
        roleId: m.roleId ?? null,
        roleName: m.roleName ?? null,
        tag: m.tag,
        joinedAt: m.createdAt,
        orgRole: m.orgRole ?? null,
        user: {
          id: m.userRow.id,
          name: m.userRow.name,
          email: m.userRow.email,
          image: m.userRow.image,
          role: m.userRow.role,
        },
      })),
      total: totalCount.count,
      page,
      limit,
      totalPages: Math.ceil(totalCount.count / limit),
    };
  }

  /**
   * Add member to team
   */
  async addTeamMember(userId: string, teamId: string, data: AddTeamMemberDto) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);

    if (!canManage) {
      throw new ForbiddenException(
        'Only system admins, organization admins, and team leads can add members',
      );
    }

    // Check if user is already a member
    const existingMember = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, data.userId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);

    if (existingMember.length > 0) {
      throw new ForbiddenException('User is already a member of this team');
    }

    // Check if user is member of the organization
    const [team] = await this.database
      .select()
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isOrgMember = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, data.userId),
          eq(orgSchema.organizationMember.organizationId, team.organizationId),
        ),
      )
      .limit(1);

    if (isOrgMember.length === 0) {
      throw new ForbiddenException(
        'User must be a member of the organization first',
      );
    }

    const [member] = await this.database
      .insert(teamSchema.teamMember)
      .values({
        id: generateId(),
        teamId: teamId,
        userId: data.userId,
        roleId: data.roleId ?? null,
        tag: data.tag,
      })
      .returning();

    // Auto-approve the user account if it is still pending
    await this.database
      .update(userSchema.user)
      .set({
        status: USER_STATUSES.Approved,
        approvedAt: new Date(),
        approvedById: userId,
      })
      .where(
        and(
          eq(userSchema.user.id, data.userId),
          eq(userSchema.user.status, USER_STATUSES.Pending),
        ),
      );

    // Push the membership projection so Convex team-scoped reads see the new
    // member (fire-and-forget; no-ops when Convex is unset). SECURITY-ASSESSMENT F1.
    void this.membersProjectionSync.enqueueMembershipSync(data.userId, teamId);

    return member;
  }

  /**
   * Remove member from team
   */
  async removeTeamMember(userId: string, teamId: string, memberId: string) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);

    if (!canManage) {
      throw new ForbiddenException(
        'Only system admins, organization admins, and team leads can remove members',
      );
    }

    const [member] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, memberId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Team leads can only remove regular members, not other leads
    // (Org admins who are also team leads are exempt from this restriction)
    const isLead = await this.commonService.isTeamLead(userId, teamId);
    if (
      isLead &&
      member.tag === TEAM_MEMBER_TAGS.Lead &&
      member.userId !== userId
    ) {
      const [orgLookup] = await this.database
        .select({ organizationId: teamSchema.team.organizationId })
        .from(teamSchema.team)
        .where(eq(teamSchema.team.id, teamId))
        .limit(1);
      const isOrgAdmin = orgLookup
        ? await this.commonService.isOrgAdmin(userId, orgLookup.organizationId)
        : false;
      if (!isOrgAdmin) {
        throw new ForbiddenException(
          'Team leads cannot remove other team leads',
        );
      }
    }

    const [deletedMember] = await this.database
      .delete(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.id, member.id))
      .returning();

    void this.membersProjectionSync.enqueueMembershipRemoval(memberId, teamId);

    return deletedMember;
  }

  /**
   * Update member role in team
   */
  async updateTeamMemberRole(
    userId: string,
    teamId: string,
    memberId: string,
    data: UpdateTeamMemberDto,
  ) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);

    if (!canManage) {
      throw new ForbiddenException(
        'Only system admins, organization admins, and team leads can update member roles',
      );
    }

    const [member] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, memberId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Team leads can only update regular members, not other leads
    // (Org admins who are also team leads are exempt from this restriction)
    const isLead = await this.commonService.isTeamLead(userId, teamId);
    if (
      isLead &&
      member.tag === TEAM_MEMBER_TAGS.Lead &&
      member.userId !== userId
    ) {
      const [orgLookup] = await this.database
        .select({ organizationId: teamSchema.team.organizationId })
        .from(teamSchema.team)
        .where(eq(teamSchema.team.id, teamId))
        .limit(1);
      const isOrgAdmin = orgLookup
        ? await this.commonService.isOrgAdmin(userId, orgLookup.organizationId)
        : false;
      if (!isOrgAdmin) {
        throw new ForbiddenException(
          'Team leads cannot update other team leads',
        );
      }
    }

    const [updatedMember] = await this.database
      .update(teamSchema.teamMember)
      .set({
        roleId: data.roleId,
        tag: data.tag,
      })
      .where(eq(teamSchema.teamMember.id, member.id))
      .returning();

    return updatedMember;
  }

  /**
   * Update member job role (the dev/qa/etc role field)
   */
  async updateTeamMemberJobRole(
    userId: string,
    teamId: string,
    memberId: string,
    teamRoleId: string | null,
  ) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only system admins, organization admins, and team leads can update member roles',
      );
    }

    const [member] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, memberId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);

    if (!member) throw new NotFoundException('Member not found');

    const [updated] = await this.database
      .update(teamSchema.teamMember)
      .set({ roleId: teamRoleId })
      .where(eq(teamSchema.teamMember.id, member.id))
      .returning();

    return updated;
  }

  /**
   * Self-join a team (user must be org member; team must not require approval)
   */
  async joinTeam(userId: string, teamId: string) {
    const [team] = await this.database
      .select()
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    if (!team) throw new NotFoundException('Team not found');

    // User must be an org member
    const [orgMembership] = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(orgSchema.organizationMember.organizationId, team.organizationId),
        ),
      )
      .limit(1);

    if (!orgMembership) {
      throw new ForbiddenException(
        'You must be a member of the organization to join a team',
      );
    }

    const [existing] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ForbiddenException('You are already a member of this team');
    }

    const [member] = await this.database
      .insert(teamSchema.teamMember)
      .values({
        id: generateId(),
        teamId,
        userId,
        tag: TEAM_MEMBER_TAGS.Member,
      })
      .returning();

    void this.membersProjectionSync.enqueueMembershipSync(userId, teamId);

    return member;
  }

  /**
   * Leave a team
   */
  async leaveTeam(userId: string, teamId: string) {
    const [member] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);

    if (!member)
      throw new NotFoundException('You are not a member of this team');

    await this.database
      .delete(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.id, member.id));

    void this.membersProjectionSync.enqueueMembershipRemoval(userId, teamId);

    return { message: 'Left team successfully' };
  }
}
