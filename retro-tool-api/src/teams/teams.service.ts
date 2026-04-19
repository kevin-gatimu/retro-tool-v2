import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Config } from '../config/configuration';
import { EmailService } from '../email/email.service';
import { eq, and, desc, count, inArray, ilike, type SQL } from 'drizzle-orm';
import * as teamSchema from './schema';
import * as orgSchema from '../organizations/schema';
import * as userSchema from '../auth/schema';
import { generateId } from '../lib/utils';
import { AddTeamMemberDto, UpdateTeamMemberDto } from './dto';
import { CommonService } from '../common/common.service';
import {
  ORG_MEMBER_ROLES,
  TEAM_JOIN_REQUEST_STATUSES,
  TEAM_MEMBER_TAGS,
  EMAIL_LOG_TYPES,
  USER_STATUSES,
} from 'src/common/enums';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TeamsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase<
      typeof teamSchema & typeof orgSchema & typeof userSchema
    >,
    private readonly commonService: CommonService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<Config>,
  ) {}

  // Create a new team
  async createTeam(
    userId: string,
    data: {
      name: string;
      description?: string;
      emoji?: string;
      organizationId: string;
    },
  ): Promise<typeof teamSchema.team.$inferSelect> {
    const isAdmin = await this.commonService.isSystemAdmin(userId);
    const isOrgAdmin = await this.commonService.isOrgAdmin(
      userId,
      data.organizationId,
    );

    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only system admins and organization admins can create teams',
      );
    }

    const teamId = generateId();

    // Create team
    let team: typeof teamSchema.team.$inferSelect | undefined;
    try {
      const [createdTeam] = await this.database
        .insert(teamSchema.team)
        .values({
          id: teamId,
          name: data.name,
          description: data.description,
          emoji: data.emoji || '👥',
          organizationId: data.organizationId,
        })
        .returning();
      team = createdTeam;
    } catch (error: unknown) {
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        throw new ConflictException(
          `A team named "${data.name}" already exists in this organization`,
        );
      }
      throw error;
    }

    // Add creator as team lead
    await this.database.insert(teamSchema.teamMember).values({
      id: generateId(),
      teamId: teamId,
      userId: userId,
      tag: TEAM_MEMBER_TAGS.Lead,
    });

    if (!team) {
      throw new ConflictException('Failed to create team');
    }

    return team;
  }

  /**
   * Get all teams in an organization
   */
  async getOrganizationTeams(
    userId: string,
    orgId: string,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    // Check if user has access to organization
    const isAdmin = await this.commonService.isSystemAdmin(userId);
    const isOrgMember = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(orgSchema.organizationMember.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!isAdmin && isOrgMember.length === 0) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    const normalizedSearch = search?.trim();

    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(teamSchema.team.organizationId, orgId)];
    if (normalizedSearch) {
      conditions.push(ilike(teamSchema.team.name, `%${normalizedSearch}%`));
    }

    const whereClause = and(...conditions);

    const teams = await this.database
      .select()
      .from(teamSchema.team)
      .where(whereClause)
      .orderBy(desc(teamSchema.team.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalCount] = await this.database
      .select({ count: count() })
      .from(teamSchema.team)
      .where(whereClause);

    // Enrich each team with isMember + hasPendingRequest for the current user
    const teamIds = teams.map((t) => t.id);
    const [memberships, pendingRequests] =
      teamIds.length > 0
        ? await Promise.all([
            this.database
              .select({ teamId: teamSchema.teamMember.teamId })
              .from(teamSchema.teamMember)
              .where(
                and(
                  eq(teamSchema.teamMember.userId, userId),
                  inArray(teamSchema.teamMember.teamId, teamIds),
                ),
              ),
            this.database
              .select({
                teamId: teamSchema.teamJoinRequest.teamId,
                id: teamSchema.teamJoinRequest.id,
              })
              .from(teamSchema.teamJoinRequest)
              .where(
                and(
                  eq(teamSchema.teamJoinRequest.userId, userId),
                  eq(
                    teamSchema.teamJoinRequest.status,
                    TEAM_JOIN_REQUEST_STATUSES.Pending,
                  ),
                  inArray(teamSchema.teamJoinRequest.teamId, teamIds),
                ),
              ),
          ])
        : [[], []];

    const memberTeamIds = new Set(memberships.map((m) => m.teamId));
    const pendingByTeam = new Map(pendingRequests.map((r) => [r.teamId, r.id]));

    const memberCounts =
      teamIds.length > 0
        ? await this.database
            .select({
              teamId: teamSchema.teamMember.teamId,
              memberCount: count(),
            })
            .from(teamSchema.teamMember)
            .where(inArray(teamSchema.teamMember.teamId, teamIds))
            .groupBy(teamSchema.teamMember.teamId)
        : [];

    const memberCountByTeamId = new Map(
      memberCounts.map((r) => [r.teamId, r.memberCount]),
    );

    const result = {
      teams: teams.map((t) => ({
        ...t,
        isMember: memberTeamIds.has(t.id),
        hasPendingRequest: pendingByTeam.has(t.id),
        myPendingRequestId: pendingByTeam.get(t.id) ?? null,
        memberCount: memberCountByTeamId.get(t.id) ?? 0,
      })),
      total: totalCount.count,
      page,
      limit,
      totalPages: Math.ceil(totalCount.count / limit),
    };

    return result;
  }

  /**
   * Get teams for a specific user
   */
  async getUserTeams(userId: string, page = 1, limit = 10, search?: string) {
    const normalizedSearch = search?.trim();
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(teamSchema.teamMember.userId, userId)];
    if (normalizedSearch) {
      conditions.push(ilike(teamSchema.team.name, `%${normalizedSearch}%`));
    }

    const whereClause = and(...conditions);

    const teams = await this.database
      .select({
        team: teamSchema.team,
        memberTag: teamSchema.teamMember.tag,
        organizationName: orgSchema.organization.name,
      })
      .from(teamSchema.team)
      .innerJoin(
        teamSchema.teamMember,
        eq(teamSchema.teamMember.teamId, teamSchema.team.id),
      )
      .leftJoin(
        orgSchema.organization,
        eq(teamSchema.team.organizationId, orgSchema.organization.id),
      )
      .where(whereClause)
      .orderBy(desc(teamSchema.team.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalCount] = await this.database
      .select({ count: count() })
      .from(teamSchema.teamMember)
      .innerJoin(
        teamSchema.team,
        eq(teamSchema.teamMember.teamId, teamSchema.team.id),
      )
      .where(whereClause);

    const teamIds = teams.map((t) => t.team.id);

    const memberCounts =
      teamIds.length > 0
        ? await this.database
            .select({
              teamId: teamSchema.teamMember.teamId,
              memberCount: count(),
            })
            .from(teamSchema.teamMember)
            .where(inArray(teamSchema.teamMember.teamId, teamIds))
            .groupBy(teamSchema.teamMember.teamId)
        : [];

    const memberCountByTeamId = new Map(
      memberCounts.map((r) => [r.teamId, r.memberCount]),
    );

    return {
      teams: teams.map(({ team, memberTag, organizationName }) => ({
        ...team,
        myRole: memberTag ?? TEAM_MEMBER_TAGS.Member,
        memberCount: memberCountByTeamId.get(team.id) ?? 0,
        organization: { name: organizationName ?? 'Organization' },
      })),
      total: totalCount.count,
      page,
      limit,
      totalPages: Math.ceil(totalCount.count / limit),
    };
  }

  /**
   * Get team by ID (enriched)
   */
  async getTeamById(userId: string, teamId: string) {
    // Fetch team + org in one query
    const [row] = await this.database
      .select({
        team: teamSchema.team,
        org: {
          id: orgSchema.organization.id,
          name: orgSchema.organization.name,
          slug: orgSchema.organization.slug,
        },
      })
      .from(teamSchema.team)
      .leftJoin(
        orgSchema.organization,
        eq(teamSchema.team.organizationId, orgSchema.organization.id),
      )
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    if (!row) throw new NotFoundException('Team not found');

    const team = row.team;
    const organization = row.org ?? {
      id: team.organizationId,
      name: 'Unknown',
      slug: '',
    };

    // Compute permissions
    const isSystemAdmin = await this.commonService.isSystemAdmin(userId);

    const [orgMembership] = await this.database
      .select({ role: orgSchema.organizationMember.role })
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(orgSchema.organizationMember.organizationId, team.organizationId),
        ),
      )
      .limit(1);

    const orgRole = orgMembership?.role ?? null;
    const isOrgAdmin =
      orgRole === ORG_MEMBER_ROLES.Owner || orgRole === ORG_MEMBER_ROLES.Admin;

    const [teamMembership] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);

    const isMember = !!teamMembership;
    const myRole = teamMembership?.tag ?? null;

    const isOrgMember = !!orgMembership;
    if (!isSystemAdmin && !isOrgMember) {
      throw new ForbiddenException('You do not have access to this team');
    }

    const [pendingRequest] = await this.database
      .select({ id: teamSchema.teamJoinRequest.id })
      .from(teamSchema.teamJoinRequest)
      .where(
        and(
          eq(teamSchema.teamJoinRequest.userId, userId),
          eq(teamSchema.teamJoinRequest.teamId, teamId),
          eq(
            teamSchema.teamJoinRequest.status,
            TEAM_JOIN_REQUEST_STATUSES.Pending,
          ),
        ),
      )
      .limit(1);

    const canSeeMembers = isSystemAdmin || isOrgAdmin || isMember;
    const canManage =
      isSystemAdmin || isOrgAdmin || myRole === TEAM_MEMBER_TAGS.Lead;

    // Fetch members
    const rawMembers = canSeeMembers
      ? await this.database
          .select({
            id: teamSchema.teamMember.id,
            teamId: teamSchema.teamMember.teamId,
            userId: teamSchema.teamMember.userId,
            roleId: teamSchema.teamMember.roleId,
            roleName: teamSchema.teamRole.name,
            tag: teamSchema.teamMember.tag,
            createdAt: teamSchema.teamMember.createdAt,
            userName: userSchema.user.name,
            userEmail: userSchema.user.email,
            userImage: userSchema.user.image,
            userId2: userSchema.user.id,
            userRole: userSchema.user.role,
            orgRole: orgSchema.organizationMember.role,
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
              eq(
                orgSchema.organizationMember.userId,
                teamSchema.teamMember.userId,
              ),
              eq(
                orgSchema.organizationMember.organizationId,
                team.organizationId,
              ),
            ),
          )
          .where(eq(teamSchema.teamMember.teamId, teamId))
      : [];

    const members = rawMembers.map((m) => ({
      id: m.id,
      teamId: m.teamId,
      userId: m.userId,
      roleId: m.roleId ?? null,
      roleName: m.roleName ?? null,
      tag: m.tag,
      joinedAt: m.createdAt,
      orgRole: m.orgRole ?? null,
      user: {
        id: m.userId2,
        name: m.userName,
        email: m.userEmail,
        image: m.userImage,
        role: m.userRole,
      },
    }));

    // Fetch pending join requests (managers only)
    const rawRequests = canManage
      ? await this.database
          .select({
            id: teamSchema.teamJoinRequest.id,
            teamId: teamSchema.teamJoinRequest.teamId,
            userId: teamSchema.teamJoinRequest.userId,
            status: teamSchema.teamJoinRequest.status,
            message: teamSchema.teamJoinRequest.message,
            createdAt: teamSchema.teamJoinRequest.createdAt,
            userName: userSchema.user.name,
            userEmail: userSchema.user.email,
            userImage: userSchema.user.image,
            userId2: userSchema.user.id,
          })
          .from(teamSchema.teamJoinRequest)
          .innerJoin(
            userSchema.user,
            eq(userSchema.user.id, teamSchema.teamJoinRequest.userId),
          )
          .where(
            and(
              eq(teamSchema.teamJoinRequest.teamId, teamId),
              eq(
                teamSchema.teamJoinRequest.status,
                TEAM_JOIN_REQUEST_STATUSES.Pending,
              ),
            ),
          )
      : [];

    const joinRequests = rawRequests.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      userId: r.userId,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt,
      user: {
        id: r.userId2,
        name: r.userName,
        email: r.userEmail,
        image: r.userImage,
      },
    }));

    return {
      ...team,
      organization,
      orgRole,
      myRole,
      isSystemAdmin,
      isMember,
      hasPendingRequest: !!pendingRequest,
      myPendingRequestId: pendingRequest?.id ?? null,
      canSeeMembers,
      memberCount: members.length,
      members,
      joinRequests,
    };
  }

  /**
   * Update team
   */
  async updateTeam(
    userId: string,
    teamId: string,
    data: {
      name?: string;
      description?: string | null;
      emoji?: string;
    },
  ) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);

    if (!canManage) {
      throw new ForbiddenException(
        'Only system admins, organization admins, and team leads can update teams',
      );
    }

    const [team] = await this.database
      .update(teamSchema.team)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(teamSchema.team.id, teamId))
      .returning();

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  /**
   * Delete team
   */
  async deleteTeam(userId: string, teamId: string) {
    const [team] = await this.database
      .select()
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isAdmin = await this.commonService.isSystemAdmin(userId);
    const isOrgAdmin = await this.commonService.isOrgAdmin(
      userId,
      team.organizationId,
    );

    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only system admins and organization admins can delete teams',
      );
    }

    const [deletedTeam] = await this.database
      .delete(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .returning();

    return deletedTeam;
  }

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

    return { message: 'Left team successfully' };
  }

  /**
   * Create a join request
   */
  async createJoinRequest(userId: string, teamId: string, message?: string) {
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
        'You must be a member of the organization to request to join a team',
      );
    }

    // Check not already a member
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

    // Check no pending request
    const [pendingRequest] = await this.database
      .select()
      .from(teamSchema.teamJoinRequest)
      .where(
        and(
          eq(teamSchema.teamJoinRequest.userId, userId),
          eq(teamSchema.teamJoinRequest.teamId, teamId),
          eq(
            teamSchema.teamJoinRequest.status,
            TEAM_JOIN_REQUEST_STATUSES.Pending,
          ),
        ),
      )
      .limit(1);

    if (pendingRequest) {
      throw new ForbiddenException('You already have a pending join request');
    }

    const [request] = await this.database
      .insert(teamSchema.teamJoinRequest)
      .values({
        id: generateId(),
        teamId,
        userId,
        status: TEAM_JOIN_REQUEST_STATUSES.Pending,
        message: message ?? null,
      })
      .returning();

    const [requester] = await this.database
      .select({ name: userSchema.user.name })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, userId))
      .limit(1);

    void this.notificationsService
      .notifyTeamAdminsOfJoinRequest(
        teamId,
        team.name,
        userId,
        requester?.name ?? 'Someone',
      )
      .catch(() => undefined);

    // Send email to team leads
    const adminsWithEmails = await this.database
      .select({
        userId: teamSchema.teamMember.userId,
        email: userSchema.user.email,
        name: userSchema.user.name,
      })
      .from(teamSchema.teamMember)
      .innerJoin(
        userSchema.user,
        eq(userSchema.user.id, teamSchema.teamMember.userId),
      )
      .where(
        and(
          eq(teamSchema.teamMember.teamId, teamId),
          eq(teamSchema.teamMember.tag, TEAM_MEMBER_TAGS.Lead),
        ),
      );

    const appUrl =
      this.configService.get('frontend.url', { infer: true }) ?? '';
    for (const admin of adminsWithEmails.filter((a) => a.userId !== userId)) {
      void this.emailService
        .send({
          to: admin.email,
          subject: `${requester?.name ?? 'Someone'} wants to join ${team.name}`,
          html: this.emailService.buildTeamJoinRequestHtml({
            adminName: admin.name,
            requesterName: requester?.name ?? 'Someone',
            teamName: team.name,
            appUrl,
          }),
          userId: admin.userId,
          type: EMAIL_LOG_TYPES.TeamActivity,
        })
        .catch(() => undefined);
    }

    return request;
  }

  /**
   * Get join requests for a team
   */
  async getJoinRequests(userId: string, teamId: string) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);
    if (!canManage) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.database
      .select()
      .from(teamSchema.teamJoinRequest)
      .where(eq(teamSchema.teamJoinRequest.teamId, teamId))
      .orderBy(desc(teamSchema.teamJoinRequest.createdAt));
  }

  /**
   * Get single join request
   */
  async getJoinRequest(userId: string, teamId: string, requestId: string) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);
    if (!canManage) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const [request] = await this.database
      .select()
      .from(teamSchema.teamJoinRequest)
      .where(
        and(
          eq(teamSchema.teamJoinRequest.id, requestId),
          eq(teamSchema.teamJoinRequest.teamId, teamId),
        ),
      )
      .limit(1);

    if (!request) throw new NotFoundException('Join request not found');
    return request;
  }

  /**
   * Cancel / delete a join request (by the requester)
   */
  async cancelJoinRequest(userId: string, teamId: string, requestId: string) {
    const [request] = await this.database
      .select()
      .from(teamSchema.teamJoinRequest)
      .where(
        and(
          eq(teamSchema.teamJoinRequest.id, requestId),
          eq(teamSchema.teamJoinRequest.teamId, teamId),
        ),
      )
      .limit(1);

    if (!request) throw new NotFoundException('Join request not found');

    // Only the requester or team managers can cancel
    const canManage = await this.commonService.canManageTeam(userId, teamId);
    if (request.userId !== userId && !canManage) {
      throw new ForbiddenException('You cannot cancel this request');
    }

    await this.database
      .delete(teamSchema.teamJoinRequest)
      .where(eq(teamSchema.teamJoinRequest.id, requestId));

    return { message: 'Join request cancelled' };
  }

  /**
   * Approve a join request
   */
  async approveJoinRequest(userId: string, teamId: string, requestId: string) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);
    if (!canManage) throw new ForbiddenException('Insufficient permissions');

    const [team] = await this.database
      .select({
        name: teamSchema.team.name,
        organizationId: teamSchema.team.organizationId,
      })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    const [request] = await this.database
      .select()
      .from(teamSchema.teamJoinRequest)
      .where(
        and(
          eq(teamSchema.teamJoinRequest.id, requestId),
          eq(teamSchema.teamJoinRequest.teamId, teamId),
        ),
      )
      .limit(1);

    if (!request) throw new NotFoundException('Join request not found');
    if (request.status !== TEAM_JOIN_REQUEST_STATUSES.Pending) {
      throw new ForbiddenException('Request is no longer pending');
    }

    await this.database
      .update(teamSchema.teamJoinRequest)
      .set({
        status: TEAM_JOIN_REQUEST_STATUSES.Approved,
        reviewedById: userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(teamSchema.teamJoinRequest.id, requestId));

    // Add user as team member
    const [member] = await this.database
      .insert(teamSchema.teamMember)
      .values({
        id: generateId(),
        teamId,
        userId: request.userId,
        tag: TEAM_MEMBER_TAGS.Member,
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
          eq(userSchema.user.id, request.userId),
          eq(userSchema.user.status, USER_STATUSES.Pending),
        ),
      );

    void this.notificationsService
      .notifyUserOfJoinApproval(request.userId, teamId, team.name)
      .catch(() => undefined);

    // Send approval email to requester
    const [requesterUser] = await this.database
      .select({ email: userSchema.user.email, name: userSchema.user.name })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, request.userId))
      .limit(1);

    if (requesterUser) {
      const appUrl =
        this.configService.get('frontend.url', { infer: true }) ?? '';
      void this.emailService
        .send({
          to: requesterUser.email,
          subject: `Your request to join ${team.name} has been approved`,
          html: this.emailService.buildTeamJoinApprovedHtml({
            userName: requesterUser.name,
            teamName: team.name,
            teamId,
            appUrl,
          }),
          userId: request.userId,
          type: EMAIL_LOG_TYPES.TeamActivity,
        })
        .catch(() => undefined);
    }

    return {
      request: { ...request, status: TEAM_JOIN_REQUEST_STATUSES.Approved },
      member,
    };
  }

  /**
   * Reject a join request
   */
  async rejectJoinRequest(
    userId: string,
    teamId: string,
    requestId: string,
    reviewNote?: string,
  ) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);
    if (!canManage) throw new ForbiddenException('Insufficient permissions');

    const [[team], [request]] = await Promise.all([
      this.database
        .select({
          name: teamSchema.team.name,
          organizationId: teamSchema.team.organizationId,
        })
        .from(teamSchema.team)
        .where(eq(teamSchema.team.id, teamId))
        .limit(1),
      this.database
        .select()
        .from(teamSchema.teamJoinRequest)
        .where(
          and(
            eq(teamSchema.teamJoinRequest.id, requestId),
            eq(teamSchema.teamJoinRequest.teamId, teamId),
          ),
        )
        .limit(1),
    ]);

    if (!request) throw new NotFoundException('Join request not found');
    if (request.status !== TEAM_JOIN_REQUEST_STATUSES.Pending) {
      throw new ForbiddenException('Request is no longer pending');
    }

    const [updated] = await this.database
      .update(teamSchema.teamJoinRequest)
      .set({
        status: TEAM_JOIN_REQUEST_STATUSES.Rejected,
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNote: reviewNote ?? null,
        updatedAt: new Date(),
      })
      .where(eq(teamSchema.teamJoinRequest.id, requestId))
      .returning();

    void this.notificationsService
      .notifyUserOfJoinRejection(request.userId, team?.name ?? 'the team')
      .catch(() => undefined);

    // Send rejection email to requester
    const [requesterUser] = await this.database
      .select({ email: userSchema.user.email, name: userSchema.user.name })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, request.userId))
      .limit(1);

    if (requesterUser) {
      void this.emailService
        .send({
          to: requesterUser.email,
          subject: `Your request to join ${team?.name ?? 'the team'} was not approved`,
          html: this.emailService.buildTeamJoinRejectedHtml({
            userName: requesterUser.name,
            teamName: team?.name ?? 'the team',
          }),
          userId: request.userId,
          type: EMAIL_LOG_TYPES.TeamActivity,
        })
        .catch(() => undefined);
    }

    return updated;
  }

  /**
   * Bulk approve join requests for a team
   */
  async bulkApproveJoinRequests(
    userId: string,
    teamId: string,
    requestIds: string[],
  ) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only team managers can approve join requests',
      );
    }

    const results = await Promise.allSettled(
      requestIds.map((requestId) =>
        this.approveJoinRequest(userId, teamId, requestId),
      ),
    );

    const approved = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { approved, failed };
  }

  /**
   * Get all pending join requests across all teams (system admin only)
   */
  async getAllPendingJoinRequests(userId: string) {
    const isAdmin = await this.commonService.isSystemAdmin(userId);
    if (!isAdmin) {
      throw new ForbiddenException('Only system admins can view all requests');
    }

    const requests = await this.database
      .select({
        id: teamSchema.teamJoinRequest.id,
        teamId: teamSchema.teamJoinRequest.teamId,
        userId: teamSchema.teamJoinRequest.userId,
        message: teamSchema.teamJoinRequest.message,
        createdAt: teamSchema.teamJoinRequest.createdAt,
        teamName: teamSchema.team.name,
        teamEmoji: teamSchema.team.emoji,
        orgId: orgSchema.organization.id,
        orgName: orgSchema.organization.name,
        userName: userSchema.user.name,
        userEmail: userSchema.user.email,
        userImage: userSchema.user.image,
      })
      .from(teamSchema.teamJoinRequest)
      .innerJoin(
        teamSchema.team,
        eq(teamSchema.team.id, teamSchema.teamJoinRequest.teamId),
      )
      .innerJoin(
        orgSchema.organization,
        eq(orgSchema.organization.id, teamSchema.team.organizationId),
      )
      .innerJoin(
        userSchema.user,
        eq(userSchema.user.id, teamSchema.teamJoinRequest.userId),
      )
      .where(
        eq(
          teamSchema.teamJoinRequest.status,
          TEAM_JOIN_REQUEST_STATUSES.Pending,
        ),
      )
      .orderBy(desc(teamSchema.teamJoinRequest.createdAt));

    return requests.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      userId: r.userId,
      message: r.message,
      createdAt: r.createdAt,
      team: { id: r.teamId, name: r.teamName, emoji: r.teamEmoji },
      org: { id: r.orgId, name: r.orgName },
      user: {
        id: r.userId,
        name: r.userName,
        email: r.userEmail,
        image: r.userImage,
      },
    }));
  }
}
