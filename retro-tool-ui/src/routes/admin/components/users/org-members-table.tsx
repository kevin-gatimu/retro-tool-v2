import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import type { UserRow } from '@/components/tables/user-columns'
import { DataTable } from '@/components/ui/data-table'
import { UsersTablePagination } from './users-table-pagination'

interface OrgMembersTableProps {
  columns: ColumnDef<UserRow>[]
  userRows: UserRow[]
  shownCount: number
  totalUsers: number
  totalPages: number
  page: number
  pageSize: number
  showAllRows: boolean
  isFetching: boolean
  sorting: SortingState
  onSortingChange: (sorting: SortingState) => void
  onPrevPage: () => void
  onNextPage: () => void
  onPageSizeChange: (size: number) => void
  onShowAll: () => void
  onRefresh: () => void
}

/** Plain (non-tabbed) users table shown to org admins who are not system admins. */
export function OrgMembersTable({
  columns,
  userRows,
  shownCount,
  totalUsers,
  totalPages,
  page,
  pageSize,
  showAllRows,
  isFetching,
  sorting,
  onSortingChange,
  onPrevPage,
  onNextPage,
  onPageSizeChange,
  onShowAll,
  onRefresh,
}: OrgMembersTableProps) {
  return (
    <div className="space-y-4">
      <div className="relative">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        <DataTable
          columns={columns}
          data={userRows}
          searchColumn="user"
          searchPlaceholder="Search members..."
          pagination={false}
          manualSorting
          sorting={sorting}
          onSortingChange={onSortingChange}
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
    </div>
  )
}
