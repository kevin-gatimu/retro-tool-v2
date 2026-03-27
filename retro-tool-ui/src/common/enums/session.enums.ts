export const SESSION_SORT_ORDERS = {
  CreatedAt: 'createdAt',
  ExpiresAt: 'expiresAt',
} as const
export type TSessionSortOrder =
  (typeof SESSION_SORT_ORDERS)[keyof typeof SESSION_SORT_ORDERS]
