import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'

/**
 * Organizations list for the bulk "Add to Org/Team" dialogs. Only fetched while
 * one of the bulk dialogs is open.
 */
export function useAdminOrgOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-orgs-list'],
    queryFn: () =>
      api.get<{ organizations: Array<{ id: string; name: string }> }>(
        `${ORGANIZATIONS_ENDPOINTS.LIST}?all=true&page=1&limit=500`,
      ),
    enabled,
    staleTime: 60_000,
  })
}

/**
 * Teams list for the selected organization in the bulk "Add to Team" dialog.
 */
export function useAdminTeamOptions({
  organizationId,
  enabled,
}: {
  organizationId: string
  enabled: boolean
}) {
  return useQuery({
    queryKey: ['admin-teams-list', organizationId],
    queryFn: () =>
      api.get<{ teams: Array<{ id: string; name: string }> }>(
        `${TEAMS_ENDPOINTS.LIST}?organizationId=${organizationId}&limit=500`,
      ),
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
  })
}
