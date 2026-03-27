import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'

/**
 * Check if admin user exists in the system
 */
export function useAdminCheck() {
  const { data: adminCheckData } = useQuery({
    queryKey: ['admin-exists'],
    queryFn: () => api.get<{ exists: boolean }>(USERS_ENDPOINTS.ADMIN_CHECK),
  })

  return adminCheckData?.exists ?? true
}
