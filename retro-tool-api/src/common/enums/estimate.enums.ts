export const ESTIMATE_SESSION_STATUSES = {
  Waiting: 'waiting',
  Voting: 'voting',
  Revealed: 'revealed',
  Completed: 'completed',
} as const;

export type TEstimateSessionStatus =
  (typeof ESTIMATE_SESSION_STATUSES)[keyof typeof ESTIMATE_SESSION_STATUSES];

export const ESTIMATE_ROUND_STATUSES = {
  Active: 'active',
  Revealed: 'revealed',
  Closed: 'closed',
} as const;

export type TEstimateRoundStatus =
  (typeof ESTIMATE_ROUND_STATUSES)[keyof typeof ESTIMATE_ROUND_STATUSES];
