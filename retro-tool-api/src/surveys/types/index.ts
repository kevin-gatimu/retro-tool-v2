import type { Survey } from '../schema';
import type { TSurveyQuestionType } from '../../common/enums';

/**
 * The requesting user's role and membership footprint, resolved once per request
 * and threaded through the survey access-control helpers ({@link canSee},
 * {@link canEdit}, {@link canManage}).
 */
export type SurveyUserContext = {
  role: string;
  teamIds: string[];
  orgAdminIds: string[];
  orgIds: string[];
  leadTeamIds: string[];
  /** Parent org id for each team the user belongs to (teamId → orgId). */
  orgIdByTeamId: Record<string, string>;
};

export type SurveyQuestionView = {
  id: string;
  type: TSurveyQuestionType;
  prompt: string;
  options: string[];
  order: number;
  isRequired: boolean;
};

export type SurveySummary = Survey & {
  scopeLabel: string;
  /** Can close/delete this survey (scope-dependent role matrix). */
  canManage: boolean;
  /** Can edit title/description/questions (creator or system/super admin). */
  canEdit: boolean;
  hasResponded: boolean;
  responseCount: number;
  audienceCount: number;
  questionCount: number;
  createdBy: { id: string; name: string } | null;
};

export type SurveyQuestionResults = {
  questionId: string;
  prompt: string;
  type: TSurveyQuestionType;
  /** choice: per-option counts; rating: counts per 1..5 */
  optionCounts: { label: string; count: number }[];
  averageRating: number | null;
  /** text answers (author never included) */
  textAnswers: string[];
  answerCount: number;
};

/** A single answer belonging to the requesting user (edit-form pre-fill). */
export type SurveyAnswerView = {
  questionId: string;
  textValue: string | null;
  ratingValue: number | null;
  choiceValue: string | null;
};

/** One respondent's full submission — only sent for non-anonymous surveys. */
export type SurveyRespondentView = {
  userId: string;
  /** null => render "Anonymous" (defensive; only populated for non-anon surveys). */
  name: string | null;
  image: string | null;
  answers: SurveyAnswerView[];
};

export type SurveyDetail = SurveySummary & {
  questions: SurveyQuestionView[];
  /** Aggregate results — only for managers or after the caller responded. */
  results: SurveyQuestionResults[] | null;
  /** Per-respondent submissions. null for anonymous surveys or when the caller can't see results. */
  respondents: SurveyRespondentView[] | null;
  /** The caller's own answers (null until they respond); never another user's. */
  myAnswers: SurveyAnswerView[] | null;
};
