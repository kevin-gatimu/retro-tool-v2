import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SURVEY_QUESTION_TYPES,
  SURVEY_SCOPES,
  type TSurveyScope,
} from '../../common/enums';

const questionSchema = z
  .object({
    type: z.enum(Object.values(SURVEY_QUESTION_TYPES) as [string, ...string[]]),
    prompt: z.string().min(1).max(500),
    options: z.array(z.string().min(1).max(255)).max(10).default([]),
    isRequired: z.boolean().default(true),
  })
  .refine(
    (question) =>
      question.type !== SURVEY_QUESTION_TYPES.Choice ||
      question.options.length >= 2,
    { message: 'Choice questions need at least 2 options' },
  );

export const createSurveySchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    scope: z
      .enum(Object.values(SURVEY_SCOPES) as [string, ...string[]])
      .default(SURVEY_SCOPES.Team),
    teamId: z.string().optional(),
    organizationId: z.string().optional(),
    isAnonymous: z.boolean().default(true),
    questions: z.array(questionSchema).min(1).max(15),
  })
  .refine(
    (value) => value.scope !== SURVEY_SCOPES.Team || Boolean(value.teamId),
    { message: 'teamId is required for team surveys' },
  )
  .refine(
    (value) =>
      value.scope !== SURVEY_SCOPES.Org || Boolean(value.organizationId),
    { message: 'organizationId is required for org surveys' },
  );
export type CreateSurveyDto = z.infer<typeof createSurveySchema>;

export class CreateSurveyDtoClass {
  @ApiProperty({ description: 'Survey title', maxLength: 255 })
  title: string;

  @ApiPropertyOptional({ description: 'Description', maxLength: 2000 })
  description?: string;

  @ApiProperty({ enum: Object.values(SURVEY_SCOPES), default: 'team' })
  scope: TSurveyScope;

  @ApiPropertyOptional({ description: 'Team ID (team scope)' })
  teamId?: string;

  @ApiPropertyOptional({ description: 'Organization ID (org scope)' })
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Hide respondent identities',
    default: true,
  })
  isAnonymous?: boolean;

  @ApiProperty({
    description: 'Questions (1–15)',
    example: [
      { type: 'rating', prompt: 'How satisfied are you with our sprints?' },
      {
        type: 'choice',
        prompt: 'Preferred meeting time?',
        options: ['Morning', 'Afternoon'],
      },
      { type: 'text', prompt: 'Anything else?', isRequired: false },
    ],
  })
  questions: Array<{
    type: string;
    prompt: string;
    options?: string[];
    isRequired?: boolean;
  }>;
}

export const respondSurveySchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        textValue: z.string().max(5000).optional(),
        ratingValue: z.number().int().min(1).max(5).optional(),
        choiceValue: z.string().max(255).optional(),
      }),
    )
    .min(1)
    .max(15),
});
export type RespondSurveyDto = z.infer<typeof respondSurveySchema>;

export class RespondSurveyDtoClass {
  @ApiProperty({
    description: 'Per-question answers',
    example: [{ questionId: 'q1', ratingValue: 4 }],
  })
  answers: Array<{
    questionId: string;
    textValue?: string;
    ratingValue?: number;
    choiceValue?: string;
  }>;
}

// ============================================================================
// Update survey (title/description/questions). Scope is immutable.
// Questions carrying an existing `id` are reconciled in place; new ones are
// inserted; omitted ones are deleted (their answers cascade).
// ============================================================================

const updateQuestionSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(Object.values(SURVEY_QUESTION_TYPES) as [string, ...string[]]),
    prompt: z.string().min(1).max(500),
    options: z.array(z.string().min(1).max(255)).max(10).default([]),
    isRequired: z.boolean().default(true),
  })
  .refine(
    (question) =>
      question.type !== SURVEY_QUESTION_TYPES.Choice ||
      question.options.length >= 2,
    { message: 'Choice questions need at least 2 options' },
  );

export const updateSurveySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  isAnonymous: z.boolean().optional(),
  questions: z.array(updateQuestionSchema).min(1).max(15),
});
export type UpdateSurveyDto = z.infer<typeof updateSurveySchema>;

export class UpdateSurveyDtoClass {
  @ApiProperty({ description: 'Survey title', maxLength: 255 })
  title: string;

  @ApiPropertyOptional({ description: 'Description', maxLength: 2000 })
  description?: string;

  @ApiPropertyOptional({ description: 'Hide respondent identities' })
  isAnonymous?: boolean;

  @ApiProperty({
    description:
      'Questions (1–15). Include `id` to update an existing question in place; omit it to add a new one. Questions not present are removed.',
    example: [
      { id: 'q1', type: 'rating', prompt: 'How are sprints going?' },
      { type: 'text', prompt: 'Anything else?', isRequired: false },
    ],
  })
  questions: Array<{
    id?: string;
    type: string;
    prompt: string;
    options?: string[];
    isRequired?: boolean;
  }>;
}
