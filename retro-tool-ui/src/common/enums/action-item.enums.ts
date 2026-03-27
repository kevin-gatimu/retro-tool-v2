export const ACTION_ITEM_STATUSES = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Completed: 'completed',
} as const

export type TActionItemStatus =
  (typeof ACTION_ITEM_STATUSES)[keyof typeof ACTION_ITEM_STATUSES]
