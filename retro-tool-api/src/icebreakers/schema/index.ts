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
import { standup } from '../../standups/schema';
import { organization } from '../../organizations/schema';
import {
  ICEBREAKER_FLAVOURS,
  ICEBREAKER_PROMPT_DECISIONS,
  ICEBREAKER_SESSION_STATUSES,
  ICEBREAKER_SELECTION_MODES,
} from '../../common/enums';
import {
  icebreakerFlavourEnum,
  icebreakerPromptDecisionEnum,
  icebreakerSessionStatusEnum,
} from '../../common/schema-enums';

// ============================================================================
// Icebreaker Template Tables
// ============================================================================

export const icebreakerTemplate = pgTable(
  'icebreaker_template',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    flavour: icebreakerFlavourEnum('flavour')
      .notNull()
      .default(ICEBREAKER_FLAVOURS.Fun),
    isBuiltIn: boolean('is_built_in').notNull().default(false),
    organizationId: varchar('organization_id', { length: 255 }).references(
      () => organization.id,
      { onDelete: 'cascade' },
    ),
    color: varchar('color', { length: 7 }),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('icebreaker_template_org_id_idx').on(table.organizationId),
    index('icebreaker_template_flavour_idx').on(table.flavour),
  ],
);

export const icebreakerPrompt = pgTable(
  'icebreaker_prompt',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    templateId: varchar('template_id', { length: 255 })
      .notNull()
      .references(() => icebreakerTemplate.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    order: integer('order').notNull().default(0),
    color: varchar('color', { length: 7 }),
  },
  (table) => [
    index('icebreaker_prompt_template_id_idx').on(table.templateId),
    uniqueIndex('icebreaker_prompt_template_order_unique').on(
      table.templateId,
      table.order,
    ),
  ],
);

// ============================================================================
// Icebreaker Session Table
// ============================================================================

export const icebreakerSession = pgTable(
  'icebreaker_session',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    teamId: varchar('team_id', { length: 255 })
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: icebreakerSessionStatusEnum('status')
      .notNull()
      .default(ICEBREAKER_SESSION_STATUSES.Waiting),
    templateId: varchar('template_id', { length: 255 }).references(
      () => icebreakerTemplate.id,
      { onDelete: 'set null' },
    ),
    // When set, the session appears inside that standup's daily room. Kept on
    // standup deletion (set null) so it survives in icebreaker history.
    standupId: varchar('standup_id', { length: 255 }).references(
      () => standup.id,
      { onDelete: 'set null' },
    ),
    entryDate: date('entry_date'),
    currentPromptId: varchar('current_prompt_id', { length: 255 }),
    selectionMode: varchar('selection_mode', { length: 20 })
      .notNull()
      .default(ICEBREAKER_SELECTION_MODES.Ordered),
    seed: integer('seed').notNull(),
    flavourFilter: icebreakerFlavourEnum('flavour_filter'),
    timerDuration: integer('timer_duration'),
    timerEndsAt: timestamp('timer_ends_at'),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('icebreaker_session_team_id_idx').on(table.teamId),
    index('icebreaker_session_created_by_id_idx').on(table.createdById),
    index('icebreaker_session_status_idx').on(table.status),
    index('icebreaker_session_template_id_idx').on(table.templateId),
    index('icebreaker_session_team_status_idx').on(table.teamId, table.status),
    index('icebreaker_session_standup_date_idx').on(
      table.standupId,
      table.entryDate,
    ),
    index('icebreaker_session_updated_at_idx').on(table.updatedAt),
  ],
);

// ============================================================================
// Icebreaker Session Prompt Table (the materialised seed-ordered deck)
// ============================================================================

export const icebreakerSessionPrompt = pgTable(
  'icebreaker_session_prompt',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    sessionId: varchar('session_id', { length: 255 })
      .notNull()
      .references(() => icebreakerSession.id, { onDelete: 'cascade' }),
    promptId: varchar('prompt_id', { length: 255 }).references(
      () => icebreakerPrompt.id,
      { onDelete: 'set null' },
    ),
    text: text('text').notNull(),
    deckOrder: integer('deck_order').notNull(),
    decision: icebreakerPromptDecisionEnum('decision')
      .notNull()
      .default(ICEBREAKER_PROMPT_DECISIONS.Pending),
    presentedAt: timestamp('presented_at'),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('icebreaker_session_prompt_session_id_idx').on(table.sessionId),
    index('icebreaker_session_prompt_session_decision_idx').on(
      table.sessionId,
      table.decision,
    ),
    uniqueIndex('icebreaker_session_prompt_session_order_unique').on(
      table.sessionId,
      table.deckOrder,
    ),
  ],
);

// ============================================================================
// Icebreaker Participant Table
// ============================================================================

export const icebreakerParticipant = pgTable(
  'icebreaker_participant',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    sessionId: varchar('session_id', { length: 255 })
      .notNull()
      .references(() => icebreakerSession.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    isOnline: boolean('is_online').notNull().default(false),
    joinedAt: timestamp('joined_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('icebreaker_participant_session_id_idx').on(table.sessionId),
    index('icebreaker_participant_user_id_idx').on(table.userId),
    uniqueIndex('icebreaker_participant_session_user_unique').on(
      table.sessionId,
      table.userId,
    ),
  ],
);

// ============================================================================
// Type definitions
// ============================================================================

export type IcebreakerTemplate = typeof icebreakerTemplate.$inferSelect;
export type NewIcebreakerTemplate = typeof icebreakerTemplate.$inferInsert;

export type IcebreakerPrompt = typeof icebreakerPrompt.$inferSelect;
export type NewIcebreakerPrompt = typeof icebreakerPrompt.$inferInsert;

export type IcebreakerSession = typeof icebreakerSession.$inferSelect;
export type NewIcebreakerSession = typeof icebreakerSession.$inferInsert;

export type IcebreakerSessionPrompt =
  typeof icebreakerSessionPrompt.$inferSelect;
export type NewIcebreakerSessionPrompt =
  typeof icebreakerSessionPrompt.$inferInsert;

export type IcebreakerParticipant = typeof icebreakerParticipant.$inferSelect;
export type NewIcebreakerParticipant =
  typeof icebreakerParticipant.$inferInsert;
