import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import * as teamSchema from './schema';
import * as orgSchema from '../organizations/schema';
import * as userSchema from '../auth/schema';
import { generateId } from '../lib/utils';
import { CommonService } from '../common/common.service';
import {
  TEAM_JOIN_REQUEST_STATUSES,
  TEAM_MEMBER_TAGS,
  USER_STATUSES,
} from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';

type Database = NodePgDatabase<
  typeof teamSchema & typeof orgSchema & typeof userSchema
>;

/**
 * Team join-request lifecycle: create, list, approve/reject (single + bulk),
 * cancel, and the system-admin pending overview. Split out of TeamsService
 * (which was ~1,380 lines) so this self-contained flow lives on its own.
 */
@Injectable()
export class TeamsJoinRequestsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
    private readonly commonService: CommonService,
    private readonly notificationsService: NotificationsService,
  ) {}

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
