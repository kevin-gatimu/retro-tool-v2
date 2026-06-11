import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { retrospective, templateColumn } from './retros.schema';

// ============================================================================
// Card Tables
// ============================================================================

export const card = pgTable(
  'card',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    retroId: varchar('retro_id', { length: 255 })
      .notNull()
      .references(() => retrospective.id, { onDelete: 'cascade' }),
    columnId: varchar('column_id', { length: 255 })
      .notNull()
      .references(() => templateColumn.id),
    authorId: varchar('author_id', { length: 255 }).references(() => user.id, {
      onDelete: 'set null',
    }),
    content: text('content').notNull(),
    isDiscussed: boolean('is_discussed').notNull().default(false),
    discussedAt: timestamp('discussed_at'),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('card_retro_id_idx').on(table.retroId),
    index('card_column_id_idx').on(table.columnId),
    index('card_author_id_idx').on(table.authorId),
    index('card_retro_column_idx').on(table.retroId, table.columnId),
    index('card_created_at_idx').on(table.createdAt),
  ],
);

export const vote = pgTable(
  'vote',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    cardId: varchar('card_id', { length: 255 })
      .notNull()
      .references(() => card.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('vote_card_id_idx').on(table.cardId),
    index('vote_user_id_idx').on(table.userId),
    uniqueIndex('vote_card_user_unique').on(table.cardId, table.userId),
  ],
);

export const cardComment = pgTable(
  'card_comment',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    cardId: varchar('card_id', { length: 255 })
      .notNull()
      .references(() => card.id, { onDelete: 'cascade' }),
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
    index('card_comment_card_id_idx').on(table.cardId),
    index('card_comment_author_id_idx').on(table.authorId),
  ],
);

// ============================================================================
// Type definitions
// ============================================================================

export type Card = typeof card.$inferSelect;
export type NewCard = typeof card.$inferInsert;

export type Vote = typeof vote.$inferSelect;
export type NewVote = typeof vote.$inferInsert;

export type CardComment = typeof cardComment.$inferSelect;
export type NewCardComment = typeof cardComment.$inferInsert;
