import {
  pgTable,
  boolean,
  date,
  index,
  integer,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { team } from '../../teams/schema';
import { standup } from '../../standups/schema';

// ============================================================================
// Poll (team-scoped; optionally attached to a standup day)
// ============================================================================

export const poll = pgTable(
  'poll',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    question: varchar('question', { length: 500 }).notNull(),
    teamId: varchar('team_id', { length: 255 })
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    // When set, the poll appears inside that standup's daily room.
    standupId: varchar('standup_id', { length: 255 }).references(
      () => standup.id,
      { onDelete: 'cascade' },
    ),
    entryDate: date('entry_date'),
    // Public polls show who voted for each option; anonymous ones show counts only.
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    isClosed: boolean('is_closed').notNull().default(false),
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
    index('poll_team_id_idx').on(table.teamId),
    index('poll_standup_id_idx').on(table.standupId),
    index('poll_standup_date_idx').on(table.standupId, table.entryDate),
    index('poll_created_by_id_idx').on(table.createdById),
  ],
);

export const pollOption = pgTable(
  'poll_option',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    pollId: varchar('poll_id', { length: 255 })
      .notNull()
      .references(() => poll.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }).notNull(),
    emoji: varchar('emoji', { length: 50 }),
    order: integer('order').notNull().default(0),
  },
  (table) => [index('poll_option_poll_id_idx').on(table.pollId)],
);

export const pollVote = pgTable(
  'poll_vote',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    pollId: varchar('poll_id', { length: 255 })
      .notNull()
      .references(() => poll.id, { onDelete: 'cascade' }),
    optionId: varchar('option_id', { length: 255 })
      .notNull()
      .references(() => pollOption.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('poll_vote_poll_id_idx').on(table.pollId),
    index('poll_vote_option_id_idx').on(table.optionId),
    // One vote per user per poll (changing a vote replaces it).
    uniqueIndex('poll_vote_poll_user_unique').on(table.pollId, table.userId),
  ],
);

// ============================================================================
// Type definitions
// ============================================================================

export type Poll = typeof poll.$inferSelect;
export type NewPoll = typeof poll.$inferInsert;

export type PollOption = typeof pollOption.$inferSelect;
export type NewPollOption = typeof pollOption.$inferInsert;

export type PollVote = typeof pollVote.$inferSelect;
export type NewPollVote = typeof pollVote.$inferInsert;
