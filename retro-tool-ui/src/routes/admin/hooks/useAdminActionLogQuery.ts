import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import type { PaginatedActionLog } from '../types'

interface AdminActionLogQueryParams {
  page: number
  pageSize: number
  dateRange?: 'today' | 'week' | 'month' | 'year'
  adminRole?: string
}

/**
 * Fetch paginated admin action log
 */
export function useAdminActionLogQuery(params: AdminActionLogQueryParams) {
  return useQuery({
    queryKey: [
      'admin-action-log',
      params.page,
      params.pageSize,
      params.dateRange,
      params.adminRole,
    ],
    queryFn: () => {
      const urlParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.pageSize),
      })
      if (params.dateRange) urlParams.set('dateRange', params.dateRange)
      if (params.adminRole) urlParams.set('adminRole', params.adminRole)
      return api.get<PaginatedActionLog>(
        `${USERS_ENDPOINTS.ADMIN_LOGS}?${urlParams.toString()}`,
      )
    },
    placeholderData: keepPreviousData,
  })
}
