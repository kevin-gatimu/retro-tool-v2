import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  History as HistoryIcon,
  LayoutDashboard,
  Plus,
  Spade,
  ThumbsUp,
  Users,
  Vote,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import {
  POLLS_ENDPOINTS,
  RETROS_ENDPOINTS,
  SURVEYS_ENDPOINTS,
} from '@/lib/api-endpoints'
import { usesConvexForSurveys, usesConvexForPolls } from '@/lib/realtime-config'
import { authClient } from '@/lib/auth-client'
import type { Retro } from '@/common/types/retros'
import type { DashboardStats } from './types'

const dashboardStatsQueryOptions = {
  queryKey: ['dashboard-stats'] as const,
  queryFn: () => api.get<DashboardStats>(RETROS_ENDPOINTS.DASHBOARD),
}

const dashboardRetrosQueryOptions = {
  queryKey: ['dashboard-retros'] as const,
  queryFn: async () => {
    const res = await api.get<{ retros: Retro[]; total: number } | Retro[]>(
      RETROS_ENDPOINTS.LIST,
    )
    return Array.isArray(res) ? res : res.retros
  },
}

export const Route = createFileRoute('/dashboard/')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(dashboardStatsQueryOptions)
    void queryClient.prefetchQuery(dashboardRetrosQueryOptions)
  },
  component: DashboardIndexPage,
})

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  grouping:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  voting:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  completed:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

function DashboardIndexPage() {
  const { data: session } = authClient.useSession()

  const { data: stats, isLoading: statsLoading } = useQuery(
    dashboardStatsQueryOptions,
  )

  const { data: recentRetros, isLoading: retrosLoading } = useQuery(
    dashboardRetrosQueryOptions,
  )

  const { data: surveysActive } = useQuery({
    queryKey: ['surveys-active-count'],
    queryFn: () => api.get<{ count: number }>(SURVEYS_ENDPOINTS.ACTIVE_COUNT),
    staleTime: 30_000,
    refetchInterval: usesConvexForSurveys() ? false : 30_000,
  })

  const { data: pollsActive } = useQuery({
    queryKey: ['polls-active-count'],
    queryFn: () => api.get<{ count: number }>(POLLS_ENDPOINTS.ACTIVE_COUNT),
    staleTime: 30_000,
    refetchInterval: usesConvexForPolls() ? false : 30_000,
  })

  const activeSurveyCount = surveysActive?.count ?? 0
  const activePollCount = pollsActive?.count ?? 0

  const firstName = session?.user.name.split(' ')[0] ?? 'there'

  const statCards = [
    {
      title: 'Total Retros',
      value: stats?.totalRetros ?? 0,
      icon: HistoryIcon,
      color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20',
    },
    {
      title: 'Teams',
      value: stats?.totalTeams ?? 0,
      icon: Users,
      color:
        'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20',
    },
    {
      title: 'Cards Created',
      value: stats?.totalCards ?? 0,
      icon: LayoutDashboard,
      color:
        'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/20',
    },
    {
      title: 'Total Votes',
      value: stats?.totalVotes ?? 0,
      icon: ThumbsUp,
      color:
        'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/20',
    },
  ]

  const latestRetros = recentRetros?.slice(0, 5) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {firstName}
        </h2>
        <p className="text-muted-foreground">
          Here's what's happening with your retrospectives.
        </p>
      </div>

      {/* Active Surveys */}
      {activeSurveyCount > 0 && (
        <Card className="border-primary/40 bg-primary/5 animate-in fade-in">
          <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {activeSurveyCount === 1
                    ? '1 active survey needs your response'
                    : `${activeSurveyCount} active surveys need your response`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Share your feedback before they close.
                </p>
              </div>
            </div>
            <Link
              to="/surveys"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Respond now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {activePollCount > 0 && (
        <Card className="border-primary/40 bg-primary/5 animate-in fade-in">
          <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Vote className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {activePollCount === 1
                    ? '1 active poll needs your vote'
                    : `${activePollCount} active polls need your vote`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cast your vote before they close.
                </p>
              </div>
            </div>
            <Link
              to="/polls"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Vote now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats — compact row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                {statsLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <div className="text-xl font-bold leading-none">
                    {stat.value}
                  </div>
                )}
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {stat.title}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Retros */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HistoryIcon className="h-5 w-5" />
                Recent Retrospectives
              </CardTitle>
              <CardDescription>Your latest retros</CardDescription>
            </div>
            <Link
              to="/retros"
              search={{ page: 1, limit: 6 }}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {retrosLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : latestRetros.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <HistoryIcon className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No retrospectives yet.
                </p>
                <Link
                  to="/retros/new"
                  className="mt-3 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Create your first retro
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {latestRetros.map((retro) => (
                  <Link
                    key={retro.id}
                    to="/retros/$retroId"
                    params={{ retroId: retro.id }}
                    className="flex items-center justify-between rounded-lg p-2 hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {retro.teamEmoji && (
                          <span className="text-sm">{retro.teamEmoji}</span>
                        )}
                        <p className="text-sm font-medium truncate">
                          {retro.name}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {retro.teamName} ·{' '}
                        {new Date(retro.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`ml-3 shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[retro.status] ?? ''}`}
                    >
                      {retro.status.charAt(0).toUpperCase() +
                        retro.status.slice(1)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Jump to common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                to: '/retros/new' as const,
                icon: HistoryIcon,
                label: 'Start a Retrospective',
              },
              {
                to: '/estimate/new' as const,
                icon: Spade,
                label: 'New Story Estimate',
              },
              {
                to: '/retros' as const,
                icon: HistoryIcon,
                label: 'View All Retros',
              },
              {
                to: '/reports' as const,
                icon: BarChart3,
                label: 'Team Reports',
              },
            ].map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className="flex w-full items-center justify-between rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
