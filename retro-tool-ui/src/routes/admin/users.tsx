import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  History as HistoryIcon,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Star,
  User,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getUserColumns,
  RoleBadge,
  StatusBadge,
} from '@/components/tables/user-columns'
import type { UserRow } from '@/components/tables/user-columns'
import { UserAvatar } from '@/components/UserAvatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { FilterPills } from '@/components/ui/filter-pills'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { AdminUsersSkeleton } from '@/components/skeletons'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api } from '@/lib/api'
import {
  ORGANIZATIONS_ENDPOINTS,
  TEAMS_ENDPOINTS,
  USERS_ENDPOINTS,
} from '@/lib/api-endpoints'
import { isSuperAdmin, isSystemAdmin } from '@/lib/rbac'
import {
  useAdminActionLogQuery,
  useAdminUserMutations,
  useAdminUsersQuery,
  useBulkOrgTeamMutations,
} from './hooks'
import { ActionIcon, ActionLabel, formatDetails } from './helpers'
import type { UserDetails } from './types'

export const Route = createFileRoute('/admin/users')({
  pendingComponent: AdminUsersSkeleton,
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const { data: currentUser } = useCurrentUser()

  // State
  const [activeTab, setActiveTab] = useState('users')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [membershipFilter, setMembershipFilter] = useState('all')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Activity log pagination
  const [logPage, setLogPage] = useState(1)
  const [logPageSize, setLogPageSize] = useState(10)
  const [logDateRange, setLogDateRange] = useState<
    'today' | 'week' | 'month' | 'year' | 'all'
  >('all')
  const [logAdminRole, setLogAdminRole] = useState('all')

  // Modals
  const [suspendModalUser, setSuspendModalUser] = useState<UserRow | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [detailsModalUser, setDetailsModalUser] = useState<UserRow | null>(null)
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const [userDetailsError, setUserDetailsError] = useState(false)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserRow | null>(
    null,
  )
  const [bulkActionModal, setBulkActionModal] = useState<string | null>(null)
  const [bulkAddOrgOpen, setBulkAddOrgOpen] = useState(false)
  const [bulkAddTeamOpen, setBulkAddTeamOpen] = useState(false)
  const [bulkTargetOrgId, setBulkTargetOrgId] = useState('')
  const [bulkTargetTeamId, setBulkTargetTeamId] = useState('')

  const selectedUserIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  )

  const {
    statusMutation,
    roleMutation,
    suspendMutation,
    reactivateMutation,
    deleteMutation,
    bulkMutation,
    promoteToAdmin,
    demoteToMember,
  } = useAdminUserMutations({
    selectedUserIds,
    onSuspendSuccess: () => {
      setSuspendModalUser(null)
      setSuspendReason('')
    },
    onDeleteSuccess: () => setDeleteConfirmUser(null),
    onBulkSuccess: () => {
      setBulkActionModal(null)
      setRowSelection({})
    },
  })

  const activeSort = sorting.length > 0 ? sorting[0] : undefined
  const sortBy =
    activeSort?.id === 'user'
      ? 'name'
      : activeSort?.id === 'status'
        ? 'status'
        : activeSort?.id === 'role'
          ? 'role'
          : activeSort?.id === 'lastActiveAt'
            ? 'lastActiveAt'
            : undefined
  const sortOrder = activeSort ? (activeSort.desc ? 'desc' : 'asc') : undefined

  const usersQuery = useAdminUsersQuery({
    page,
    pageSize,
    search: debouncedSearch,
    membership: membershipFilter,
    sortBy,
    sortOrder,
  })

  const actionLogQuery = useAdminActionLogQuery({
    page: logPage,
    pageSize: logPageSize,
    dateRange: logDateRange === 'all' ? undefined : logDateRange,
    adminRole: logAdminRole === 'all' ? undefined : logAdminRole,
  })

  const orgsQuery = useQuery({
    queryKey: ['admin-orgs-list'],
    queryFn: () =>
      api.get<{ organizations: Array<{ id: string; name: string }> }>(
        `${ORGANIZATIONS_ENDPOINTS.LIST}?all=true&page=1&limit=500`,
      ),
    enabled: bulkAddOrgOpen || bulkAddTeamOpen,
    staleTime: 60_000,
  })

  const teamsQuery = useQuery({
    queryKey: ['admin-teams-list', bulkTargetOrgId],
    queryFn: () =>
      api.get<{ teams: Array<{ id: string; name: string }> }>(
        `${TEAMS_ENDPOINTS.LIST}?organizationId=${bulkTargetOrgId}&limit=500`,
      ),
    enabled: bulkAddTeamOpen && !!bulkTargetOrgId,
    staleTime: 60_000,
  })

  const { bulkAddToOrgMutation, bulkAddToTeamMutation } =
    useBulkOrgTeamMutations({
      selectedUserIds,
      bulkTargetOrgId,
      bulkTargetTeamId,
      onBulkAddOrgSuccess: () => {
        setBulkAddOrgOpen(false)
        setBulkTargetOrgId('')
        setRowSelection({})
      },
      onBulkAddTeamSuccess: () => {
        setBulkAddTeamOpen(false)
        setBulkTargetOrgId('')
        setBulkTargetTeamId('')
        setRowSelection({})
      },
    })

  const users = usersQuery.data?.users ?? []
  const totalUsers = usersQuery.data?.total ?? 0
  const totalPages = usersQuery.data?.totalPages ?? 1
  const showAllRows = totalUsers > 0 && pageSize >= totalUsers
  const stats = usersQuery.data?.stats ?? {
    pending: 0,
    approved: 0,
    suspended: 0,
    rejected: 0,
    admins: 0,
  }
  const actionLog = actionLogQuery.data?.logs ?? []
  const logTotal = actionLogQuery.data?.total ?? 0
  const logTotalPages = actionLogQuery.data?.totalPages ?? 1

  const loadUserDetails = useCallback(async (user: UserRow) => {
    setDetailsModalUser(user)
    setUserDetails(null)
    setUserDetailsError(false)
    try {
      const details = await api.get<UserDetails>(
        USERS_ENDPOINTS.DETAILS(user.id),
      )
      setUserDetails(details)
    } catch (error) {
      console.error('Failed to load user details:', error)
      setUserDetailsError(true)
    }
  }, [])

  const currentUserRole = currentUser?.role ?? 'member'
  const viewerIsSystemAdmin = isSystemAdmin(currentUserRole)
  const viewerIsSuperAdmin = isSuperAdmin(currentUserRole)

  const columns = useMemo(
    () =>
      getUserColumns({
        currentUserId: currentUser?.id ?? '',
        currentUserRole,
        onApprove: (userId) =>
          statusMutation.mutate({ userId, status: 'approved' }),
        onReject: (userId) =>
          statusMutation.mutate({ userId, status: 'rejected' }),
        onSuspend: (user) => setSuspendModalUser(user),
        onReactivate: (userId) => reactivateMutation.mutate(userId),
        onPromoteSystemAdmin: (userId) => promoteToAdmin(userId),
        onDemoteToMember: (userId) => demoteToMember(userId),
        onViewDetails: (user) => loadUserDetails(user),
        onDelete: (user) => setDeleteConfirmUser(user),
      }),
    [
      currentUser?.id,
      currentUserRole,
      statusMutation,
      reactivateMutation,
      roleMutation,
      loadUserDetails,
    ],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {viewerIsSystemAdmin ? 'User Management' : 'Organization Members'}
          </h1>
          <p className="text-muted-foreground">
            {viewerIsSystemAdmin
              ? 'Manage user accounts, permissions, and access'
              : 'View members in your organizations'}
          </p>
        </div>
        {viewerIsSystemAdmin && selectedUserIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedUserIds.length} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkActionModal('approve')}
            >
              <UserCheck className="mr-1 h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkActionModal('suspend')}
            >
              <Ban className="mr-1 h-4 w-4" />
              Suspend
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkAddOrgOpen(true)}
            >
              <Building2 className="mr-1 h-4 w-4" />
              Add to Org
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkAddTeamOpen(true)}
            >
              <Users className="mr-1 h-4 w-4" />
              Add to Team
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRowSelection({})}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {viewerIsSystemAdmin && (
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
      )}

      {/* Tabs or plain table */}
      {viewerIsSystemAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="activity">
              <HistoryIcon className="mr-2 h-4 w-4" />
              Activity Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="relative">
              {usersQuery.isFetching && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              <div className="mb-4 flex items-center gap-3">
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="pl-9 h-8"
                  />
                </div>
                <FilterPills
                  ariaLabel="Filter users by membership"
                  value={membershipFilter}
                  onChange={(v) => {
                    setMembershipFilter(v)
                    setPage(1)
                    setRowSelection({})
                  }}
                  options={[
                    {
                      value: 'all',
                      label: 'All users',
                      description: 'Every registered user',
                    },
                    {
                      value: 'no-org',
                      label: 'No organization',
                      description: 'Users not in any organization',
                    },
                    {
                      value: 'no-team',
                      label: 'No team',
                      description: 'Users not assigned to any team',
                    },
                  ]}
                />
              </div>
              <DataTable
                columns={columns}
                data={users as unknown as UserRow[]}
                pagination={false}
                manualSorting
                sorting={sorting}
                onSortingChange={(nextSorting) => {
                  setSorting(nextSorting)
                  setPage(1)
                  setRowSelection({})
                }}
                selectable
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                getRowId={(row) => row.id}
              />
            </div>
            <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {users.length} of {totalUsers} users
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows</span>
                  <Select
                    value={showAllRows ? 'all' : String(pageSize)}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        setPageSize(Math.max(totalUsers, 1))
                      } else {
                        setPageSize(Number(value))
                      }
                      setPage(1)
                      setRowSelection({})
                    }}
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
                      {totalUsers > 0 && (
                        <SelectItem value="all">All</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setPage((prev) => Math.max(1, prev - 1))
                    setRowSelection({})
                  }}
                  disabled={page <= 1 || usersQuery.isFetching}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setPage((prev) => Math.min(totalPages, prev + 1))
                    setRowSelection({})
                  }}
                  disabled={page >= totalPages || usersQuery.isFetching}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => usersQuery.refetch()}
                  disabled={usersQuery.isFetching}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${usersQuery.isFetching ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </TabsContent>

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
                      onValueChange={(v) => {
                        setLogDateRange(v as typeof logDateRange)
                        setLogPage(1)
                      }}
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
                    <Select
                      value={logAdminRole}
                      onValueChange={(v) => {
                        setLogAdminRole(v)
                        setLogPage(1)
                      }}
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue placeholder="All roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        <SelectItem value="org-admin">Org Admins</SelectItem>
                        <SelectItem value="system-admin">
                          System Admins
                        </SelectItem>
                        {viewerIsSuperAdmin && (
                          <SelectItem value="super-admin">
                            Super Admins
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {actionLogQuery.isLoading ? (
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
                            <span className="font-medium">
                              {log.admin?.name}
                            </span>{' '}
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
                    onValueChange={(value) => {
                      setLogPageSize(Number(value))
                      setLogPage(1)
                    }}
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
                  onClick={() => actionLogQuery.refetch()}
                  disabled={actionLogQuery.isFetching}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${actionLogQuery.isFetching ? 'animate-spin' : ''}`}
                  />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setLogPage((prev) => Math.max(1, prev - 1))}
                  disabled={logPage <= 1 || actionLogQuery.isFetching}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setLogPage((prev) => Math.min(logTotalPages, prev + 1))
                  }
                  disabled={
                    logPage >= logTotalPages || actionLogQuery.isFetching
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            {usersQuery.isFetching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <DataTable
              columns={columns}
              data={users as unknown as UserRow[]}
              searchColumn="user"
              searchPlaceholder="Search members..."
              pagination={false}
              manualSorting
              sorting={sorting}
              onSortingChange={(nextSorting) => {
                setSorting(nextSorting)
                setPage(1)
                setRowSelection({})
              }}
            />
          </div>
          <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {users.length} of {totalUsers} users
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows</span>
                <Select
                  value={showAllRows ? 'all' : String(pageSize)}
                  onValueChange={(value) => {
                    if (value === 'all') {
                      setPageSize(Math.max(totalUsers, 1))
                    } else {
                      setPageSize(Number(value))
                    }
                    setPage(1)
                  }}
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
                    {totalUsers > 0 && <SelectItem value="all">All</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || usersQuery.isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={page >= totalPages || usersQuery.isFetching}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => usersQuery.refetch()}
                disabled={usersQuery.isFetching}
              >
                <RefreshCw
                  className={`h-4 w-4 ${usersQuery.isFetching ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend User Modal */}
      {viewerIsSystemAdmin && (
        <Dialog
          open={!!suspendModalUser}
          onOpenChange={() => setSuspendModalUser(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suspend User</DialogTitle>
              <DialogDescription>
                Suspend {suspendModalUser?.name}'s account. They will not be
                able to access the system until reactivated.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (suspendModalUser && !suspendMutation.isPending)
                  suspendMutation.mutate({
                    userId: suspendModalUser.id,
                    reason: suspendReason,
                  })
              }}
            >
              <div className="py-4">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for suspension..."
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="mt-2"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSuspendModalUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={suspendMutation.isPending}
                >
                  {suspendMutation.isPending ? 'Suspending...' : 'Suspend User'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* User Details Modal */}
      <Dialog
        open={!!detailsModalUser}
        onOpenChange={() => {
          setDetailsModalUser(null)
          setUserDetails(null)
          setUserDetailsError(false)
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {userDetails ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <UserAvatar
                  image={userDetails.user.image}
                  name={userDetails.user.name}
                  userId={userDetails.user.id}
                  size="xl"
                />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {userDetails.user.name}
                  </h3>
                  <p className="text-muted-foreground">
                    {userDetails.user.email}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge status={userDetails.user.status} />
                    <RoleBadge role={userDetails.user.role} />
                  </div>
                </div>
              </div>

              {userDetails.user.bio && (
                <div>
                  <h4 className="mb-1 font-medium">Bio</h4>
                  <p className="text-sm text-muted-foreground">
                    {userDetails.user.bio}
                  </p>
                </div>
              )}

              {userDetails.user.status === 'suspended' && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/20">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Account Suspended</span>
                  </div>
                  {userDetails.user.suspendedReason && (
                    <p className="mt-1 text-sm text-orange-600 dark:text-orange-300">
                      Reason: {userDetails.user.suspendedReason}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Suspended on{' '}
                    {userDetails.user.suspendedAt
                      ? new Date(userDetails.user.suspendedAt).toLocaleString()
                      : 'Unknown'}
                  </p>
                </div>
              )}

              <Separator />

              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium">
                  <Building2 className="h-4 w-4" />
                  Organizations ({userDetails.organizations.length})
                </h4>
                {userDetails.organizations.length > 0 ? (
                  <div className="space-y-2">
                    {userDetails.organizations.map((om) => (
                      <div
                        key={om.id}
                        className="flex items-center justify-between rounded bg-muted p-2"
                      >
                        <span>{om.organization.name}</span>
                        {om.role === 'org-owner' ? (
                          <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <Crown className="h-3 w-3" />
                            Org Owner
                          </Badge>
                        ) : om.role === 'org-admin' ? (
                          <Badge className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            <Shield className="h-3 w-3" />
                            Org Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <User className="h-3 w-3" />
                            Member
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not a member of any organizations
                  </p>
                )}
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium">
                  <Users className="h-4 w-4" />
                  Teams ({userDetails.teams.length})
                </h4>
                {userDetails.teams.length > 0 ? (
                  <div className="space-y-2">
                    {userDetails.teams.map((tm) => (
                      <div
                        key={tm.id}
                        className="flex items-center justify-between rounded bg-muted p-2"
                      >
                        <div>
                          <span>{tm.team.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({tm.team.organization.name})
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {tm.tag === 'team-lead' ? (
                            <Badge className="gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              <Star className="h-3 w-3" />
                              Team Lead
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <User className="h-3 w-3" />
                              Member
                            </Badge>
                          )}
                          {tm.role && (
                            <Badge variant="outline" className="text-xs">
                              {tm.role}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not a member of any teams
                  </p>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium">
                  <HistoryIcon className="h-4 w-4" />
                  Admin Action History
                </h4>
                {userDetails.actionHistory.length > 0 ? (
                  <div className="space-y-2">
                    {userDetails.actionHistory.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <ActionIcon action={log.action} />
                        <span>
                          <ActionLabel action={log.action} /> by{' '}
                          {log.admin?.name}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No admin actions on this user
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Joined:</span>{' '}
                  {new Date(userDetails.user.createdAt).toLocaleDateString()}
                </div>
                {userDetails.user.lastActiveAt && (
                  <div>
                    <span className="text-muted-foreground">Last Active:</span>{' '}
                    {new Date(
                      userDetails.user.lastActiveAt,
                    ).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ) : userDetailsError ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <XCircle className="h-6 w-6 text-destructive" />
              <p className="text-sm">Failed to load user details.</p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      {viewerIsSystemAdmin && (
        <AlertDialog
          open={!!deleteConfirmUser}
          onOpenChange={() => setDeleteConfirmUser(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {deleteConfirmUser?.name}'s account
                and all associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteConfirmUser &&
                  deleteMutation.mutate(deleteConfirmUser.id)
                }
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Bulk Action Confirmation */}
      {viewerIsSystemAdmin && (
        <AlertDialog
          open={!!bulkActionModal}
          onOpenChange={() => setBulkActionModal(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bulkActionModal === 'approve'
                  ? 'Approve Selected Users?'
                  : 'Suspend Selected Users?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will{' '}
                {bulkActionModal === 'approve' ? 'approve' : 'suspend'}{' '}
                {selectedUserIds.length} selected users.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  bulkMutation.mutate({
                    status:
                      bulkActionModal === 'approve' ? 'approved' : 'suspended',
                  })
                }
              >
                {bulkActionModal === 'approve' ? 'Approve All' : 'Suspend All'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Bulk Add to Org */}
      <Dialog open={bulkAddOrgOpen} onOpenChange={setBulkAddOrgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {selectedUserIds.length} user(s) to Organisation
            </DialogTitle>
            <DialogDescription>
              Select the target organisation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Organisation</Label>
            <Select value={bulkTargetOrgId} onValueChange={setBulkTargetOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Select organisation…" />
              </SelectTrigger>
              <SelectContent>
                {(orgsQuery.data?.organizations ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAddOrgOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => bulkAddToOrgMutation.mutate()}
              disabled={!bulkTargetOrgId || bulkAddToOrgMutation.isPending}
            >
              {bulkAddToOrgMutation.isPending
                ? 'Adding…'
                : 'Add to Organisation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add to Team */}
      <Dialog open={bulkAddTeamOpen} onOpenChange={setBulkAddTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {selectedUserIds.length} user(s) to Team
            </DialogTitle>
            <DialogDescription>
              Select the organisation, then the team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Organisation</Label>
              <Select
                value={bulkTargetOrgId}
                onValueChange={(v) => {
                  setBulkTargetOrgId(v)
                  setBulkTargetTeamId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organisation…" />
                </SelectTrigger>
                <SelectContent>
                  {(orgsQuery.data?.organizations ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bulkTargetOrgId && (
              <div className="space-y-1">
                <Label>Team</Label>
                <Select
                  value={bulkTargetTeamId}
                  onValueChange={setBulkTargetTeamId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(teamsQuery.data?.teams ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAddTeamOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => bulkAddToTeamMutation.mutate()}
              disabled={!bulkTargetTeamId || bulkAddToTeamMutation.isPending}
            >
              {bulkAddToTeamMutation.isPending ? 'Adding…' : 'Add to Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
