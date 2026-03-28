import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import type { Notification } from './schema';

function isConvexFunctionResponse(
  value: unknown,
): value is ConvexFunctionResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    status?: unknown;
    errorMessage?: unknown;
  };

  const hasValidStatus =
    candidate.status === 'success' || candidate.status === 'error';
  const hasValidErrorMessage =
    candidate.errorMessage === undefined ||
    typeof candidate.errorMessage === 'string';

  return hasValidStatus && hasValidErrorMessage;
}

@Injectable()
export class NotificationsProjectionSyncService {
  private readonly logger = new Logger(NotificationsProjectionSyncService.name);

  constructor(private readonly configService: ConfigService<Config, true>) {}

  async syncNotificationProjection(notification: Notification): Promise<void> {
    await this.runMutation('liveNotifications:upsertNotificationProjection', {
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link ?? undefined,
      read: notification.read,
      createdAt: notification.createdAt.getTime(),
      updatedAt: notification.createdAt.getTime(),
    });
  }

  async syncNotificationReadState(
    userId: string,
    notificationId: string,
    read: boolean,
  ): Promise<void> {
    await this.runMutation('liveNotifications:markNotificationReadProjection', {
      notificationId,
      userId,
      read,
      updatedAt: Date.now(),
    });
  }

  async syncAllNotificationsRead(userId: string): Promise<void> {
    await this.runMutation(
      'liveNotifications:markAllNotificationsReadProjection',
      {
        userId,
        updatedAt: Date.now(),
      },
    );
  }

  private async runMutation(path: string, args: object): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    try {
      const response = await fetch(
        `${convexConfig.url.replace(/\/$/, '')}/api/mutation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Convex ${convexConfig.adminKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path,
            args,
            format: 'json',
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Convex notification projection mutation ${path} failed with status ${response.status}`,
        );
        return;
      }

      const parsed: unknown = await response.json();
      if (!isConvexFunctionResponse(parsed)) {
        this.logger.warn(
          `Convex notification projection mutation ${path} returned an unexpected response payload`,
        );
        return;
      }

      const result = parsed;
      if (result.status === 'error') {
        this.logger.warn(
          `Convex notification projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Convex notification projection mutation ${path} failed: ${message}`,
      );
    }
  }
}
