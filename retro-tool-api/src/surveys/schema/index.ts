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
import { SURVEY_SCOPES } from '../../common/enums';
import {
  surveyQuestionTypeEnum,
  surveyScopeEnum,
} from '../../common/schema-enums';

// ============================================================================
// Survey (team-, org-, or system-scoped questionnaire)
// ============================================================================

export const survey = pgTable(
  'survey',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    scope: surveyScopeEnum('scope').notNull().default(SURVEY_SCOPES.Team),
    teamId: varchar('team_id', { length: 255 }).references(() => team.id, {
      onDelete: 'cascade',
    }),
    organizationId: varchar('organization_id', { length: 255 }).references(
      () => organization.id,
      { onDelete: 'cascade' },
    ),
    // Anonymous surveys never expose who answered what.
    isAnonymous: boolean('is_anonymous').notNull().default(true),
    isClosed: boolean('is_closed').notNull().default(false),
    closesAt: timestamp('closes_at'),
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
    index('survey_team_id_idx').on(table.teamId),
    index('survey_org_id_idx').on(table.organizationId),
    index('survey_scope_idx').on(table.scope),
    index('survey_created_by_id_idx').on(table.createdById),
    index('survey_closed_idx').on(table.isClosed),
  ],
);

export const surveyQuestion = pgTable(
  'survey_question',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    surveyId: varchar('survey_id', { length: 255 })
      .notNull()
      .references(() => survey.id, { onDelete: 'cascade' }),
    type: surveyQuestionTypeEnum('type').notNull(),
    prompt: varchar('prompt', { length: 500 }).notNull(),
    // JSON-encoded string[] for choice questions; null otherwise.
    options: text('options'),
    order: integer('order').notNull().default(0),
    isRequired: boolean('is_required').notNull().default(true),
  },
  (table) => [index('survey_question_survey_id_idx').on(table.surveyId)],
);

// ============================================================================
// Responses
// ============================================================================

export const surveyResponse = pgTable(
  'survey_response',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    surveyId: varchar('survey_id', { length: 255 })
      .notNull()
      .references(() => survey.id, { onDelete: 'cascade' }),
    // Stored to enforce one response per user; never exposed for anonymous surveys.
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('survey_response_survey_id_idx').on(table.surveyId),
    uniqueIndex('survey_response_survey_user_unique').on(
      table.surveyId,
      table.userId,
    ),
  ],
);

export const surveyAnswer = pgTable(
  'survey_answer',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    responseId: varchar('response_id', { length: 255 })
      .notNull()
      .references(() => surveyResponse.id, { onDelete: 'cascade' }),
    questionId: varchar('question_id', { length: 255 })
      .notNull()
      .references(() => surveyQuestion.id, { onDelete: 'cascade' }),
    textValue: text('text_value'),
    ratingValue: integer('rating_value'),
    choiceValue: varchar('choice_value', { length: 255 }),
  },
  (table) => [
    index('survey_answer_response_id_idx').on(table.responseId),
    index('survey_answer_question_id_idx').on(table.questionId),
    uniqueIndex('survey_answer_response_question_unique').on(
      table.responseId,
      table.questionId,
    ),
  ],
);

// ============================================================================
// Type definitions
// ============================================================================

export type Survey = typeof survey.$inferSelect;
export type NewSurvey = typeof survey.$inferInsert;

export type SurveyQuestion = typeof surveyQuestion.$inferSelect;
export type NewSurveyQuestion = typeof surveyQuestion.$inferInsert;

export type SurveyResponse = typeof surveyResponse.$inferSelect;
export type NewSurveyResponse = typeof surveyResponse.$inferInsert;

export type SurveyAnswer = typeof surveyAnswer.$inferSelect;
export type NewSurveyAnswer = typeof surveyAnswer.$inferInsert;
