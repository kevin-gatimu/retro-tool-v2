import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BarChart3,
  History as HistoryIcon,
  LayoutDashboard,
  Plus,
  Spade,
  ThumbsUp,
  Users,
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
import { RETROS_ENDPOINTS } from '@/lib/api-endpoints'
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
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(dashboardStatsQueryOptions),
      queryClient.ensureQueryData(dashboardRetrosQueryOptions),
    ]),
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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold">{stat.value}</div>
              )}
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
