import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  RefreshCw,
  Search,
  Star,
  User,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type { Team } from '@/common/types/teams'
import { UserTeamsSkeleton } from './skeleton'

type PaginatedTeamsResponse = {
  teams: Team[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const PAGE_SIZE_OPTIONS = [6, 12, 24, 48]
const DEFAULT_PAGE_SIZE = 12

function buildTeamsQueryKey(page: number, limit: number, search: string) {
  return ['teams', page, limit, search] as const
}

function fetchTeams(page: number, limit: number, search: string) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  const normalizedSearch = search.trim()
  if (normalizedSearch) {
    params.set('search', normalizedSearch)
  }

  return api.get<PaginatedTeamsResponse>(
    `${TEAMS_ENDPOINTS.LIST}?${params.toString()}`,
  )
}

export const Route = createFileRoute('/teams/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: buildTeamsQueryKey(1, DEFAULT_PAGE_SIZE, ''),
      queryFn: () => fetchTeams(1, DEFAULT_PAGE_SIZE, ''),
    }),
  pendingComponent: UserTeamsSkeleton,
  component: TeamPage,
})

function TeamPage() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')

  const { data: teamsData, isFetching } = useQuery({
    queryKey: buildTeamsQueryKey(page, pageSize, search),
    queryFn: () => fetchTeams(page, pageSize, search),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const teams = teamsData?.teams ?? []
  const total = teamsData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleRefresh = () =>
    queryClient.invalidateQueries({ queryKey: ['teams'] })

  const getRoleBadge = (role: string) => {
    if (role === 'team-lead') {
      return (
        <Badge variant="default" className="gap-1">
          <Star className="h-3 w-3" />
          Lead
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="gap-1">
        <User className="h-3 w-3" />
        Member
      </Badge>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Teams</h1>
        <p className="text-muted-foreground">
          View and manage your team memberships
        </p>
      </div>

      <div className="max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search teams"
            className="pl-9"
          />
        </div>
      </div>

      {/* Teams Section */}
      {teams.length === 0 && !isFetching ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No teams yet</CardTitle>
            <p className="text-muted-foreground text-center mb-4">
              You're not a member of any teams. Browse your organizations to
              join or request to join a team.
            </p>
            <Button asChild>
              <Link to="/organizations">
                <Building2 className="mr-2 h-4 w-4" />
                Browse Organizations
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Link
                key={team.id}
                to="/teams/$teamId"
                params={{ teamId: team.id }}
              >
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{team.emoji}</span>
                        <div>
                          <CardTitle className="text-lg">{team.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {team.organization?.name ?? 'Organization'}
                          </CardDescription>
                        </div>
                      </div>
                      {getRoleBadge(team.myRole)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>
                          {team.memberCount ?? 0}{' '}
                          {team.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                      <ChevronRightIcon className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {total > 6 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>
                  Page {page} of {totalPages} &middot; {total} teams
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={handleRefresh}
                  disabled={isFetching}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
