import {
  boolean,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { retrospective } from './retros.schema';
import { card } from './cards.schema';
import { actionItemStatusEnum } from '../../common/schema-enums';

// ============================================================================
// Action Item Tables
// ============================================================================

export const actionItem = pgTable('action_item', {
  id: varchar('id', { length: 255 }).primaryKey(),
  retroId: varchar('retro_id', { length: 255 })
    .notNull()
    .references(() => retrospective.id, { onDelete: 'cascade' }),
  cardId: varchar('card_id', { length: 255 }).references(() => card.id, {
    onDelete: 'set null',
  }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  assigneeId: varchar('assignee_id', { length: 255 }).references(
    () => user.id,
    { onDelete: 'set null' },
  ),
  status: actionItemStatusEnum('status').notNull().default('pending'),
  isCarriedForward: boolean('is_carried_forward').notNull().default(false),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

export const actionItemComment = pgTable('action_item_comment', {
  id: varchar('id', { length: 255 }).primaryKey(),
  actionItemId: varchar('action_item_id', { length: 255 })
    .notNull()
    .references(() => actionItem.id, { onDelete: 'cascade' }),
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

export const actionItemLike = pgTable('action_item_like', {
  id: varchar('id', { length: 255 }).primaryKey(),
  actionItemId: varchar('action_item_id', { length: 255 })
    .notNull()
    .references(() => actionItem.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// Type definitions
// ============================================================================

export type ActionItem = typeof actionItem.$inferSelect;
export type NewActionItem = typeof actionItem.$inferInsert;

export type ActionItemComment = typeof actionItemComment.$inferSelect;
export type NewActionItemComment = typeof actionItemComment.$inferInsert;

export type ActionItemLike = typeof actionItemLike.$inferSelect;
export type NewActionItemLike = typeof actionItemLike.$inferInsert;
