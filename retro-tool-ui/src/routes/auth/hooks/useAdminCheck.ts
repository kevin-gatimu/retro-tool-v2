import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'

interface AdminCheckResult {
  exists: boolean
  hasAnyUser: boolean
}

/**
 * Returns admin existence and whether any user exists at all.
 * - `adminExists`  — true if a super-admin or system-admin is in the DB (controls bootstrap eligibility)
 * - `hasAnyUser`   — true if ANY user exists (controls the "first user" banner visibility)
 */
export function useAdminCheck() {
  const { data } = useQuery({
    queryKey: ['admin-exists'],
    queryFn: () => api.get<AdminCheckResult>(USERS_ENDPOINTS.ADMIN_CHECK),
  })

  return {
    adminExists: data?.exists ?? true,
    hasAnyUser: data?.hasAnyUser ?? true,
  }
}
