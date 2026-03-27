import {
  pgTable,
  text,
  timestamp,
  boolean,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { team } from '../../teams/schema';
import { retrospective } from '../../retros/schema';
import { retroReminderTypeEnum } from '../../common/schema-enums';

export const retroReminder = pgTable('retro_reminder', {
  id: varchar('id', { length: 255 }).primaryKey(),
  teamId: varchar('team_id', { length: 255 })
    .notNull()
    .references(() => team.id, { onDelete: 'cascade' }),
  retroId: varchar('retro_id', { length: 255 }).references(
    () => retrospective.id,
    { onDelete: 'set null' },
  ),
  createdById: varchar('created_by_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: retroReminderTypeEnum('type').notNull(),
  schedule: varchar('schedule', { length: 255 }).notNull(),
  message: text('message'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

export type RetroReminder = typeof retroReminder.$inferSelect;
export type NewRetroReminder = typeof retroReminder.$inferInsert;
