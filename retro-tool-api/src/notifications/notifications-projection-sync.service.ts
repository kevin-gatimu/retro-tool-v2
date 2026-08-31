import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { ConvexMutationClientService } from '../convex-admin/convex-mutation-client.service';
import { ProjectionOutboxService } from '../convex-admin/projection-outbox.service';
import * as notificationSchema from './schema';
import type { Notification } from './schema';

type Database = NodePgDatabase<typeof notificationSchema>;

const PROJECTION = 'notifications';

// How many most-recent notifications to project PER USER per reconciliation.
// Mirrors the UI contract (`getNotifications` returns the latest 50 for the
// caller), so each user's projection holds the same window the client can
// display. This is per-user, not global: a global limit would prune every
// user's older-but-still-shown notifications after each reconcile.
const RECONCILE_NOTIFICATION_LIMIT = 50;

@Injectable()
export class NotificationsProjectionSyncService implements OnModuleInit {
  constructor(
    private readonly convexClient: ConvexMutationClientService,
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly outbox: ProjectionOutboxService,
  ) {}

  onModuleInit(): void {
    // Deliver notification intents. The concrete action lives in the payload
    // because a notification has three projected changes (upsert, mark-one-read,
    // mark-all-read) that all map to the outbox 'sync' operation.
    this.outbox.registerHandler(
      PROJECTION,
      async (operation, entityKey, payload) => {
        if (operation === 'delete') {
          // Notifications are not individually deleted from the projection
          // today; they age out of the window and are swept by reconciliation.
          return;
        }
        const action =
          typeof payload?.action === 'string' ? payload.action : 'upsert';
        if (action === 'markRead') {
          const userId =
            typeof payload?.userId === 'string' ? payload.userId : '';
          await this.deliverReadState(
            userId,
            entityKey,
            payload?.read === true,
          );
          return;
        }
        if (action === 'markAllRead') {
          await this.deliverAllRead(entityKey);
          return;
        }
        await this.deliverUpsert(entityKey);
      },
    );
  }

  /** Durably enqueue projection of a newly created/updated notification. */
  async enqueueNotificationSync(notificationId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'sync',
      entityKey: notificationId,
      payload: { action: 'upsert' },
    });
  }

  /** Durably enqueue a single notification's read-state change. */
  async enqueueReadState(
    userId: string,
    notificationId: string,
    read: boolean,
  ): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'sync',
      entityKey: notificationId,
      payload: { action: 'markRead', userId, read },
    });
  }

  /** Durably enqueue "mark all read" for a user (entityKey is the userId). */
  async enqueueAllRead(userId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'sync',
      entityKey: userId,
      payload: { action: 'markAllRead' },
    });
  }

  /**
   * Deliver an upsert by re-reading the notification from PostgreSQL (the
   * source row may have changed between enqueue and delivery). No-ops if the
   * notification no longer exists.
   */
  private async deliverUpsert(notificationId: string): Promise<void> {
    const [row] = await this.database
      .select()
      .from(notificationSchema.notification)
      .where(eq(notificationSchema.notification.id, notificationId))
      .limit(1);
    if (!row) {
      return;
    }
    await this.syncNotificationProjection(row);
  }

  private async deliverReadState(
    userId: string,
    notificationId: string,
    read: boolean,
  ): Promise<void> {
    await this.syncNotificationReadState(userId, notificationId, read);
  }

  private async deliverAllRead(userId: string): Promise<void> {
    await this.syncAllNotificationsRead(userId);
  }

  async syncNotificationProjection(notification: Notification): Promise<void> {
    await this.convexClient.runMutation(
      'liveNotifications:upsertNotificationProjection',
      {
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link ?? undefined,
        read: notification.read,
        createdAt: notification.createdAt.getTime(),
        updatedAt: notification.createdAt.getTime(),
      },
    );
  }

  async syncNotificationReadState(
    userId: string,
    notificationId: string,
    read: boolean,
  ): Promise<void> {
    await this.convexClient.runMutation(
      'liveNotifications:markNotificationReadProjection',
      {
        notificationId,
        userId,
        read,
        updatedAt: Date.now(),
      },
    );
  }

  async syncAllNotificationsRead(userId: string): Promise<void> {
    await this.convexClient.runMutation(
      'liveNotifications:markAllNotificationsReadProjection',
      {
        userId,
        updatedAt: Date.now(),
      },
    );
  }

  /**
   * Rebuild the notification projection from PostgreSQL for the reconciliation
   * flow. Projects the most-recent {@link RECONCILE_NOTIFICATION_LIMIT}
   * notifications (the window the UI can display) and stamps each with a single
   * `reconcileAt` timestamp so the orchestrator's mark-and-sweep can prune
   * projections whose source row is gone or has aged out of the window.
   *
   * Note: unlike {@link syncNotificationProjection} (which stamps `updatedAt`
   * with the notification's own `createdAt`), this passes a monotonic
   * `reconcileAt` as `updatedAt` — the sweep prunes rows older than a timestamp
   * captured before this pass, so freshly reprojected rows must carry it.
   * Returns the number of notifications scanned. No-ops when Convex is unset.
   */
  async syncAllNotifications(): Promise<{ scanned: number }> {
    if (!this.convexClient.isConfigured()) {
      return { scanned: 0 };
    }

    // Reproject the most-recent N notifications PER USER. A single global
    // `.limit(N)` would only reproject the newest N across all users, so the
    // orchestrator's `updatedAt < reconcileAt` sweep would delete every other
    // user's projections — silently breaking their realtime notifications.
    const users = await this.database
      .selectDistinct({ userId: notificationSchema.notification.userId })
      .from(notificationSchema.notification);

    const reconcileAt = Date.now();
    let scanned = 0;

    for (const { userId } of users) {
      const rows = await this.database
        .select()
        .from(notificationSchema.notification)
        .where(eq(notificationSchema.notification.userId, userId))
        .orderBy(desc(notificationSchema.notification.createdAt))
        .limit(RECONCILE_NOTIFICATION_LIMIT);

      for (const row of rows) {
        await this.convexClient.runMutation(
          'liveNotifications:upsertNotificationProjection',
          {
            notificationId: row.id,
            userId: row.userId,
            type: row.type,
            title: row.title,
            message: row.message,
            link: row.link ?? undefined,
            read: row.read,
            createdAt: row.createdAt.getTime(),
            updatedAt: reconcileAt,
          },
        );
        scanned += 1;
      }
    }

    return { scanned };
  }
}
