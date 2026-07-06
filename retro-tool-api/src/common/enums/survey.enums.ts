export const SURVEY_SCOPES = {
  Team: 'team',
  Org: 'org',
  System: 'system',
} as const;

export type TSurveyScope = (typeof SURVEY_SCOPES)[keyof typeof SURVEY_SCOPES];

export const SURVEY_QUESTION_TYPES = {
  Text: 'text',
  Rating: 'rating',
  Choice: 'choice',
} as const;

export type TSurveyQuestionType =
  (typeof SURVEY_QUESTION_TYPES)[keyof typeof SURVEY_QUESTION_TYPES];
