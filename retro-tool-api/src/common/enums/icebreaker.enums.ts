export const ICEBREAKER_SESSION_STATUSES = {
  Waiting: 'waiting',
  Curating: 'curating',
  Presenting: 'presenting',
  Completed: 'completed',
} as const;

export type TIcebreakerSessionStatus =
  (typeof ICEBREAKER_SESSION_STATUSES)[keyof typeof ICEBREAKER_SESSION_STATUSES];

export const ICEBREAKER_FLAVOURS = {
  Fun: 'fun',
  Professional: 'professional',
  Creative: 'creative',
} as const;

export type TIcebreakerFlavour =
  (typeof ICEBREAKER_FLAVOURS)[keyof typeof ICEBREAKER_FLAVOURS];

export const ICEBREAKER_PROMPT_DECISIONS = {
  Pending: 'pending',
  Kept: 'kept',
  Skipped: 'skipped',
} as const;

export type TIcebreakerPromptDecision =
  (typeof ICEBREAKER_PROMPT_DECISIONS)[keyof typeof ICEBREAKER_PROMPT_DECISIONS];

export const ICEBREAKER_SELECTION_MODES = {
  Ordered: 'ordered',
  Random: 'random',
  Custom: 'custom',
} as const;

export type TIcebreakerSelectionMode =
  (typeof ICEBREAKER_SELECTION_MODES)[keyof typeof ICEBREAKER_SELECTION_MODES];
