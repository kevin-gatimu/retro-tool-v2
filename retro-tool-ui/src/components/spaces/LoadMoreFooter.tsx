import { ChevronDown, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface LoadMoreFooterProps {
  /** Number of completed items currently loaded. */
  loaded: number
  /** Total completed items on the server. */
  total: number
  hasMore: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  /** Noun for the items, e.g. "completed retrospectives". */
  label?: string
}

/**
 * Footer shown below a grouped session list when completed items are
 * server-paginated. Reports loaded/total and offers a "Load more" button.
 * Render nothing when there are no completed items at all.
 */
export function LoadMoreFooter({
  loaded,
  total,
  hasMore,
  isFetchingNextPage,
  onLoadMore,
  label = 'completed',
}: LoadMoreFooterProps) {
  if (total === 0) return null

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p className="text-xs text-muted-foreground">
        Showing {loaded} of {total} {label}
      </p>
      {hasMore && (
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="gap-1"
        >
          {isFetchingNextPage ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
