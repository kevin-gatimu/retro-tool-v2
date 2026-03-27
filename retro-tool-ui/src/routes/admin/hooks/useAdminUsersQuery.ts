import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import type { UsersPage } from '../types'

interface AdminUsersQueryParams {
  page: number
  pageSize: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Fetch paginated admin users list with optional sorting and search
 */
export function useAdminUsersQuery(params: AdminUsersQueryParams) {
  return useQuery({
    queryKey: [
      'admin-users',
      params.page,
      params.pageSize,
      params.search,
      params.sortBy,
      params.sortOrder,
    ],
    queryFn: () => {
      const urlParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.pageSize),
      })
      if (params.search) urlParams.set('search', params.search)
      if (params.sortBy) urlParams.set('sortBy', params.sortBy)
      if (params.sortOrder) urlParams.set('sortOrder', params.sortOrder)
      return api.get<UsersPage>(`${USERS_ENDPOINTS.LIST}?${urlParams}`)
    },
    placeholderData: (prev) => prev,
  })
}
