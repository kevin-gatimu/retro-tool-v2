import {
  pgTable,
  boolean,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { notificationTypeEnum } from '../../common/schema-enums';

// ============================================================================
// Notification Table
// ============================================================================

export const notification = pgTable('notification', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  link: varchar('link', { length: 2048 }),
  read: boolean('read').notNull().default(false),
  metadata: text('metadata'), // JSON string
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// Push Subscription Table
// ============================================================================

export const pushSubscription = pgTable('push_subscription', {
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
});

// ============================================================================
// Type definitions
// ============================================================================

export type Notification = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;
export type PushSubscriptionRecord = typeof pushSubscription.$inferSelect;
export type NewPushSubscriptionRecord = typeof pushSubscription.$inferInsert;
