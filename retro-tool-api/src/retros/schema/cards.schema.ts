import {
  boolean,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { retrospective, templateColumn } from './retros.schema';

// ============================================================================
// Card Tables
// ============================================================================

export const card = pgTable('card', {
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
});

export const vote = pgTable('vote', {
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
});

export const cardComment = pgTable('card_comment', {
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
});

// ============================================================================
// Type definitions
// ============================================================================

export type Card = typeof card.$inferSelect;
export type NewCard = typeof card.$inferInsert;

export type Vote = typeof vote.$inferSelect;
export type NewVote = typeof vote.$inferInsert;

export type CardComment = typeof cardComment.$inferSelect;
export type NewCardComment = typeof cardComment.$inferInsert;
