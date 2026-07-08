import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as notificationSchema from './schema';
import { pushSubscription as pushSubscriptionTable } from './schema';
import * as authSchema from '../auth/schema';
import * as webpush from 'web-push';
import { generateId } from '../lib/utils';

type Database = NodePgDatabase<typeof notificationSchema & typeof authSchema>;

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;
  // Origin of this environment's UI, used to turn relative notification links
  // (e.g. `/estimate/123`) into absolute deep links. Without this the service
  // worker resolves the relative path against whichever origin owns the push
  // subscription, which can send users to the wrong environment.
  private readonly frontendUrl: string;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? ''
    ).replace(/\/+$/, '');

    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const vapidSubject = this.configService.get<string>('VAPID_SUBJECT');

    if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
      try {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        this.enabled = true;
      } catch (err) {
        this.enabled = false;
        this.logger.error(
          `Invalid VAPID keys — browser push notifications are disabled. ` +
            `Re-generate with: npx web-push generate-vapid-keys. (${(err as Error).message})`,
        );
      }
    } else {
      this.enabled = false;
      this.logger.warn(
        'VAPID keys not configured — browser push notifications are disabled. ' +
          'Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT env vars.',
      );
    }
  }

  async subscribe(
    userId: string,
    subscription: { endpoint: string; p256dh: string; auth: string },
  ): Promise<{ success: boolean }> {
    const [existing] = await this.database
      .select({ id: pushSubscriptionTable.id })
      .from(pushSubscriptionTable)
      .where(eq(pushSubscriptionTable.userId, userId))
      .limit(1);

    if (existing) {
      await this.database
        .update(pushSubscriptionTable)
        .set({
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        })
        .where(eq(pushSubscriptionTable.id, existing.id));
    } else {
      await this.database.insert(pushSubscriptionTable).values({
        id: generateId(),
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      });
    }

    return { success: true };
  }

  async unsubscribe(userId: string): Promise<{ success: boolean }> {
    await this.database
      .delete(pushSubscriptionTable)
      .where(eq(pushSubscriptionTable.userId, userId));
    return { success: true };
  }

  // Resolve a notification link to an absolute URL for this environment's UI so
  // the service worker opens the correct origin. Relative links (`/estimate/1`)
  // are joined onto FRONTEND_URL; absolute links are passed through unchanged.
  private resolveDeepLink(url?: string): string | undefined {
    if (!url) return undefined;
    if (/^https?:\/\//i.test(url)) return url;
    if (!this.frontendUrl) return url;
    return `${this.frontendUrl}/${url.replace(/^\/+/, '')}`;
  }

  async sendPush(
    userId: string,
    payload: { title: string; body: string; url?: string },
  ): Promise<void> {
    if (!this.enabled) return;

    const subscriptions: Array<typeof pushSubscriptionTable.$inferSelect> =
      await this.database
        .select()
        .from(pushSubscriptionTable)
        .where(eq(pushSubscriptionTable.userId, userId));

    const deliveredPayload = JSON.stringify({
      ...payload,
      url: this.resolveDeepLink(payload.url),
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        const endpoint: string = sub.endpoint;
        const p256dh: string = sub.p256dh;
        const auth: string = sub.auth;
        try {
          await webpush.sendNotification(
            { endpoint, keys: { p256dh, auth } },
            deliveredPayload,
            { urgency: 'high', TTL: 60 },
          );
        } catch (err: unknown) {
          // 410 Gone = subscription expired, remove it
          if ((err as { statusCode?: number })?.statusCode === 410) {
            await this.database
              .delete(pushSubscriptionTable)
              .where(
                and(
                  eq(pushSubscriptionTable.userId, userId),
                  eq(pushSubscriptionTable.endpoint, endpoint),
                ),
              );
          } else {
            this.logger.warn(
              `Failed to send push to ${endpoint}: ${(err as Error)?.message}`,
            );
          }
        }
      }),
    );
  }
}
