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
import { retrospective } from './retros.schema';
import { card } from './cards.schema';
import { actionItemStatusEnum } from '../../common/schema-enums';

// ============================================================================
// Action Item Tables
// ============================================================================

export const actionItem = pgTable(
  'action_item',
  {
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
  },
  (table) => [
    index('action_item_retro_id_idx').on(table.retroId),
    index('action_item_card_id_idx').on(table.cardId),
    index('action_item_assignee_id_idx').on(table.assigneeId),
    index('action_item_status_idx').on(table.status),
    index('action_item_retro_status_idx').on(table.retroId, table.status),
    index('action_item_assignee_status_idx').on(table.assigneeId, table.status),
    index('action_item_created_at_idx').on(table.createdAt),
    index('action_item_due_date_idx').on(table.dueDate),
  ],
);

export const actionItemComment = pgTable(
  'action_item_comment',
  {
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
  },
  (table) => [
    index('action_item_comment_action_item_id_idx').on(table.actionItemId),
    index('action_item_comment_author_id_idx').on(table.authorId),
  ],
);

export const actionItemLike = pgTable(
  'action_item_like',
  {
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
  },
  (table) => [
    index('action_item_like_action_item_id_idx').on(table.actionItemId),
    index('action_item_like_user_id_idx').on(table.userId),
    uniqueIndex('action_item_like_item_user_unique').on(
      table.actionItemId,
      table.userId,
    ),
  ],
);

// ============================================================================
// Type definitions
// ============================================================================

export type ActionItem = typeof actionItem.$inferSelect;
export type NewActionItem = typeof actionItem.$inferInsert;

export type ActionItemComment = typeof actionItemComment.$inferSelect;
export type NewActionItemComment = typeof actionItemComment.$inferInsert;

export type ActionItemLike = typeof actionItemLike.$inferSelect;
export type NewActionItemLike = typeof actionItemLike.$inferInsert;
