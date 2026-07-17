import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, count, inArray, ilike, type SQL } from 'drizzle-orm';
import * as teamSchema from './schema';
import * as orgSchema from '../organizations/schema';
import * as userSchema from '../auth/schema';
import { CommonService } from '../common/common.service';
import {
  ORG_MEMBER_ROLES,
  TEAM_JOIN_REQUEST_STATUSES,
  TEAM_MEMBER_TAGS,
} from '../common/enums';

type Database = NodePgDatabase<
  typeof teamSchema & typeof orgSchema & typeof userSchema
>;

/**
 * Read/aggregation queries for teams. Split out of TeamsService (which was
 * ~1,380 lines) so the enriched listing + detail builders live apart from team
 * mutations, membership management, and join-request handling.
 */
@Injectable()
export class TeamsQueryService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
    private readonly commonService: CommonService,
  ) {}

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
}
