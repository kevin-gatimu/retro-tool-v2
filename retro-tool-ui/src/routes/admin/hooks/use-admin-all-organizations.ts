import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS } from '@/lib/api-endpoints'
import type { PaginatedOrgsResponse } from '../types'

/**
 * Fetch all organizations for admin template forms (org selector). Shared across
 * the retro, estimate, and icebreaker template tabs; cached under a single key.
 */
export function useAdminAllOrganizations() {
  const query = useQuery({
    queryKey: ['admin-all-organizations'],
    queryFn: () =>
      api.get<PaginatedOrgsResponse>(
        `${ORGANIZATIONS_ENDPOINTS.LIST}?all=true&page=1&limit=1000`,
      ),
    staleTime: 60_000,
  })

  return { ...query, allOrgs: query.data?.organizations ?? [] }
}
