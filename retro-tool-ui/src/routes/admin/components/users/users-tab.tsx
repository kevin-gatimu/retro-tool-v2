import type { Dispatch, SetStateAction } from 'react'
import type {
  ColumnDef,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { Loader2, Search } from 'lucide-react'
import type { UserRow } from '@/components/tables/user-columns'
import { DataTable } from '@/components/ui/data-table'
import { FilterPills } from '@/components/ui/filter-pills'
import { Input } from '@/components/ui/input'
import { TabsContent } from '@/components/ui/tabs'
import { UsersTablePagination } from './users-table-pagination'

interface UsersTabProps {
  columns: ColumnDef<UserRow>[]
  userRows: UserRow[]
  shownCount: number
  totalUsers: number
  totalPages: number
  page: number
  pageSize: number
  showAllRows: boolean
  isFetching: boolean
  search: string
  onSearchChange: (value: string) => void
  membershipFilter: string
  onMembershipFilterChange: (value: string) => void
  sorting: SortingState
  onSortingChange: (sorting: SortingState) => void
  rowSelection: RowSelectionState
  onRowSelectionChange: Dispatch<SetStateAction<RowSelectionState>>
  onPrevPage: () => void
  onNextPage: () => void
  onPageSizeChange: (size: number) => void
  onShowAll: () => void
  onRefresh: () => void
}

export function UsersTab({
  columns,
  userRows,
  shownCount,
  totalUsers,
  totalPages,
  page,
  pageSize,
  showAllRows,
  isFetching,
  search,
  onSearchChange,
  membershipFilter,
  onMembershipFilterChange,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  onPrevPage,
  onNextPage,
  onPageSizeChange,
  onShowAll,
  onRefresh,
}: UsersTabProps) {
  return (
    <TabsContent value="users" className="space-y-4">
      <div className="relative">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search users..."
              className="pl-9 h-8"
            />
          </div>
          <FilterPills
            ariaLabel="Filter users by membership"
            value={membershipFilter}
            onChange={onMembershipFilterChange}
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
          data={userRows}
          pagination={false}
          manualSorting
          sorting={sorting}
          onSortingChange={onSortingChange}
          selectable
          rowSelection={rowSelection}
          onRowSelectionChange={onRowSelectionChange}
          getRowId={(row) => row.id}
        />
      </div>
      <UsersTablePagination
        shownCount={shownCount}
        totalUsers={totalUsers}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        showAllRows={showAllRows}
        isFetching={isFetching}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onPageSizeChange={onPageSizeChange}
        onShowAll={onShowAll}
        onRefresh={onRefresh}
      />
    </TabsContent>
  )
}
