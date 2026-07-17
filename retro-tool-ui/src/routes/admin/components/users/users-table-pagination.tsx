import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/**
 * "Showing X of Y users" pagination footer shared by the system-admin users
 * table and the org-member table. Presentational: the route owns page/pageSize
 * state and decides what happens on page change (e.g. clearing row selection).
 */
export function UsersTablePagination({
  shownCount,
  totalUsers,
  page,
  totalPages,
  pageSize,
  showAllRows,
  isFetching,
  onPrevPage,
  onNextPage,
  onPageSizeChange,
  onShowAll,
  onRefresh,
}: {
  shownCount: number
  totalUsers: number
  page: number
  totalPages: number
  pageSize: number
  showAllRows: boolean
  isFetching: boolean
  onPrevPage: () => void
  onNextPage: () => void
  onPageSizeChange: (size: number) => void
  onShowAll: () => void
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Showing {shownCount} of {totalUsers} users
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows</span>
          <Select
            value={showAllRows ? 'all' : String(pageSize)}
            onValueChange={(value) => {
              if (value === 'all') {
                onShowAll()
              } else {
                onPageSizeChange(Number(value))
              }
            }}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
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
          onClick={onPrevPage}
          disabled={page <= 1 || isFetching}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={onNextPage}
          disabled={page >= totalPages || isFetching}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>
    </div>
  )
}
