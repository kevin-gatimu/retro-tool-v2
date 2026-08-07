import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, or, and, ne } from 'drizzle-orm';
import * as notificationSchema from './schema';
import * as authSchema from '../auth/schema';
import * as teamSchema from '../teams/schema';
import { Notification, NewNotification } from './schema';
import { PushService } from './push.service';
import { NotificationsProjectionSyncService } from './notifications-projection-sync.service';
import {
  NOTIFICATION_TYPES,
  TEAM_MEMBER_TAGS,
  USER_ROLES,
} from '../common/enums';
import { generateId } from '../lib/utils';

type Database = NodePgDatabase<
  typeof notificationSchema & typeof authSchema & typeof teamSchema
>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly pushService: PushService,
    private readonly notificationsProjectionSyncService: NotificationsProjectionSyncService,
  ) {}

  async getNotifications(userId: string): Promise<Notification[]> {
    const notifications = await this.database
      .select()
      .from(notificationSchema.notification)
      .where(eq(notificationSchema.notification.userId, userId))
      .orderBy(desc(notificationSchema.notification.createdAt))
      .limit(50);
    return notifications;
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const all = await this.database
      .select({ read: notificationSchema.notification.read })
      .from(notificationSchema.notification)
      .where(eq(notificationSchema.notification.userId, userId));

    return { count: all.filter((n) => !n.read).length };
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<{ success: boolean }> {
    const [existing] = await this.database
      .select()
      .from(notificationSchema.notification)
      .where(eq(notificationSchema.notification.id, notificationId))
      .limit(1);

    if (!existing) throw new NotFoundException('Notification not found');
    if (existing.userId !== userId)
      throw new ForbiddenException('Access denied');

    await this.database
      .update(notificationSchema.notification)
      .set({ read: true })
      .where(eq(notificationSchema.notification.id, notificationId));

    void this.notificationsProjectionSyncService
      .enqueueReadState(userId, notificationId, true)
      .catch(() => undefined);

    return { success: true };
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean }> {
    await this.database
      .update(notificationSchema.notification)
      .set({ read: true })
      .where(eq(notificationSchema.notification.userId, userId));

    void this.notificationsProjectionSyncService
      .enqueueAllRead(userId)
      .catch(() => undefined);

    return { success: true };
  }

  async createAndEmit(
    data: Omit<NewNotification, 'id'>,
  ): Promise<Notification> {
    const id = generateId();
    const [created] = await this.database
      .insert(notificationSchema.notification)
      .values({ id, ...data })
      .returning();

    void this.notificationsProjectionSyncService
      .enqueueNotificationSync(created.id)
      .catch(() => undefined);

    // Also send a browser push notification (fire-and-forget, non-blocking)
    void this.pushService
      .sendPush(data.userId, {
        title: data.title,
        body: data.message,
        url: data.link ?? undefined,
      })
      .catch((err: unknown) =>
        this.logger.error(
          `Push send failed for user ${data.userId}: ${(err as Error)?.message}`,
        ),
      );

    return created;
  }

  // ============================================================================
  // Domain notification helpers
  // ============================================================================

  async notifyAdminsOfSignup(
    newUserId: string,
    newUserName: string,
  ): Promise<void> {
    const admins = await this.database
      .select({ id: authSchema.user.id })
      .from(authSchema.user)
      .where(
        or(
          eq(authSchema.user.role, USER_ROLES.SuperAdmin),
          eq(authSchema.user.role, USER_ROLES.SystemAdmin),
        ),
      );

    await Promise.all(
      admins.map((admin) =>
        this.createAndEmit({
          userId: admin.id,
          type: NOTIFICATION_TYPES.UserSignup,
          title: 'New user registered',
          message: `${newUserName} has signed up and is awaiting approval.`,
          link: `/admin/users/${newUserId}`,
        }),
      ),
    );
  }

  async notifyTeamOfEstimateSession(
    sessionId: string,
    sessionName: string,
    teamId: string,
  ): Promise<void> {
    const members = await this.database
      .select({ userId: teamSchema.teamMember.userId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));

    await Promise.all(
      members.map((m) =>
        this.createAndEmit({
          userId: m.userId,
          type: NOTIFICATION_TYPES.EstimateSessionCreated,
          title: 'New estimation session',
          message: `A new story estimate session "${sessionName}" has started.`,
          link: `/estimate/${sessionId}`,
        }),
      ),
    );
  }

  async notifyTeamOfIcebreakerSession(
    sessionId: string,
    sessionName: string,
    teamId: string,
  ): Promise<void> {
    const members = await this.database
      .select({ userId: teamSchema.teamMember.userId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));

    await Promise.all(
      members.map((m) =>
        this.createAndEmit({
          userId: m.userId,
          type: NOTIFICATION_TYPES.IcebreakerSessionCreated,
          title: 'New icebreaker session',
          message: `A new icebreaker session "${sessionName}" has started.`,
          link: `/icebreakers/${sessionId}`,
        }),
      ),
    );
  }

  async notifyTeamOfRetroLobbyOpen(
    retroId: string,
    retroName: string,
    teamId: string,
    autoStartsAt: Date,
  ): Promise<void> {
    const members = await this.database
      .select({ userId: teamSchema.teamMember.userId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));

    const autoStartTime = autoStartsAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    await Promise.all(
      members.map((m) =>
        this.createAndEmit({
          userId: m.userId,
          type: NOTIFICATION_TYPES.RetroLobbyOpen,
          title: 'Retro lobby is open',
          message: `"${retroName}" lobby is open! Auto-starts at ${autoStartTime}. Join now to be ready.`,
          link: `/retros/${retroId}`,
        }),
      ),
    );
  }

  async notifyTeamOfRetroStarted(
    retroId: string,
    retroName: string,
    teamId: string,
  ): Promise<void> {
    const members = await this.database
      .select({ userId: teamSchema.teamMember.userId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));

    await Promise.all(
      members.map((m) =>
        this.createAndEmit({
          userId: m.userId,
          type: NOTIFICATION_TYPES.RetroStarted,
          title: 'Retrospective started',
          message: `"${retroName}" is now active — add your cards!`,
          link: `/retros/${retroId}`,
        }),
      ),
    );
  }

  async notifyTeamOfRetroCreated(
    retroId: string,
    retroName: string,
    teamId: string,
    creatorUserId: string,
  ): Promise<void> {
    const members = await this.database
      .select({ userId: teamSchema.teamMember.userId })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, teamId),
          ne(teamSchema.teamMember.userId, creatorUserId),
        ),
      );

    if (members.length === 0) {
      this.logger.warn(
        `No recipients found for retro-created notification (retroId=${retroId}, teamId=${teamId})`,
      );
      return;
    }

    const results = await Promise.allSettled(
      members.map((member) =>
        this.createAndEmit({
          userId: member.userId,
          type: NOTIFICATION_TYPES.RetroCreated,
          title: 'New retrospective created',
          message: `"${retroName}" is available for your team.`,
          link: `/retros/${retroId}`,
        }),
      ),
    );

    const failedCount = results.filter(
      (result) => result.status === 'rejected',
    ).length;

    if (failedCount > 0) {
      this.logger.warn(
        `Retro-created notification partially failed (retroId=${retroId}, teamId=${teamId}, failures=${failedCount}, total=${results.length})`,
      );
    }
  }

  async notifyTeamAdminsOfJoinRequest(
    teamId: string,
    teamName: string,
    requesterId: string,
    requesterName: string,
  ): Promise<void> {
    const admins = await this.database
      .select({ userId: teamSchema.teamMember.userId })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, teamId),
          eq(teamSchema.teamMember.tag, TEAM_MEMBER_TAGS.Lead),
        ),
      );

    await Promise.all(
      admins
        .filter((a) => a.userId !== requesterId)
        .map((a) =>
          this.createAndEmit({
            userId: a.userId,
            type: NOTIFICATION_TYPES.TeamJoinRequest,
            title: 'New join request',
            message: `${requesterName} wants to join "${teamName}".`,
            link: `/teams/${teamId}`,
          }),
        ),
    );
  }

  async notifyUserOfJoinApproval(
    userId: string,
    teamId: string,
    teamName: string,
  ): Promise<void> {
    await this.createAndEmit({
      userId,
      type: NOTIFICATION_TYPES.TeamJoinApproved,
      title: 'Join request approved',
      message: `Your request to join "${teamName}" has been approved.`,
      link: `/teams/${teamId}`,
    });
  }

  async notifyUserOfJoinRejection(
    userId: string,
    teamName: string,
  ): Promise<void> {
    await this.createAndEmit({
      userId,
      type: NOTIFICATION_TYPES.TeamJoinRejected,
      title: 'Join request declined',
      message: `Your request to join "${teamName}" was not approved.`,
      link: null,
    });
  }

  async notifyUserOfOrgInvite(
    userId: string,
    orgId: string,
    orgName: string,
  ): Promise<void> {
    await this.createAndEmit({
      userId,
      type: NOTIFICATION_TYPES.OrgInvite,
      title: 'Organisation invitation',
      message: `You have been invited to join "${orgName}".`,
      link: `/organizations/${orgId}`,
    });
  }

  async notifyUserOfTeamInvite(
    userId: string,
    teamId: string,
    teamName: string,
  ): Promise<void> {
    await this.createAndEmit({
      userId,
      type: NOTIFICATION_TYPES.TeamInvite,
      title: 'Team invitation',
      message: `You have been added to the team "${teamName}".`,
      link: `/teams/${teamId}`,
    });
  }

  async notifySuperAdminsOfTableClear(
    clearedTables: string[],
    failed?: string,
  ): Promise<void> {
    const superAdmins = await this.database
      .select({ id: authSchema.user.id })
      .from(authSchema.user)
      .where(eq(authSchema.user.role, USER_ROLES.SuperAdmin));

    const isFailure = !!failed;
    const title = isFailure
      ? 'Scheduled Convex cleanup failed'
      : 'Scheduled Convex cleanup completed';
    const message = isFailure
      ? `The scheduled Convex table cleanup failed: ${failed}`
      : `Cleared tables: ${clearedTables.join(', ')}.`;

    await Promise.all(
      superAdmins.map((admin) =>
        this.createAndEmit({
          userId: admin.id,
          type: NOTIFICATION_TYPES.ConvexTableClear,
          title,
          message,
          link: '/admin/convex',
        }),
      ),
    );
  }
}
