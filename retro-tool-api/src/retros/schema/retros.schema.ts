import {
  pgTable,
  text,
  timestamp,
  boolean,
  varchar,
  integer,
  unique,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { team } from '../../teams/schema';
import { organization } from '../../organizations/schema';
import { RETRO_STATUSES, RETRO_VOTE_TYPES } from '../../common/enums';
import { retroStatusEnum, retroVoteTypeEnum } from '../../common/schema-enums';

// ============================================================================
// Template Tables
// ============================================================================

export const template = pgTable('template', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isBuiltIn: boolean('is_built_in').notNull().default(false),
  organizationId: varchar('organization_id', { length: 255 }).references(
    () => organization.id,
    { onDelete: 'cascade' },
  ),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

export const templateColumn = pgTable('template_column', {
  id: varchar('id', { length: 255 }).primaryKey(),
  templateId: varchar('template_id', { length: 255 })
    .notNull()
    .references(() => template.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  emoji: varchar('emoji', { length: 100 }),
  prompt: text('prompt'),
  order: integer('order').notNull().default(0),
});

// ============================================================================
// Retrospective Tables
// ============================================================================

export const retrospective = pgTable('retrospective', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  teamId: varchar('team_id', { length: 255 })
    .notNull()
    .references(() => team.id, { onDelete: 'cascade' }),
  templateId: varchar('template_id', { length: 255 })
    .notNull()
    .references(() => template.id),
  status: retroStatusEnum('status').notNull().default(RETRO_STATUSES.Draft),
  isAnonymous: boolean('is_anonymous').notNull().default(true),
  maxVotesPerUser: integer('max_votes_per_user').notNull().default(3),
  voteType: retroVoteTypeEnum('vote_type')
    .notNull()
    .default(RETRO_VOTE_TYPES.Multi),
  timerDuration: integer('timer_duration'),
  timerStartedAt: timestamp('timer_started_at'),
  timerEndsAt: timestamp('timer_ends_at'),
  createdById: varchar('created_by_id', { length: 255 }).references(
    () => user.id,
    { onDelete: 'set null' },
  ),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: timestamp('completed_at'),
  scheduledAt: timestamp('scheduled_at'),
  reminderSentAt: timestamp('reminder_sent_at'),
  lobbyStartedAt: timestamp('lobby_started_at'),
  lobbyAutoStartsAt: timestamp('lobby_auto_starts_at'),
  currentDiscussionCardId: varchar('current_discussion_card_id', {
    length: 255,
  }),
  currentDiscussionActionItemId: varchar('current_discussion_action_item_id', {
    length: 255,
  }),
});

export const retroParticipant = pgTable(
  'retro_participant',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    retroId: varchar('retro_id', { length: 255 })
      .notNull()
      .references(() => retrospective.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique('retro_participant_retro_user_unique').on(
      table.retroId,
      table.userId,
    ),
  ],
);

// ============================================================================
// Type definitions
// ============================================================================

export type Template = typeof template.$inferSelect;
export type NewTemplate = typeof template.$inferInsert;

export type TemplateColumn = typeof templateColumn.$inferSelect;
export type NewTemplateColumn = typeof templateColumn.$inferInsert;

export type Retrospective = typeof retrospective.$inferSelect;
export type NewRetrospective = typeof retrospective.$inferInsert;

export type RetroParticipant = typeof retroParticipant.$inferSelect;
export type NewRetroParticipant = typeof retroParticipant.$inferInsert;
