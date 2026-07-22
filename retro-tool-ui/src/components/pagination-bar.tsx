import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DEFAULT_PAGE_SIZE_OPTIONS = [6, 12, 24, 48]

/**
 * Rows-per-page + page navigation footer used by the Templates pages. Presentational:
 * the parent owns page/pageSize state and passes the current values plus change handlers.
 */
export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  isFetching,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  isFetching: boolean
  onPageChange: (p: number) => void
  onPageSizeChange: (size: number) => void
  onRefresh: () => void
  pageSizeOptions?: number[]
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(val) => onPageSizeChange(Number(val))}
        >
          <SelectTrigger className="h-8 w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>
          Page {page} of {totalPages} &middot; {total} templates
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
