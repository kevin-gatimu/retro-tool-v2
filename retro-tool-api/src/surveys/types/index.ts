import type { Survey } from '../schema';
import type { TSurveyQuestionType } from '../../common/enums';

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

export type SurveyDetail = SurveySummary & {
  questions: SurveyQuestionView[];
  /** Aggregate results — only for managers or after the caller responded. */
  results: SurveyQuestionResults[] | null;
};
