import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import type { UiPreferences } from '../types';

// NOTE: Despite the table name, this row also stores per-user UI preferences
// (the `ui_preferences` jsonb blob) in addition to notification settings.
// A clean rename is a separate refactor — not part of the Team Spaces feature.
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
    // Flexible blob for remembered UI settings (Team Spaces views, etc.).
    // Adding new UI preferences never requires a migration.
    uiPreferences: jsonb('ui_preferences')
      .$type<UiPreferences>()
      .notNull()
      .default({}),
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
