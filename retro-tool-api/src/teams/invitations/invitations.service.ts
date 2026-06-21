import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Config } from '../../config/configuration';
import { EmailService } from '../../email/email.service';
import { eq, and, isNull, ilike, count, desc } from 'drizzle-orm';
import * as teamSchema from '../schema';
import * as orgSchema from '../../organizations/schema';
import * as userSchema from '../../auth/schema';
import { generateId } from '../../lib/utils';
import { CommonService } from '../../common/common.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  EMAIL_LOG_TYPES,
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  USER_STATUSES,
} from '../../common/enums';

@Injectable()
export class TeamInvitationsService {
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

  async inviteTeamMember(
    actorId: string,
    teamId: string,
    email: string,
    tag: (typeof TEAM_MEMBER_TAGS)[keyof typeof TEAM_MEMBER_TAGS],
  ) {
    const canManage = await this.commonService.canManageTeam(actorId, teamId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only system admins, organization admins, and team leads can invite members',
      );
    }

    const [team] = await this.database
      .select({
        id: teamSchema.team.id,
        name: teamSchema.team.name,
        organizationId: teamSchema.team.organizationId,
        orgName: orgSchema.organization.name,
      })
      .from(teamSchema.team)
      .innerJoin(
        orgSchema.organization,
        eq(orgSchema.organization.id, teamSchema.team.organizationId),
      )
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    if (!team) throw new NotFoundException('Team not found');

    const appUrl =
      this.configService.get('frontend.url', { infer: true }) ?? '';

    const [existingInvite] = await this.database
      .select()
      .from(teamSchema.teamInvitation)
      .where(
        and(
          eq(teamSchema.teamInvitation.email, email),
          eq(teamSchema.teamInvitation.teamId, teamId),
        ),
      )
      .limit(1);

    if (existingInvite && !existingInvite.acceptedAt) {
      await this.database
        .delete(teamSchema.teamInvitation)
        .where(eq(teamSchema.teamInvitation.id, existingInvite.id));
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await this.database.insert(teamSchema.teamInvitation).values({
      id: generateId(),
      token,
      email,
      teamId,
      tag,
      createdById: actorId,
      expiresAt,
    });

    const [invitee] = await this.database
      .select({ id: userSchema.user.id, name: userSchema.user.name })
      .from(userSchema.user)
      .where(eq(userSchema.user.email, email))
      .limit(1);

    if (invitee) {
      void this.emailService
        .send({
          to: email,
          subject: `You've been invited to join ${team.name}`,
          html: this.emailService.buildTeamInviteHtml({
            userName: invitee.name,
            invitedEmail: email,
            orgName: team.orgName,
            teamName: team.name,
            tag,
            appUrl,
            token,
          }),
          userId: invitee.id,
          type: EMAIL_LOG_TYPES.TeamInvite,
        })
        .catch(() => undefined);
    } else {
      void this.emailService
        .send({
          to: email,
          subject: `You've been invited to join ${team.name}`,
          html: this.emailService.buildTeamExternalInviteHtml({
            orgName: team.orgName,
            teamName: team.name,
            tag,
            appUrl,
            token,
            invitedEmail: email,
          }),
          userId: actorId,
          type: EMAIL_LOG_TYPES.TeamInviteExternal,
        })
        .catch(() => undefined);
    }

    return { pending: true };
  }

  async listInvitations(
    actorId: string,
    teamId: string,
    {
      page = 1,
      limit = 10,
      search,
    }: { page?: number; limit?: number; search?: string },
  ) {
    const canManage = await this.commonService.canManageTeam(actorId, teamId);
    if (!canManage) {
      throw new ForbiddenException('Only team managers can view invitations');
    }

    const conditions = [
      eq(teamSchema.teamInvitation.teamId, teamId),
      isNull(teamSchema.teamInvitation.acceptedAt),
    ];
    if (search && search.length >= 2) {
      conditions.push(ilike(teamSchema.teamInvitation.email, `%${search}%`));
    }

    const where = and(...conditions);
    const offset = (page - 1) * limit;

    const [invitations, [{ total }]] = await Promise.all([
      this.database
        .select({
          id: teamSchema.teamInvitation.id,
          email: teamSchema.teamInvitation.email,
          tag: teamSchema.teamInvitation.tag,
          createdAt: teamSchema.teamInvitation.createdAt,
          expiresAt: teamSchema.teamInvitation.expiresAt,
          invitedByName: userSchema.user.name,
          invitedByEmail: userSchema.user.email,
          invitedById: userSchema.user.id,
        })
        .from(teamSchema.teamInvitation)
        .leftJoin(
          userSchema.user,
          eq(userSchema.user.id, teamSchema.teamInvitation.createdById),
        )
        .where(where)
        .orderBy(desc(teamSchema.teamInvitation.createdAt))
        .limit(limit)
        .offset(offset),
      this.database
        .select({ total: count() })
        .from(teamSchema.teamInvitation)
        .where(where),
    ]);

    return {
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        tag: inv.tag,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        invitedBy: {
          id: inv.invitedById,
          name: inv.invitedByName,
          email: inv.invitedByEmail,
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async revokeInvitation(
    actorId: string,
    teamId: string,
    invitationId: string,
  ) {
    const canManage = await this.commonService.canManageTeam(actorId, teamId);
    if (!canManage) {
      throw new ForbiddenException('Only team managers can revoke invitations');
    }

    const [invitation] = await this.database
      .select()
      .from(teamSchema.teamInvitation)
      .where(
        and(
          eq(teamSchema.teamInvitation.id, invitationId),
          eq(teamSchema.teamInvitation.teamId, teamId),
        ),
      )
      .limit(1);

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt) {
      throw new ConflictException(
        'Cannot revoke an already accepted invitation',
      );
    }

    await this.database
      .delete(teamSchema.teamInvitation)
      .where(eq(teamSchema.teamInvitation.id, invitationId));

    return { revoked: true };
  }

  async resendInvitation(
    actorId: string,
    teamId: string,
    invitationId: string,
  ) {
    const canManage = await this.commonService.canManageTeam(actorId, teamId);
    if (!canManage) {
      throw new ForbiddenException('Only team managers can resend invitations');
    }

    const [invitation] = await this.database
      .select()
      .from(teamSchema.teamInvitation)
      .where(
        and(
          eq(teamSchema.teamInvitation.id, invitationId),
          eq(teamSchema.teamInvitation.teamId, teamId),
        ),
      )
      .limit(1);

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt) {
      throw new ConflictException(
        'Cannot resend an already accepted invitation',
      );
    }

    const newToken = crypto.randomUUID();
    const newExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await this.database
      .update(teamSchema.teamInvitation)
      .set({ token: newToken, expiresAt: newExpiresAt })
      .where(eq(teamSchema.teamInvitation.id, invitationId));

    const [team] = await this.database
      .select({
        id: teamSchema.team.id,
        name: teamSchema.team.name,
        organizationId: teamSchema.team.organizationId,
        orgName: orgSchema.organization.name,
      })
      .from(teamSchema.team)
      .innerJoin(
        orgSchema.organization,
        eq(orgSchema.organization.id, teamSchema.team.organizationId),
      )
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    const appUrl =
      this.configService.get('frontend.url', { infer: true }) ?? '';

    const [invitee] = await this.database
      .select({ id: userSchema.user.id, name: userSchema.user.name })
      .from(userSchema.user)
      .where(eq(userSchema.user.email, invitation.email))
      .limit(1);

    if (invitee) {
      void this.emailService
        .send({
          to: invitation.email,
          subject: `You've been invited to join ${team?.name ?? 'a team'}`,
          html: this.emailService.buildTeamInviteHtml({
            userName: invitee.name,
            invitedEmail: invitation.email,
            orgName: team?.orgName ?? '',
            teamName: team?.name ?? '',
            tag: invitation.tag,
            appUrl,
            token: newToken,
          }),
          userId: invitee.id,
          type: EMAIL_LOG_TYPES.TeamInvite,
        })
        .catch(() => undefined);
    } else {
      void this.emailService
        .send({
          to: invitation.email,
          subject: `You've been invited to join ${team?.name ?? 'a team'}`,
          html: this.emailService.buildTeamExternalInviteHtml({
            orgName: team?.orgName ?? '',
            teamName: team?.name ?? '',
            tag: invitation.tag,
            appUrl,
            token: newToken,
            invitedEmail: invitation.email,
          }),
          userId: actorId,
          type: EMAIL_LOG_TYPES.TeamInviteExternal,
        })
        .catch(() => undefined);
    }

    return { resent: true };
  }

  async getTeamInvitationPreview(token: string) {
    const [invitation] = await this.database
      .select({
        email: teamSchema.teamInvitation.email,
        tag: teamSchema.teamInvitation.tag,
        expiresAt: teamSchema.teamInvitation.expiresAt,
        acceptedAt: teamSchema.teamInvitation.acceptedAt,
        teamName: teamSchema.team.name,
        orgName: orgSchema.organization.name,
        teamId: teamSchema.team.id,
        orgId: teamSchema.team.organizationId,
      })
      .from(teamSchema.teamInvitation)
      .innerJoin(
        teamSchema.team,
        eq(teamSchema.team.id, teamSchema.teamInvitation.teamId),
      )
      .innerJoin(
        orgSchema.organization,
        eq(orgSchema.organization.id, teamSchema.team.organizationId),
      )
      .where(eq(teamSchema.teamInvitation.token, token))
      .limit(1);

    if (!invitation) throw new NotFoundException('Invitation not found');

    const [existingUser] = await this.database
      .select({ id: userSchema.user.id })
      .from(userSchema.user)
      .where(eq(userSchema.user.email, invitation.email))
      .limit(1);

    return {
      type: 'team' as const,
      orgName: invitation.orgName,
      teamName: invitation.teamName,
      role: invitation.tag,
      invitedEmail: invitation.email,
      expired: invitation.expiresAt < new Date(),
      accepted: !!invitation.acceptedAt,
      isExistingUser: !!existingUser,
      teamId: invitation.teamId,
      orgId: invitation.orgId,
    };
  }

  async acceptTeamInvitation(token: string, userId: string) {
    const [invitation] = await this.database
      .select()
      .from(teamSchema.teamInvitation)
      .where(eq(teamSchema.teamInvitation.token, token))
      .limit(1);

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt)
      throw new ConflictException('Invitation has already been accepted');
    if (invitation.expiresAt < new Date())
      throw new ForbiddenException('Invitation has expired');

    const [user] = await this.database
      .select({ email: userSchema.user.email })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, userId))
      .limit(1);

    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address',
      );
    }

    const [team] = await this.database
      .select({
        id: teamSchema.team.id,
        name: teamSchema.team.name,
        organizationId: teamSchema.team.organizationId,
      })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, invitation.teamId))
      .limit(1);

    if (!team) throw new NotFoundException('Team not found');

    await this.database
      .update(userSchema.user)
      .set({
        status: USER_STATUSES.Approved,
        approvedAt: new Date(),
        approvedById: invitation.createdById,
      })
      .where(
        and(
          eq(userSchema.user.id, userId),
          eq(userSchema.user.status, USER_STATUSES.Pending),
        ),
      );

    // Accepting an invite proves the user controls the invited mailbox,
    // so we mark the email as verified and skip the verify-email step.
    await this.database
      .update(userSchema.user)
      .set({ emailVerified: true })
      .where(eq(userSchema.user.id, userId));

    const [existingOrgMember] = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(orgSchema.organizationMember.organizationId, team.organizationId),
        ),
      )
      .limit(1);

    if (!existingOrgMember) {
      await this.database.insert(orgSchema.organizationMember).values({
        id: generateId(),
        organizationId: team.organizationId,
        userId,
        role: ORG_MEMBER_ROLES.Member,
      });
    }

    const [existingTeamMember] = await this.database
      .select()
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, invitation.teamId),
        ),
      )
      .limit(1);

    if (!existingTeamMember) {
      await this.database.insert(teamSchema.teamMember).values({
        id: generateId(),
        teamId: invitation.teamId,
        userId,
        tag: invitation.tag,
      });
    }

    await this.database
      .update(teamSchema.teamInvitation)
      .set({ acceptedAt: new Date() })
      .where(eq(teamSchema.teamInvitation.token, token));

    void this.notificationsService
      .notifyUserOfTeamInvite(userId, team.id, team.name)
      .catch(() => undefined);

    return { organizationId: team.organizationId, teamId: team.id };
  }
}
