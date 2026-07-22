import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  ORGANIZATIONS_ENDPOINTS,
  TEAM_ROLES_ENDPOINTS,
  TEAMS_ENDPOINTS,
} from '@/lib/api-endpoints'
import type { OrgTeamRole } from '@/components/tables/member-columns'
import type { TeamDetail } from '@/common/types/teams'
import type { Organization } from '@/common/types/organizations'
import type { PaginatedTeamMembersResponse } from '../types'

/** Team detail (suspense) — the core record backing the detail page. */
export function useTeamDetail(teamId: string) {
  return useSuspenseQuery({
    queryKey: ['team', teamId],
    queryFn: () => api.get<TeamDetail>(TEAMS_ENDPOINTS.BY_ID(teamId)),
  })
}

/** Parent organization of the team (for the org member list). */
export function useTeamOrganization(organizationId: string) {
  return useQuery({
    queryKey: ['organization', organizationId],
    queryFn: () =>
      api.get<Organization>(ORGANIZATIONS_ENDPOINTS.BY_ID(organizationId)),
    enabled: !!organizationId,
  })
}

/** Paginated team members table data. */
export function useTeamMembers({
  teamId,
  page,
  pageSize,
  enabled,
}: {
  teamId: string
  page: number
  pageSize: number
  enabled: boolean
}) {
  return useQuery({
    queryKey: ['team-members', teamId, page, pageSize],
    queryFn: () =>
      api.get<PaginatedTeamMembersResponse>(
        `${TEAMS_ENDPOINTS.MEMBERS(teamId)}?page=${page}&limit=${pageSize}`,
      ),
    enabled,
    placeholderData: (prev) => prev,
  })
}

/** Custom job roles configured for the team's organization. */
export function useOrgTeamRoles(organizationId: string) {
  return useQuery({
    queryKey: ['org-team-roles', organizationId],
    queryFn: () =>
      api.get<OrgTeamRole[]>(TEAM_ROLES_ENDPOINTS.ORG_LIST(organizationId)),
    enabled: !!organizationId,
  })
}
