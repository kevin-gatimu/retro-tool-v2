import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import type { User as UserType } from '@/common/types/users'

/**
 * Search for users by name or email
 */
export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ['user-search', query],
    queryFn: () =>
      api.get<UserType[]>(
        `${USERS_ENDPOINTS.SEARCH}?q=${encodeURIComponent(query)}&limit=10`,
      ),
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  })
}
