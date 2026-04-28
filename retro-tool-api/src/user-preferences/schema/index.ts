import { pgTable, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';

export const userNotificationPreference = pgTable(
  'user_notification_preference',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    emailVerificationReminders: boolean('email_verification_reminders')
      .notNull()
      .default(true),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
);

// Type definitions
export type UserNotificationPreference =
  typeof userNotificationPreference.$inferSelect;
export type NewUserNotificationPreference =
  typeof userNotificationPreference.$inferInsert;
