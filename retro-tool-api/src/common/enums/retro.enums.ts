export const RETRO_STATUSES = {
  Draft: 'draft',
  Waiting: 'waiting',
  Active: 'active',
  Grouping: 'grouping',
  Voting: 'voting',
  Discussing: 'discussing',
  Completed: 'completed',
} as const;
export type TRetroStatus = (typeof RETRO_STATUSES)[keyof typeof RETRO_STATUSES];

export const RETRO_VOTE_TYPES = {
  Multi: 'multi',
  Single: 'single',
} as const;
export type TRetroVoteType =
  (typeof RETRO_VOTE_TYPES)[keyof typeof RETRO_VOTE_TYPES];

export const ACTION_ITEM_STATUSES = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Completed: 'completed',
} as const;
export type TActionItemStatus =
  (typeof ACTION_ITEM_STATUSES)[keyof typeof ACTION_ITEM_STATUSES];
