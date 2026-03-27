import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowRight,
  Ban,
  Building2,
  Clock,
  FileText,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react'

import { ADMIN_ACTION_LOG_ACTIONS } from '@/common/enums'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AdminDashboardSkeleton } from '@/components/skeletons'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import { AdminNav } from './helpers'

type AdminUsersStats = {
  total: number
  stats?: {
    pending: number
    approved: number
    rejected: number
    suspended: number
    admins: number
  }
}

type AdminActionLogEntry = {
  id: string
  action: string
  createdAt: string | Date
  admin?: { name: string } | null
  targetUser?: { name: string } | null
}

const adminUsersQueryOptions = {
  queryKey: ['admin-users', 1, 1, undefined, undefined] as const,
  queryFn: () =>
    api.get<AdminUsersStats>(`${USERS_ENDPOINTS.LIST}?page=1&limit=1`),
}

const adminActionLogQueryOptions = {
  queryKey: ['admin-action-log'] as const,
  queryFn: () =>
    api
      .get<{
        logs: AdminActionLogEntry[]
      }>(`${USERS_ENDPOINTS.ADMIN_LOGS}?limit=5`)
      .then((r) => r.logs),
}

export const Route = createFileRoute('/admin/')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(adminUsersQueryOptions),
      queryClient.ensureQueryData(adminActionLogQueryOptions),
    ]),
  pendingComponent: AdminDashboardSkeleton,
  component: AdminDashboardPage,
})

function AdminDashboardPage() {
  const usersQuery = useSuspenseQuery(adminUsersQueryOptions)

  const actionLogQuery = useSuspenseQuery(adminActionLogQueryOptions)

  const {
    stats = { pending: 0, approved: 0, rejected: 0, suspended: 0, admins: 0 },
    total,
  } = usersQuery.data
  const recentActions = actionLogQuery.data

  const statCards = [
    {
      title: 'Total Users',
      value: total,
      icon: Users,
      description: 'All registered users',
      color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20',
    },
    {
      title: 'Approved',
      value: stats.approved,
      icon: UserCheck,
      description: 'Active approved users',
      color:
        'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20',
    },
    {
      title: 'Pending',
      value: stats.pending,
      icon: Clock,
      description: 'Awaiting approval',
      color:
        'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20',
    },
    {
      title: 'Rejected',
      value: stats.rejected,
      icon: UserX,
      description: 'Denied access',
      color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20',
    },
    {
      title: 'Suspended',
      value: stats.suspended,
      icon: Ban,
      description: 'Temporarily disabled',
      color:
        'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20',
    },
    {
      title: 'Admins',
      value: stats.admins,
      icon: Shield,
      description: 'Administrator accounts',
      color:
        'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/20',
    },
  ]

  const getActionIcon = (action: string) => {
    if (action === ADMIN_ACTION_LOG_ACTIONS.UserApproved) return UserCheck
    if (action === ADMIN_ACTION_LOG_ACTIONS.UserRejected) return UserX
    if (action === ADMIN_ACTION_LOG_ACTIONS.UserSuspended) return Ban
    if (action === ADMIN_ACTION_LOG_ACTIONS.UserReactivated) return Activity
    return Users
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of system users and recent activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.pending > 0 && (
              <Button
                asChild
                className="w-full justify-between"
                variant="outline"
              >
                <Link to="/admin/users">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Review {stats.pending} pending user
                    {stats.pending > 1 ? 's' : ''}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button
              asChild
              className="w-full justify-between"
              variant="outline"
            >
              <Link to="/admin/users">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Manage All Users
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              className="w-full justify-between"
              variant="outline"
            >
              <Link to="/admin/organizations">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Manage Organizations
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              className="w-full justify-between"
              variant="outline"
            >
              <Link to="/admin/templates">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Manage Retro Templates
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest administrative actions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent activity
              </p>
            ) : (
              <div className="space-y-4">
                {recentActions.map((action) => {
                  const ActionIcon = getActionIcon(action.action)
                  return (
                    <div
                      key={action.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <div className="rounded-full bg-muted p-1.5">
                        <ActionIcon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p>{action.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(action.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
