import { Ban, CheckCircle, Clock, Crown, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { UsersPage } from '../../types'

/** Five-up summary of user counts by status shown to system admins. */
export function UserStatsCards({ stats }: { stats: UsersPage['stats'] }) {
  return (
    <div className="grid gap-2 md:grid-cols-5">
      <Card className="py-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-0 pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Pending
          </CardTitle>
          <Clock className="h-3.5 w-3.5 text-amber-500" />
        </CardHeader>
        <CardContent className="px-4 py-0">
          <div className="text-xl font-bold">{stats.pending}</div>
        </CardContent>
      </Card>
      <Card className="py-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-0 pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Active
          </CardTitle>
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        </CardHeader>
        <CardContent className="px-4 py-0">
          <div className="text-xl font-bold">{stats.approved}</div>
        </CardContent>
      </Card>
      <Card className="py-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-0 pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Suspended
          </CardTitle>
          <Ban className="h-3.5 w-3.5 text-orange-500" />
        </CardHeader>
        <CardContent className="px-4 py-0">
          <div className="text-xl font-bold">{stats.suspended}</div>
        </CardContent>
      </Card>
      <Card className="py-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-0 pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Rejected
          </CardTitle>
          <XCircle className="h-3.5 w-3.5 text-red-500" />
        </CardHeader>
        <CardContent className="px-4 py-0">
          <div className="text-xl font-bold">{stats.rejected}</div>
        </CardContent>
      </Card>
      <Card className="py-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-0 pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Admins
          </CardTitle>
          <Crown className="h-3.5 w-3.5 text-amber-500" />
        </CardHeader>
        <CardContent className="px-4 py-0">
          <div className="text-xl font-bold">{stats.admins}</div>
        </CardContent>
      </Card>
    </div>
  )
}
