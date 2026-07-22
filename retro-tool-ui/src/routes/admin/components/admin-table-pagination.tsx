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
 * Bordered "Showing X of Y" pagination footer used by all three admin template
 * tables. Presentational: the parent owns page/pageSize state and the refresh
 * action. (Distinct from the user-facing `@/components/pagination-bar` layout.)
 */
export function AdminTablePagination({
  shownCount,
  total,
  page,
  totalPages,
  pageSize,
  isFetching,
  onPageChange,
  onPageSizeChange,
  onRefresh,
}: {
  shownCount: number
  total: number
  page: number
  totalPages: number
  pageSize: number
  isFetching: boolean
  onPageChange: (updater: (prev: number) => number) => void
  onPageSizeChange: (size: number) => void
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Showing {shownCount} of {total} template{total === 1 ? '' : 's'}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
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
          onClick={() => onPageChange((prev) => Math.max(1, prev - 1))}
          disabled={page <= 1 || isFetching}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange((prev) => Math.min(totalPages, prev + 1))}
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
