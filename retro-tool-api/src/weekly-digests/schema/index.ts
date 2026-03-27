import {
  pgTable,
  timestamp,
  boolean,
  varchar,
  integer,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { team } from '../../teams/schema';

export const weeklyDigest = pgTable('weekly_digest', {
  id: varchar('id', { length: 255 }).primaryKey(),
  teamId: varchar('team_id', { length: 255 })
    .notNull()
    .references(() => team.id, { onDelete: 'cascade' }),
  createdById: varchar('created_by_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull().default(1), // 0=Sun, 1=Mon ... 6=Sat
  hourOfDay: integer('hour_of_day').notNull().default(9),
  timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),
  includeMetrics: boolean('include_metrics').notNull().default(true),
  includeActionItems: boolean('include_action_items').notNull().default(true),
  includeUpcomingRetros: boolean('include_upcoming_retros')
    .notNull()
    .default(true),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

export type WeeklyDigest = typeof weeklyDigest.$inferSelect;
export type NewWeeklyDigest = typeof weeklyDigest.$inferInsert;
