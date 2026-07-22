import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import {
  ORGANIZATIONS_ENDPOINTS,
  TEAM_ROLES_ENDPOINTS,
  TEAMS_ENDPOINTS,
  USERS_ENDPOINTS,
} from '@/lib/api-endpoints'
import type { OrganizationDetail } from '@/common/types/organizations'
import type { Team } from '@/common/types/teams'
import type { OrgTeamRoleAdminResponse } from '../types'

/**
 * Core organization-detail data: the organization itself (suspense), the org's
 * teams, and whether the viewer is a team-lead of any team in this org.
 */
export function useOrgData(orgId: string) {
  const { data: organization } = useSuspenseQuery({
    queryKey: ['organization', orgId],
    queryFn: () =>
      api.get<OrganizationDetail>(ORGANIZATIONS_ENDPOINTS.BY_ID(orgId)),
  })

  const { data: teamsData } = useQuery({
    queryKey: ['org-teams', orgId],
    queryFn: () =>
      api.get<{ teams: Team[] }>(
        `${TEAMS_ENDPOINTS.LIST}?organizationId=${orgId}`,
      ),
    enabled: !!organization,
  })
  const teams = teamsData?.teams ?? []

  // Fetch the current user's own teams (includes correct myRole/tag)
  const { data: myTeamsData } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
    enabled: !!organization,
    staleTime: 30_000,
  })
  const isTeamLeadInOrg =
    myTeamsData?.teams.some(
      (t) => t.organizationId === orgId && t.myRole === 'team-lead',
    ) ?? false

  return { organization, teams, isTeamLeadInOrg }
}

/** Admin listing of built-in and custom team roles for the organization. */
export function useOrgTeamRoles(orgId: string, enabled: boolean) {
  return useQuery<OrgTeamRoleAdminResponse>({
    queryKey: ['org-team-roles', orgId],
    queryFn: () =>
      api.get<OrgTeamRoleAdminResponse>(
        TEAM_ROLES_ENDPOINTS.ORG_ADMIN_LIST(orgId),
      ),
    enabled,
  })
}

/** User search for the "Add Member" dialog (enabled at 2+ characters). */
export function useUserSearch(search: string) {
  return useQuery({
    queryKey: ['user-search', search],
    queryFn: () =>
      api.get<
        Array<{ id: string; name: string; email: string; image: string | null }>
      >(`${USERS_ENDPOINTS.SEARCH}?q=${encodeURIComponent(search)}`),
    enabled: search.length >= 2,
  })
}

/** Request to join a team from the Teams tab. */
export function useRequestToJoinTeam(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (teamId: string) =>
      api.post(TEAMS_ENDPOINTS.JOIN_REQUESTS(teamId), {}),
    onSuccess: () => {
      toast.success('Join request sent')
      queryClient.invalidateQueries({ queryKey: ['org-teams', orgId] })
    },
    onError: (error) => toast.error(error.message || 'Failed to send request'),
  })
}

/** Bulk-remove the currently selected members from the org. */
export function useBulkRemoveMembers({
  orgId,
  selectedMemberIds,
  onCleared,
}: {
  orgId: string
  selectedMemberIds: string[]
  onCleared: () => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      Promise.all(
        selectedMemberIds.map((userId) =>
          api.delete(ORGANIZATIONS_ENDPOINTS.MEMBER_BY_ID(orgId, userId)),
        ),
      ),
    onSuccess: () => {
      toast.success(`${selectedMemberIds.length} member(s) removed`)
      onCleared()
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to remove members'),
  })
}
