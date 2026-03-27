import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  integer,
} from 'drizzle-orm/pg-core';
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
    weeklyDigestEnabled: boolean('weekly_digest_enabled')
      .notNull()
      .default(true),
    weeklyDigestDay: varchar('weekly_digest_day', { length: 50 })
      .notNull()
      .default('monday'),
    retrospectiveRemindersEnabled: boolean('retrospective_reminders_enabled')
      .notNull()
      .default(true),
    retrospectiveReminderHours: integer('retrospective_reminder_hours')
      .notNull()
      .default(24),
    teamActivityEmailsEnabled: boolean('team_activity_emails_enabled')
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
