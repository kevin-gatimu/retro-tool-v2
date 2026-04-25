import {
  pgTable,
  boolean,
  integer,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';
import { team } from '../../teams/schema';
import { ESTIMATE_SESSION_STATUSES } from '../../common/enums';
import { estimateSessionStatusEnum } from '../../common/schema-enums';

// ============================================================================
// Story Estimate Session Table
// ============================================================================

export const storyEstimateSession = pgTable('story_estimate_session', {
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
  timerDuration: integer('timer_duration'), // seconds
  timerEndsAt: timestamp('timer_ends_at'),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// Story Estimate Round Table
// ============================================================================

export const storyEstimateRound = pgTable('story_estimate_round', {
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
});

// ============================================================================
// Story Estimate Participant Table
// ============================================================================

export const storyEstimateParticipant = pgTable('story_estimate_participant', {
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
});

// ============================================================================
// Story Estimate Vote Table
// ============================================================================

export const storyEstimateVote = pgTable('story_estimate_vote', {
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
  points: varchar('points', { length: 20 }).notNull(), // "1","2","5","?","☕"
  votedAt: timestamp('voted_at')
    .notNull()
    .$defaultFn(() => new Date()),
});

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
