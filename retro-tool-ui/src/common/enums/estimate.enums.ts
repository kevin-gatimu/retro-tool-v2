export const ESTIMATE_SESSION_STATUSES = {
  Waiting: 'waiting',
  Voting: 'voting',
  Revealed: 'revealed',
  Completed: 'completed',
} as const

export type TEstimateSessionStatus =
  (typeof ESTIMATE_SESSION_STATUSES)[keyof typeof ESTIMATE_SESSION_STATUSES]
