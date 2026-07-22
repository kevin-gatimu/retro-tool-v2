import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { REPORTS_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  OrgLeagueRow,
  OrgReport,
  OrgTeamLeagueRow,
  Paginated,
  PersonalReport,
  PlatformReport,
  ReportPeriod,
  TeamMemberBreakdownRow,
  TeamReport,
} from '../types'

const MINUTE = 60_000

export interface LeagueParams {
  page: number
  pageSize: number
  search: string
}

function leagueQueryString(period: ReportPeriod, params: LeagueParams): string {
  const query = new URLSearchParams({
    period,
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.search) query.set('search', params.search)
  return `?${query.toString()}`
}

// ── Composite dashboard payloads (route loaders ensure these; components
//    consume them with useSuspenseQuery) ─────────────────────────────────────

export function personalReportQueryOptions(period: ReportPeriod) {
  return queryOptions({
    queryKey: ['reports', 'me', period],
    queryFn: () =>
      api.get<PersonalReport>(`${REPORTS_ENDPOINTS.V2_ME}?period=${period}`),
    staleTime: MINUTE,
  })
}

export function teamReportQueryOptions(teamId: string, period: ReportPeriod) {
  return queryOptions({
    queryKey: ['reports', 'team', teamId, period],
    queryFn: () =>
      api.get<TeamReport>(
        `${REPORTS_ENDPOINTS.V2_TEAM(teamId)}?period=${period}`,
      ),
    staleTime: MINUTE,
  })
}

export function orgReportQueryOptions(orgId: string, period: ReportPeriod) {
  return queryOptions({
    queryKey: ['reports', 'org', orgId, period],
    queryFn: () =>
      api.get<OrgReport>(`${REPORTS_ENDPOINTS.V2_ORG(orgId)}?period=${period}`),
    staleTime: 5 * MINUTE,
  })
}

export function platformReportQueryOptions(period: ReportPeriod) {
  return queryOptions({
    queryKey: ['reports', 'platform', period],
    queryFn: () =>
      api.get<PlatformReport>(
        `${REPORTS_ENDPOINTS.V2_PLATFORM}?period=${period}`,
      ),
    staleTime: 5 * MINUTE,
  })
}

// ── Paginated league tables (independent refetch on page/search) ────────────

export function useTeamMembersLeague(
  teamId: string,
  period: ReportPeriod,
  params: LeagueParams,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['reports', 'team', teamId, period, 'members', params],
    queryFn: () =>
      api.get<Paginated<TeamMemberBreakdownRow>>(
        `${REPORTS_ENDPOINTS.V2_TEAM_MEMBERS(teamId)}${leagueQueryString(period, params)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: MINUTE,
    enabled,
  })
}

export function useOrgTeamsLeague(
  orgId: string,
  period: ReportPeriod,
  params: LeagueParams,
) {
  return useQuery({
    queryKey: ['reports', 'org', orgId, period, 'teams', params],
    queryFn: () =>
      api.get<Paginated<OrgTeamLeagueRow>>(
        `${REPORTS_ENDPOINTS.V2_ORG_TEAMS(orgId)}${leagueQueryString(period, params)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 5 * MINUTE,
  })
}

export function usePlatformOrgsLeague(
  period: ReportPeriod,
  params: LeagueParams,
) {
  return useQuery({
    queryKey: ['reports', 'platform', period, 'orgs', params],
    queryFn: () =>
      api.get<Paginated<OrgLeagueRow>>(
        `${REPORTS_ENDPOINTS.V2_PLATFORM_ORGS}${leagueQueryString(period, params)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 5 * MINUTE,
  })
}
