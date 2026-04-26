import {
  boolean,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';

/**
 * Singleton config row for the admin-triggered Convex table-clear cron job.
 * Only one row exists with id = 'singleton'.
 */
export const convexCronConfig = pgTable('convex_cron_config', {
  id: varchar('id', { length: 36 }).primaryKey().default('singleton'),
  schedule: varchar('schedule', { length: 100 }).notNull().default('0 0 * * 0'),
  enabled: boolean('enabled').notNull().default(false),
  tablesToClear: jsonb('tables_to_clear')
    .notNull()
    .$type<string[]>()
    .default([]),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedByUserId: varchar('updated_by_user_id', { length: 255 }).references(
    () => user.id,
    { onDelete: 'set null' },
  ),
});

export type ConvexCronConfig = typeof convexCronConfig.$inferSelect;
export type NewConvexCronConfig = typeof convexCronConfig.$inferInsert;
