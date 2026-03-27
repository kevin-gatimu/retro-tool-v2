/**
 * Generic utility types
 */

/**
 * Generic paginated response wrapper
 */
export type PaginatedResponse<T> = {
  total: number
  page: number
  limit: number
  totalPages?: number
  data: T[]
}
