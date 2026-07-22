import { createFileRoute } from '@tanstack/react-router'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { History as HistoryIcon, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getUserColumns } from '@/components/tables/user-columns'
import type { UserRow } from '@/components/tables/user-columns'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminUsersSkeleton } from './skeleton'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isSuperAdmin, isSystemAdmin } from '@/lib/rbac'
import {
  useAdminActionLogQuery,
  useAdminOrgOptions,
  useAdminTeamOptions,
  useAdminUserMutations,
  useAdminUsersQuery,
  useBulkOrgTeamMutations,
  useUserDetailsModal,
} from './hooks'
import {
  ActivityLogTab,
  BulkActionDialog,
  BulkAddOrgDialog,
  BulkAddTeamDialog,
  DeleteUserDialog,
  OrgMembersTable,
  SuspendUserDialog,
  UserDetailsDialog,
  UsersPageHeader,
  UsersTab,
  UserStatsCards,
} from './components'

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
  const {
    detailsModalUser,
    userDetails,
    userDetailsError,
    loadUserDetails,
    closeUserDetails,
  } = useUserDetailsModal()
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

  const orgsQuery = useAdminOrgOptions(bulkAddOrgOpen || bulkAddTeamOpen)

  const teamsQuery = useAdminTeamOptions({
    organizationId: bulkTargetOrgId,
    enabled: bulkAddTeamOpen,
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
  // The API user shape has `image`/`lastActiveAt` optional; the table's UserRow
  // wants them present (nullable). Normalize explicitly instead of casting.
  const userRows: UserRow[] = useMemo(
    () =>
      users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image ?? null,
        status: user.status,
        role: user.role,
        lastActiveAt: user.lastActiveAt ?? null,
        createdAt: user.createdAt,
      })),
    [users],
  )
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

  const handleSortingChange = (nextSorting: SortingState) => {
    setSorting(nextSorting)
    setPage(1)
    setRowSelection({})
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
    setRowSelection({})
  }

  const handleShowAll = () => {
    setPageSize(Math.max(totalUsers, 1))
    setPage(1)
    setRowSelection({})
  }

  return (
    <div className="space-y-6">
      <UsersPageHeader
        viewerIsSystemAdmin={viewerIsSystemAdmin}
        selectedCount={selectedUserIds.length}
        onBulkApprove={() => setBulkActionModal('approve')}
        onBulkSuspend={() => setBulkActionModal('suspend')}
        onBulkAddOrg={() => setBulkAddOrgOpen(true)}
        onBulkAddTeam={() => setBulkAddTeamOpen(true)}
        onClearSelection={() => setRowSelection({})}
      />

      {viewerIsSystemAdmin && <UserStatsCards stats={stats} />}

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

          <UsersTab
            columns={columns}
            userRows={userRows}
            shownCount={users.length}
            totalUsers={totalUsers}
            totalPages={totalPages}
            page={page}
            pageSize={pageSize}
            showAllRows={showAllRows}
            isFetching={usersQuery.isFetching}
            search={search}
            onSearchChange={setSearch}
            membershipFilter={membershipFilter}
            onMembershipFilterChange={(v) => {
              setMembershipFilter(v)
              setPage(1)
              setRowSelection({})
            }}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onPrevPage={() => {
              setPage((prev) => Math.max(1, prev - 1))
              setRowSelection({})
            }}
            onNextPage={() => {
              setPage((prev) => Math.min(totalPages, prev + 1))
              setRowSelection({})
            }}
            onPageSizeChange={handlePageSizeChange}
            onShowAll={handleShowAll}
            onRefresh={() => usersQuery.refetch()}
          />

          <ActivityLogTab
            actionLog={actionLog}
            logTotal={logTotal}
            logPage={logPage}
            logTotalPages={logTotalPages}
            logPageSize={logPageSize}
            isLoading={actionLogQuery.isLoading}
            isFetching={actionLogQuery.isFetching}
            logDateRange={logDateRange}
            onLogDateRangeChange={(v) => {
              setLogDateRange(v)
              setLogPage(1)
            }}
            logAdminRole={logAdminRole}
            onLogAdminRoleChange={(v) => {
              setLogAdminRole(v)
              setLogPage(1)
            }}
            viewerIsSuperAdmin={viewerIsSuperAdmin}
            onLogPageSizeChange={(size) => {
              setLogPageSize(size)
              setLogPage(1)
            }}
            onPrevPage={() => setLogPage((prev) => Math.max(1, prev - 1))}
            onNextPage={() =>
              setLogPage((prev) => Math.min(logTotalPages, prev + 1))
            }
            onRefresh={() => actionLogQuery.refetch()}
          />
        </Tabs>
      ) : (
        <OrgMembersTable
          columns={columns}
          userRows={userRows}
          shownCount={users.length}
          totalUsers={totalUsers}
          totalPages={totalPages}
          page={page}
          pageSize={pageSize}
          showAllRows={showAllRows}
          isFetching={usersQuery.isFetching}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          onShowAll={() => {
            setPageSize(Math.max(totalUsers, 1))
            setPage(1)
          }}
          onRefresh={() => usersQuery.refetch()}
        />
      )}

      {viewerIsSystemAdmin && (
        <SuspendUserDialog
          suspendModalUser={suspendModalUser}
          onClose={() => setSuspendModalUser(null)}
          suspendReason={suspendReason}
          onSuspendReasonChange={setSuspendReason}
          suspendMutation={suspendMutation}
        />
      )}

      <UserDetailsDialog
        detailsModalUser={detailsModalUser}
        userDetails={userDetails}
        userDetailsError={userDetailsError}
        onClose={closeUserDetails}
      />

      {viewerIsSystemAdmin && (
        <DeleteUserDialog
          deleteConfirmUser={deleteConfirmUser}
          onClose={() => setDeleteConfirmUser(null)}
          deleteMutation={deleteMutation}
        />
      )}

      {viewerIsSystemAdmin && (
        <BulkActionDialog
          bulkActionModal={bulkActionModal}
          onClose={() => setBulkActionModal(null)}
          selectedCount={selectedUserIds.length}
          bulkMutation={bulkMutation}
        />
      )}

      <BulkAddOrgDialog
        open={bulkAddOrgOpen}
        onOpenChange={setBulkAddOrgOpen}
        selectedCount={selectedUserIds.length}
        orgs={orgsQuery.data?.organizations ?? []}
        bulkTargetOrgId={bulkTargetOrgId}
        onBulkTargetOrgIdChange={setBulkTargetOrgId}
        bulkAddToOrgMutation={bulkAddToOrgMutation}
      />

      <BulkAddTeamDialog
        open={bulkAddTeamOpen}
        onOpenChange={setBulkAddTeamOpen}
        selectedCount={selectedUserIds.length}
        orgs={orgsQuery.data?.organizations ?? []}
        teams={teamsQuery.data?.teams ?? []}
        bulkTargetOrgId={bulkTargetOrgId}
        onBulkTargetOrgIdChange={setBulkTargetOrgId}
        bulkTargetTeamId={bulkTargetTeamId}
        onBulkTargetTeamIdChange={setBulkTargetTeamId}
        bulkAddToTeamMutation={bulkAddToTeamMutation}
      />
    </div>
  )
}
