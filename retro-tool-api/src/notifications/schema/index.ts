import {
  pgTable,
  boolean,
  index,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { notificationTypeEnum } from '../../common/schema-enums';

// ============================================================================
// Notification Table
// ============================================================================

export const notification = pgTable(
  'notification',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    link: varchar('link', { length: 2048 }),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('notification_user_id_idx').on(table.userId),
    index('notification_user_read_idx').on(table.userId, table.read),
    index('notification_user_created_at_idx').on(table.userId, table.createdAt),
    index('notification_created_at_idx').on(table.createdAt),
  ],
);

// ============================================================================
// Push Subscription Table
// ============================================================================

export const pushSubscription = pgTable(
  'push_subscription',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('push_subscription_user_id_idx').on(table.userId),
    uniqueIndex('push_subscription_endpoint_unique').on(table.endpoint),
  ],
);

// ============================================================================
// Type definitions
// ============================================================================

export type Notification = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;
export type PushSubscriptionRecord = typeof pushSubscription.$inferSelect;
export type NewPushSubscriptionRecord = typeof pushSubscription.$inferInsert;
