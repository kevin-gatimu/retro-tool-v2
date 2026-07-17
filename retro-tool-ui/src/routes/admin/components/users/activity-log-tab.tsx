import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
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
import { TabsContent } from '@/components/ui/tabs'
import { ActionIcon, ActionLabel, formatDetails } from '../../helpers'
import type { ActionLogEntry } from '../../types'

type LogDateRange = 'today' | 'week' | 'month' | 'year' | 'all'

interface ActivityLogTabProps {
  actionLog: ActionLogEntry[]
  logTotal: number
  logPage: number
  logTotalPages: number
  logPageSize: number
  isLoading: boolean
  isFetching: boolean
  logDateRange: LogDateRange
  onLogDateRangeChange: (value: LogDateRange) => void
  logAdminRole: string
  onLogAdminRoleChange: (value: string) => void
  viewerIsSuperAdmin: boolean
  onLogPageSizeChange: (size: number) => void
  onPrevPage: () => void
  onNextPage: () => void
  onRefresh: () => void
}

export function ActivityLogTab({
  actionLog,
  logTotal,
  logPage,
  logTotalPages,
  logPageSize,
  isLoading,
  isFetching,
  logDateRange,
  onLogDateRangeChange,
  logAdminRole,
  onLogAdminRoleChange,
  viewerIsSuperAdmin,
  onLogPageSizeChange,
  onPrevPage,
  onNextPage,
  onRefresh,
}: ActivityLogTabProps) {
  return (
    <TabsContent value="activity">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Admin Actions</CardTitle>
              <CardDescription>
                Audit trail of administrative actions on user accounts
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={logDateRange}
                onValueChange={(v) => onLogDateRangeChange(v as LogDateRange)}
              >
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                  <SelectItem value="year">This year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={logAdminRole} onValueChange={onLogAdminRoleChange}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="org-admin">Org Admins</SelectItem>
                  <SelectItem value="system-admin">System Admins</SelectItem>
                  {viewerIsSuperAdmin && (
                    <SelectItem value="super-admin">Super Admins</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 border-b pb-4 last:border-0"
                >
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {actionLog.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 border-b pb-4 last:border-0"
                >
                  <div className="shrink-0">
                    <ActionIcon action={log.action} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{log.admin?.name}</span>{' '}
                      <ActionLabel action={log.action} />{' '}
                      <span className="font-medium">
                        {log.targetUser?.name}
                      </span>
                    </p>
                    {log.details && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDetails(JSON.stringify(log.details))}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}

              {actionLog.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  No admin actions recorded yet
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Activity Log Pagination */}
      <div className="mt-4 flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {actionLog.length} of {logTotal} actions
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <Select
              value={String(logPageSize)}
              onValueChange={(value) => onLogPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-muted-foreground">
            Page {logPage} of {logTotalPages}
            {' · '}
            {logTotal} action{logTotal === 1 ? '' : 's'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onRefresh}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onPrevPage}
            disabled={logPage <= 1 || isFetching}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onNextPage}
            disabled={logPage >= logTotalPages || isFetching}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </TabsContent>
  )
}
