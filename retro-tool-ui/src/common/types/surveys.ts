// ============================================================================
// Surveys (team-, org-, or system-scoped questionnaires)
// Mirrors retro-tool-api/src/surveys/types/index.ts + schema Survey type.
// ============================================================================

import type {
  TSurveyScope,
  TSurveyQuestionType,
} from '@/common/enums/survey.enums'

/** Base survey record (mirrors the Drizzle `survey` select type). */
export interface Survey {
  id: string
  title: string
  description: string | null
  scope: TSurveyScope
  teamId: string | null
  organizationId: string | null
  isAnonymous: boolean
  isClosed: boolean
  closesAt: string | Date | null
  createdById: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface SurveyQuestionView {
  id: string
  type: TSurveyQuestionType
  prompt: string
  options: string[]
  order: number
  isRequired: boolean
}

export interface SurveySummary extends Survey {
  scopeLabel: string
  /** Can close/delete this survey (scope-dependent role matrix). */
  canManage: boolean
  /** Can edit title/description/questions (creator or system/super admin). */
  canEdit: boolean
  hasResponded: boolean
  responseCount: number
  audienceCount: number
  questionCount: number
  createdBy: { id: string; name: string } | null
}

export interface SurveyQuestionResults {
  questionId: string
  prompt: string
  type: TSurveyQuestionType
  /** choice: per-option counts; rating: counts per 1..5 */
  optionCounts: { label: string; count: number }[]
  averageRating: number | null
  /** text answers (author never included) */
  textAnswers: string[]
  answerCount: number
}

/** A single answer belonging to the requesting user (edit-form pre-fill). */
export interface SurveyAnswerView {
  questionId: string
  textValue: string | null
  ratingValue: number | null
  choiceValue: string | null
}

/** One respondent's full submission — only sent for non-anonymous surveys. */
export interface SurveyRespondentView {
  userId: string
  /** null => render "Anonymous" (defensive; only populated for non-anon surveys). */
  name: string | null
  image: string | null
  answers: SurveyAnswerView[]
}

export interface SurveyDetail extends SurveySummary {
  questions: SurveyQuestionView[]
  /** Aggregate results — only for managers or after the caller responded. */
  results: SurveyQuestionResults[] | null
  /** Per-respondent submissions; null for anonymous surveys or when hidden. */
  respondents: SurveyRespondentView[] | null
  /** The caller's own answers (null until they respond); never another user's. */
  myAnswers: SurveyAnswerView[] | null
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface CreateSurveyQuestionInput {
  type: TSurveyQuestionType
  prompt: string
  options?: string[]
  isRequired?: boolean
}

export interface CreateSurveyInput {
  title: string
  description?: string
  scope: TSurveyScope
  teamId?: string
  organizationId?: string
  isAnonymous?: boolean
  questions: CreateSurveyQuestionInput[]
}

export interface UpdateSurveyQuestionInput {
  /** Present = update this existing question in place; absent = new question. */
  id?: string
  type: TSurveyQuestionType
  prompt: string
  options?: string[]
  isRequired?: boolean
}

export interface UpdateSurveyInput {
  title: string
  description?: string
  isAnonymous?: boolean
  questions: UpdateSurveyQuestionInput[]
}

export interface SurveyAnswerInput {
  questionId: string
  textValue?: string
  ratingValue?: number
  choiceValue?: string
}

export interface RespondSurveyInput {
  answers: SurveyAnswerInput[]
}
