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
import * as orgSchema from '../schema';
import * as userSchema from '../../auth/schema';
import { generateId } from '../../lib/utils';
import { CommonService } from '../../common/common.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  EMAIL_LOG_TYPES,
  ORG_MEMBER_ROLES,
  TOrgMemberRole,
  USER_STATUSES,
} from '../../common/enums';

@Injectable()
export class OrgInvitationsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase<
      typeof orgSchema & typeof userSchema
    >,
    private readonly commonService: CommonService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<Config>,
  ) {}

  async inviteOrganizationMember(
    userId: string,
    orgId: string,
    email: string,
    role: TOrgMemberRole,
  ) {
    const isAdmin = await this.commonService.isSystemAdmin(userId);
    const isOrgAdmin = await this.commonService.isOrgAdmin(userId, orgId);

    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only system admins and organization admins can invite members',
      );
    }

    if (role === ORG_MEMBER_ROLES.Owner) {
      const isOwner = await this.commonService.isOrgOwner(userId, orgId);
      if (!isAdmin && !isOwner) {
        throw new ForbiddenException(
          'Only system admins and the organization owner can invite users as org-owner',
        );
      }
    }

    const [org] = await this.database
      .select({ name: orgSchema.organization.name })
      .from(orgSchema.organization)
      .where(eq(orgSchema.organization.id, orgId))
      .limit(1);

    if (!org) throw new NotFoundException('Organisation not found');

    const appUrl =
      this.configService.get('frontend.url', { infer: true }) ?? '';

    const [invitee] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.email, email))
      .limit(1);

    if (invitee) {
      const [existingMember] = await this.database
        .select({ id: orgSchema.organizationMember.id })
        .from(orgSchema.organizationMember)
        .where(
          and(
            eq(orgSchema.organizationMember.organizationId, orgId),
            eq(orgSchema.organizationMember.userId, invitee.id),
          ),
        )
        .limit(1);

      if (existingMember) {
        throw new ConflictException(
          'This user is already a member of this organisation',
        );
      }
    }

    const [existingInvite] = await this.database
      .select()
      .from(orgSchema.orgInvitation)
      .where(
        and(
          eq(orgSchema.orgInvitation.email, email),
          eq(orgSchema.orgInvitation.organizationId, orgId),
        ),
      )
      .limit(1);

    if (existingInvite && !existingInvite.acceptedAt) {
      await this.database
        .delete(orgSchema.orgInvitation)
        .where(eq(orgSchema.orgInvitation.id, existingInvite.id));
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await this.database.insert(orgSchema.orgInvitation).values({
      id: generateId(),
      token,
      email,
      organizationId: orgId,
      role,
      createdById: userId,
      expiresAt,
    });

    if (invitee) {
      void this.emailService
        .send({
          to: invitee.email,
          subject: `You've been invited to join ${org.name}`,
          html: this.emailService.buildOrgInviteHtml({
            userName: invitee.name,
            invitedEmail: email,
            orgName: org.name,
            role,
            appUrl,
            token,
          }),
          userId: invitee.id,
          type: EMAIL_LOG_TYPES.OrgInvite,
        })
        .catch(() => undefined);
    } else {
      void this.emailService
        .send({
          to: email,
          subject: `You've been invited to join ${org.name}`,
          html: this.emailService.buildOrgExternalInviteHtml({
            orgName: org.name,
            role,
            appUrl,
            token,
            invitedEmail: email,
          }),
          userId,
          type: EMAIL_LOG_TYPES.OrgInviteExternal,
        })
        .catch(() => undefined);
    }

    return { pending: true };
  }

  async checkInviteEmail(
    actorId: string,
    orgId: string,
    email: string,
  ): Promise<{ registered: boolean; name?: string; isMember?: boolean }> {
    const isAdmin = await this.commonService.isSystemAdmin(actorId);
    const isOrgAdmin = await this.commonService.isOrgAdmin(actorId, orgId);

    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only system admins and organization admins can check invite emails',
      );
    }

    const [user] = await this.database
      .select({ id: userSchema.user.id, name: userSchema.user.name })
      .from(userSchema.user)
      .where(eq(userSchema.user.email, email))
      .limit(1);

    if (!user) return { registered: false };

    const [existingMember] = await this.database
      .select({ id: orgSchema.organizationMember.id })
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.organizationId, orgId),
          eq(orgSchema.organizationMember.userId, user.id),
        ),
      )
      .limit(1);

    return {
      registered: true,
      name: user.name,
      isMember: !!existingMember,
    };
  }

  async listInvitations(
    actorId: string,
    orgId: string,
    {
      page = 1,
      limit = 10,
      search,
    }: { page?: number; limit?: number; search?: string },
  ) {
    const isAdmin = await this.commonService.isSystemAdmin(actorId);
    const isOrgAdmin = await this.commonService.isOrgAdmin(actorId, orgId);
    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException('Only admins can view invitations');
    }

    const conditions = [
      eq(orgSchema.orgInvitation.organizationId, orgId),
      isNull(orgSchema.orgInvitation.acceptedAt),
    ];
    if (search && search.length >= 2) {
      conditions.push(ilike(orgSchema.orgInvitation.email, `%${search}%`));
    }

    const where = and(...conditions);
    const offset = (page - 1) * limit;

    const [invitations, [{ total }]] = await Promise.all([
      this.database
        .select({
          id: orgSchema.orgInvitation.id,
          email: orgSchema.orgInvitation.email,
          role: orgSchema.orgInvitation.role,
          createdAt: orgSchema.orgInvitation.createdAt,
          expiresAt: orgSchema.orgInvitation.expiresAt,
          invitedByName: userSchema.user.name,
          invitedByEmail: userSchema.user.email,
          invitedById: userSchema.user.id,
        })
        .from(orgSchema.orgInvitation)
        .leftJoin(
          userSchema.user,
          eq(userSchema.user.id, orgSchema.orgInvitation.createdById),
        )
        .where(where)
        .orderBy(desc(orgSchema.orgInvitation.createdAt))
        .limit(limit)
        .offset(offset),
      this.database
        .select({ total: count() })
        .from(orgSchema.orgInvitation)
        .where(where),
    ]);

    return {
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
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

  async revokeInvitation(actorId: string, orgId: string, invitationId: string) {
    const isAdmin = await this.commonService.isSystemAdmin(actorId);
    const isOrgAdmin = await this.commonService.isOrgAdmin(actorId, orgId);
    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException('Only admins can revoke invitations');
    }

    const [invitation] = await this.database
      .select()
      .from(orgSchema.orgInvitation)
      .where(
        and(
          eq(orgSchema.orgInvitation.id, invitationId),
          eq(orgSchema.orgInvitation.organizationId, orgId),
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
      .delete(orgSchema.orgInvitation)
      .where(eq(orgSchema.orgInvitation.id, invitationId));

    return { revoked: true };
  }

  async resendInvitation(actorId: string, orgId: string, invitationId: string) {
    const isAdmin = await this.commonService.isSystemAdmin(actorId);
    const isOrgAdmin = await this.commonService.isOrgAdmin(actorId, orgId);
    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException('Only admins can resend invitations');
    }

    const [invitation] = await this.database
      .select()
      .from(orgSchema.orgInvitation)
      .where(
        and(
          eq(orgSchema.orgInvitation.id, invitationId),
          eq(orgSchema.orgInvitation.organizationId, orgId),
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
      .update(orgSchema.orgInvitation)
      .set({ token: newToken, expiresAt: newExpiresAt })
      .where(eq(orgSchema.orgInvitation.id, invitationId));

    const [org] = await this.database
      .select({ name: orgSchema.organization.name })
      .from(orgSchema.organization)
      .where(eq(orgSchema.organization.id, orgId))
      .limit(1);

    const appUrl =
      this.configService.get('frontend.url', { infer: true }) ?? '';

    const [invitee] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.email, invitation.email))
      .limit(1);

    if (invitee) {
      void this.emailService
        .send({
          to: invitee.email,
          subject: `You've been invited to join ${org?.name ?? 'an organisation'}`,
          html: this.emailService.buildOrgInviteHtml({
            userName: invitee.name,
            invitedEmail: invitation.email,
            orgName: org?.name ?? '',
            role: invitation.role as TOrgMemberRole,
            appUrl,
            token: newToken,
          }),
          userId: invitee.id,
          type: EMAIL_LOG_TYPES.OrgInvite,
        })
        .catch(() => undefined);
    } else {
      void this.emailService
        .send({
          to: invitation.email,
          subject: `You've been invited to join ${org?.name ?? 'an organisation'}`,
          html: this.emailService.buildOrgExternalInviteHtml({
            orgName: org?.name ?? '',
            role: invitation.role as TOrgMemberRole,
            appUrl,
            token: newToken,
            invitedEmail: invitation.email,
          }),
          userId: actorId,
          type: EMAIL_LOG_TYPES.OrgInviteExternal,
        })
        .catch(() => undefined);
    }

    return { resent: true };
  }

  async getOrgInvitationPreview(token: string) {
    const [invitation] = await this.database
      .select({
        email: orgSchema.orgInvitation.email,
        organizationId: orgSchema.orgInvitation.organizationId,
        orgName: orgSchema.organization.name,
        role: orgSchema.orgInvitation.role,
        expiresAt: orgSchema.orgInvitation.expiresAt,
        acceptedAt: orgSchema.orgInvitation.acceptedAt,
      })
      .from(orgSchema.orgInvitation)
      .innerJoin(
        orgSchema.organization,
        eq(orgSchema.organization.id, orgSchema.orgInvitation.organizationId),
      )
      .where(eq(orgSchema.orgInvitation.token, token))
      .limit(1);

    if (!invitation) throw new NotFoundException('Invitation not found');

    const [existingUser] = await this.database
      .select({ id: userSchema.user.id })
      .from(userSchema.user)
      .where(eq(userSchema.user.email, invitation.email))
      .limit(1);

    return {
      type: 'org' as const,
      orgName: invitation.orgName,
      role: invitation.role,
      invitedEmail: invitation.email,
      expired: invitation.expiresAt < new Date(),
      accepted: !!invitation.acceptedAt,
      isExistingUser: !!existingUser,
      orgId: invitation.organizationId,
    };
  }

  async acceptOrgInvitation(token: string, userId: string) {
    const [invitation] = await this.database
      .select()
      .from(orgSchema.orgInvitation)
      .where(eq(orgSchema.orgInvitation.token, token))
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

    const [existing] = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(
            orgSchema.organizationMember.organizationId,
            invitation.organizationId,
          ),
        ),
      )
      .limit(1);

    if (existing) {
      await this.database
        .update(orgSchema.orgInvitation)
        .set({ acceptedAt: new Date() })
        .where(eq(orgSchema.orgInvitation.token, token));
      return { organizationId: invitation.organizationId };
    }

    const [member] = await this.database
      .insert(orgSchema.organizationMember)
      .values({
        id: generateId(),
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      })
      .returning();

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

    await this.database
      .update(orgSchema.orgInvitation)
      .set({ acceptedAt: new Date() })
      .where(eq(orgSchema.orgInvitation.token, token));

    void this.notificationsService
      .notifyUserOfOrgInvite(userId, invitation.organizationId, '')
      .catch(() => undefined);

    return { organizationId: invitation.organizationId, member };
  }
}
