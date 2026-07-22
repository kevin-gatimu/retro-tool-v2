import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ORGANIZATIONS_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isSystemAdmin } from '@/lib/rbac'
import type { Organization } from '@/common/types/organizations'
import type { Team } from '@/common/types/teams'

/** Report dashboards a user can reach, in switcher display order. */
export type ReportType = 'me' | 'team' | 'org' | 'system'

export interface ReportAccess {
  /** true while role/org/team membership is still loading */
  isPending: boolean
  /** system admins (super-admin / system-admin) can see the System report */
  canSystem: boolean
  /** orgs where the user is owner/admin (can see the Org report) */
  adminOrgs: Organization[]
  /** every team the user belongs to (can see the Team report) */
  myTeams: Team[]
  /** first admin org id, or null when the user administers none */
  defaultOrgId: string | null
  /** first team id, or null when the user belongs to none */
  defaultTeamId: string | null
  /** report types this user may switch between, always including 'me' */
  options: ReportType[]
}

/**
 * Resolves which report dashboards the current user may view and the default
 * team/org to open for each. Shared by the `/reports` index redirect and the
 * in-page report switcher so both stay in sync with the RBAC rules:
 * super/system admin → System, org owner/admin → Org + Teams, everyone with a
 * team → Team, and everyone → My Insights.
 */
export function useReportAccess(): ReportAccess {
  const { data: currentUser, isPending: userPending } = useCurrentUser()

  const { data: orgs, isPending: orgsPending } = useQuery({
    queryKey: ['orgs-for-reports'],
    queryFn: () =>
      api
        .get<{ organizations: Organization[] }>(ORGANIZATIONS_ENDPOINTS.LIST)
        .then((response) => response.organizations),
    staleTime: 60_000,
  })

  const { data: teams, isPending: teamsPending } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () =>
      api
        .get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST)
        .then((response) => response.teams),
    staleTime: 60_000,
  })

  const canSystem = isSystemAdmin(currentUser?.role)
  const adminOrgs = (orgs ?? []).filter(
    (org) => org.myRole === 'org-owner' || org.myRole === 'org-admin',
  )
  const myTeams = teams ?? []

  const options: ReportType[] = ['me']
  if (myTeams.length > 0) options.push('team')
  if (adminOrgs.length > 0) options.push('org')
  if (canSystem) options.push('system')

  return {
    isPending: userPending || orgsPending || teamsPending,
    canSystem,
    adminOrgs,
    myTeams,
    defaultOrgId: adminOrgs[0]?.id ?? null,
    defaultTeamId: myTeams[0]?.id ?? null,
    options,
  }
}
