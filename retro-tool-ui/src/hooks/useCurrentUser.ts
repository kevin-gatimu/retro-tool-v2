import { useQuery } from '@tanstack/react-query'
import { api } from '#/lib/api'
import { USERS_ENDPOINTS } from '#/lib/api-endpoints'
import type { User } from '#/common/types/users'

export const CURRENT_USER_QUERY_KEY = ['current-user'] as const

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: () => api.get<User | null>(USERS_ENDPOINTS.ME),
    staleTime: 60_000,
  })
}
