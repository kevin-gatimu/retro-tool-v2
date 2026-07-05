import {
  pgTable,
  boolean,
  date,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { team } from '../../teams/schema';
import { STANDUP_CADENCES } from '../../common/enums';
import { standupCadenceEnum } from '../../common/schema-enums';

// ============================================================================
// Standup (per-team configuration: cadence, schedule, questions)
// ============================================================================

export const standup = pgTable(
  'standup',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    teamId: varchar('team_id', { length: 255 })
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    cadence: standupCadenceEnum('cadence')
      .notNull()
      .default(STANDUP_CADENCES.Daily),
    // Comma-separated schedule days, e.g. 'MON,TUE,WED,THU,FRI'.
    scheduleDays: varchar('schedule_days', { length: 50 })
      .notNull()
      .default('MON,TUE,WED,THU,FRI'),
    isActive: boolean('is_active').notNull().default(true),
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
  },
  (table) => [
    index('standup_team_id_idx').on(table.teamId),
    index('standup_created_by_id_idx').on(table.createdById),
    index('standup_team_active_idx').on(table.teamId, table.isActive),
  ],
);

export const standupQuestion = pgTable(
  'standup_question',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    standupId: varchar('standup_id', { length: 255 })
      .notNull()
      .references(() => standup.id, { onDelete: 'cascade' }),
    prompt: varchar('prompt', { length: 500 }).notNull(),
    // Accent color shown as the answer's left border, e.g. '#8b5cf6'.
    color: varchar('color', { length: 7 }),
    order: integer('order').notNull().default(0),
    isRequired: boolean('is_required').notNull().default(true),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('standup_question_standup_id_idx').on(table.standupId)],
);

// ============================================================================
// Standup Entry (the persistent daily room, lazily created per date)
// ============================================================================

export const standupEntry = pgTable(
  'standup_entry',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    standupId: varchar('standup_id', { length: 255 })
      .notNull()
      .references(() => standup.id, { onDelete: 'cascade' }),
    // Calendar date of the room (no time component).
    entryDate: date('entry_date').notNull(),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('standup_entry_standup_id_idx').on(table.standupId),
    uniqueIndex('standup_entry_standup_date_unique').on(
      table.standupId,
      table.entryDate,
    ),
  ],
);

// ============================================================================
// Submissions & Answers
// ============================================================================

export const standupSubmission = pgTable(
  'standup_submission',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    entryId: varchar('entry_id', { length: 255 })
      .notNull()
      .references(() => standupEntry.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('standup_submission_entry_id_idx').on(table.entryId),
    index('standup_submission_user_id_idx').on(table.userId),
    uniqueIndex('standup_submission_entry_user_unique').on(
      table.entryId,
      table.userId,
    ),
  ],
);

export const standupAnswer = pgTable(
  'standup_answer',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    submissionId: varchar('submission_id', { length: 255 })
      .notNull()
      .references(() => standupSubmission.id, { onDelete: 'cascade' }),
    questionId: varchar('question_id', { length: 255 })
      .notNull()
      .references(() => standupQuestion.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
  },
  (table) => [
    index('standup_answer_submission_id_idx').on(table.submissionId),
    uniqueIndex('standup_answer_submission_question_unique').on(
      table.submissionId,
      table.questionId,
    ),
  ],
);

// ============================================================================
// Comments & Reactions on submissions
// ============================================================================

export const standupComment = pgTable(
  'standup_comment',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    submissionId: varchar('submission_id', { length: 255 })
      .notNull()
      .references(() => standupSubmission.id, { onDelete: 'cascade' }),
    authorId: varchar('author_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('standup_comment_submission_id_idx').on(table.submissionId),
    index('standup_comment_author_id_idx').on(table.authorId),
  ],
);

export const standupReaction = pgTable(
  'standup_reaction',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    submissionId: varchar('submission_id', { length: 255 })
      .notNull()
      .references(() => standupSubmission.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    emoji: varchar('emoji', { length: 50 }).notNull(),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('standup_reaction_submission_id_idx').on(table.submissionId),
    uniqueIndex('standup_reaction_submission_user_emoji_unique').on(
      table.submissionId,
      table.userId,
      table.emoji,
    ),
  ],
);

// ============================================================================
// Type definitions
// ============================================================================

export type Standup = typeof standup.$inferSelect;
export type NewStandup = typeof standup.$inferInsert;

export type StandupQuestion = typeof standupQuestion.$inferSelect;
export type NewStandupQuestion = typeof standupQuestion.$inferInsert;

export type StandupEntry = typeof standupEntry.$inferSelect;
export type NewStandupEntry = typeof standupEntry.$inferInsert;

export type StandupSubmission = typeof standupSubmission.$inferSelect;
export type NewStandupSubmission = typeof standupSubmission.$inferInsert;

export type StandupAnswer = typeof standupAnswer.$inferSelect;
export type NewStandupAnswer = typeof standupAnswer.$inferInsert;

export type StandupComment = typeof standupComment.$inferSelect;
export type NewStandupComment = typeof standupComment.$inferInsert;

export type StandupReaction = typeof standupReaction.$inferSelect;
export type NewStandupReaction = typeof standupReaction.$inferInsert;
