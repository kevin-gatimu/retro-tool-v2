import {
  pgTable,
  boolean,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { team } from '../../teams/schema';
import { organization } from '../../organizations/schema';
import { ESTIMATE_SESSION_STATUSES } from '../../common/enums';
import { estimateSessionStatusEnum } from '../../common/schema-enums';

// ============================================================================
// Estimate Template Tables
// ============================================================================

export const estimateTemplate = pgTable(
  'estimate_template',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
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
  (table) => [index('estimate_template_org_id_idx').on(table.organizationId)],
);

export const estimateTemplateValue = pgTable(
  'estimate_template_value',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    templateId: varchar('template_id', { length: 255 })
      .notNull()
      .references(() => estimateTemplate.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 20 }).notNull(),
    value: varchar('value', { length: 20 }).notNull(),
    order: integer('order').notNull().default(0),
    color: varchar('color', { length: 7 }),
    description: text('description'),
  },
  (table) => [
    index('estimate_template_value_template_id_idx').on(table.templateId),
    uniqueIndex('estimate_template_value_template_order_unique').on(
      table.templateId,
      table.order,
    ),
  ],
);

// ============================================================================
// Story Estimate Session Table
// ============================================================================

export const storyEstimateSession = pgTable(
  'story_estimate_session',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    teamId: varchar('team_id', { length: 255 })
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    createdById: varchar('created_by_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: estimateSessionStatusEnum('status')
      .notNull()
      .default(ESTIMATE_SESSION_STATUSES.Waiting),
    sprintLink: varchar('sprint_link', { length: 2048 }),
    currentRoundId: varchar('current_round_id', { length: 255 }),
    currentStory: text('current_story'),
    timerDuration: integer('timer_duration'),
    timerEndsAt: timestamp('timer_ends_at'),
    templateId: varchar('template_id', { length: 255 }).references(
      () => estimateTemplate.id,
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
    index('story_estimate_session_team_id_idx').on(table.teamId),
    index('story_estimate_session_created_by_id_idx').on(table.createdById),
    index('story_estimate_session_status_idx').on(table.status),
    index('story_estimate_session_template_id_idx').on(table.templateId),
    index('story_estimate_session_team_status_idx').on(
      table.teamId,
      table.status,
    ),
    index('story_estimate_session_updated_at_idx').on(table.updatedAt),
  ],
);

// ============================================================================
// Story Estimate Round Table
// ============================================================================

export const storyEstimateRound = pgTable(
  'story_estimate_round',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    sessionId: varchar('session_id', { length: 255 })
      .notNull()
      .references(() => storyEstimateSession.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    storyName: varchar('story_name', { length: 255 }).notNull(),
    ticketNumber: varchar('ticket_number', { length: 100 }).notNull(),
    storyDescription: text('story_description'),
    storyLink: varchar('story_link', { length: 2048 }),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    agreedPoints: varchar('agreed_points', { length: 20 }),
    revealedAt: timestamp('revealed_at'),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('story_estimate_round_session_id_idx').on(table.sessionId),
    index('story_estimate_round_session_status_idx').on(
      table.sessionId,
      table.status,
    ),
    uniqueIndex('story_estimate_round_session_number_unique').on(
      table.sessionId,
      table.roundNumber,
    ),
  ],
);

// ============================================================================
// Story Estimate Participant Table
// ============================================================================

export const storyEstimateParticipant = pgTable(
  'story_estimate_participant',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    sessionId: varchar('session_id', { length: 255 })
      .notNull()
      .references(() => storyEstimateSession.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    isOnline: boolean('is_online').notNull().default(false),
    joinedAt: timestamp('joined_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('story_estimate_participant_session_id_idx').on(table.sessionId),
    index('story_estimate_participant_user_id_idx').on(table.userId),
    uniqueIndex('story_estimate_participant_session_user_unique').on(
      table.sessionId,
      table.userId,
    ),
  ],
);

// ============================================================================
// Story Estimate Vote Table
// ============================================================================

export const storyEstimateVote = pgTable(
  'story_estimate_vote',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    sessionId: varchar('session_id', { length: 255 })
      .notNull()
      .references(() => storyEstimateSession.id, { onDelete: 'cascade' }),
    roundId: varchar('round_id', { length: 255 }).references(
      () => storyEstimateRound.id,
      { onDelete: 'set null' },
    ),
    voterId: varchar('voter_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    points: varchar('points', { length: 20 }).notNull(),
    votedAt: timestamp('voted_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('story_estimate_vote_session_id_idx').on(table.sessionId),
    index('story_estimate_vote_round_id_idx').on(table.roundId),
    index('story_estimate_vote_voter_id_idx').on(table.voterId),
    uniqueIndex('story_estimate_vote_round_voter_unique').on(
      table.roundId,
      table.voterId,
    ),
  ],
);

// ============================================================================
// Type definitions
// ============================================================================

export type StoryEstimateSession = typeof storyEstimateSession.$inferSelect;
export type NewStoryEstimateSession = typeof storyEstimateSession.$inferInsert;

export type StoryEstimateParticipant =
  typeof storyEstimateParticipant.$inferSelect;
export type NewStoryEstimateParticipant =
  typeof storyEstimateParticipant.$inferInsert;

export type StoryEstimateRound = typeof storyEstimateRound.$inferSelect;
export type NewStoryEstimateRound = typeof storyEstimateRound.$inferInsert;

export type StoryEstimateVote = typeof storyEstimateVote.$inferSelect;
export type NewStoryEstimateVote = typeof storyEstimateVote.$inferInsert;

export type EstimateTemplate = typeof estimateTemplate.$inferSelect;
export type NewEstimateTemplate = typeof estimateTemplate.$inferInsert;
export type EstimateTemplateValue = typeof estimateTemplateValue.$inferSelect;
export type NewEstimateTemplateValue =
  typeof estimateTemplateValue.$inferInsert;
