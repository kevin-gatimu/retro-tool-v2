import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Pagination, usePagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ============================================================================
// DataListItem - A compact row component
// ============================================================================

interface DataListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean
  interactive?: boolean
}

const DataListItem = React.forwardRef<HTMLDivElement, DataListItemProps>(
  ({ className, selected, interactive = true, children, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          selected && 'ring-2 ring-primary',
          interactive && 'hover:bg-accent/50 transition-colors',
          className,
        )}
        {...props}
      >
        <CardContent className="flex items-center gap-3 py-1.5 px-3">
          {children}
        </CardContent>
      </Card>
    )
  },
)
DataListItem.displayName = 'DataListItem'

// ============================================================================
// DataListItemSection - Layout sections within a row
// ============================================================================

interface DataListItemSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Fixed width for the section (e.g., "w-8", "w-24") */
  width?: string
  /** Whether this section should grow to fill available space */
  grow?: boolean
  /** Hide on smaller screens */
  hiddenOnMobile?: boolean
  /** Alignment */
  align?: 'left' | 'center' | 'right'
}

const DataListItemSection = React.forwardRef<
  HTMLDivElement,
  DataListItemSectionProps
>(
  (
    {
      className,
      width,
      grow,
      hiddenOnMobile,
      align = 'left',
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'shrink-0',
          width,
          grow && 'flex-1 min-w-0',
          hiddenOnMobile && 'hidden md:block',
          align === 'center' && 'text-center',
          align === 'right' && 'text-right',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
DataListItemSection.displayName = 'DataListItemSection'

// ============================================================================
// DataList - Container with optional pagination
// ============================================================================

interface DataListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T, index: number) => string
  /** Enable pagination */
  paginated?: boolean
  /** Default page size when paginated */
  defaultPageSize?: number
  /** Page size options */
  pageSizeOptions?: number[]
  /** Gap between items */
  gap?: 'none' | 'xs' | 'sm' | 'md'
  /** Empty state content */
  emptyState?: React.ReactNode
  /** Loading state */
  loading?: boolean
  /** Number of skeleton rows to show when loading */
  loadingRows?: number
  /** Additional class name */
  className?: string
  /** Header content (column labels) */
  header?: React.ReactNode
}

function DataList<T>({
  items,
  renderItem,
  keyExtractor,
  paginated = false,
  defaultPageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  gap = 'xs',
  emptyState,
  loading = false,
  loadingRows = 5,
  className,
  header,
}: DataListProps<T>) {
  const pagination = usePagination(items, defaultPageSize)
  const displayItems = paginated ? pagination.paginatedItems : items

  const gapClass = {
    none: 'gap-0',
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
  }[gap]

  if (loading) {
    return (
      <div className={cn('flex flex-col', gapClass, className)}>
        {header}
        {Array.from({ length: loadingRows }).map((_, i) => (
          <DataListItemSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={className}>
        {header}
        {emptyState || (
          <div className="py-8 text-center text-muted-foreground">
            No items found
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className={cn('flex flex-col', gapClass)}>
        {header}
        {displayItems.map((item, index) => (
          <React.Fragment key={keyExtractor(item, index)}>
            {renderItem(item, index)}
          </React.Fragment>
        ))}
      </div>

      {paginated && items.length > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.setPageSize}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  )
}

// ============================================================================
// DataListItemSkeleton - Loading placeholder
// ============================================================================

function DataListItemSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-3 py-1.5 px-3">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-5 w-16 hidden md:block" />
        <Skeleton className="h-8 w-8" />
      </CardContent>
    </Card>
  )
}

// ============================================================================
// DataListHeader - Column headers for the list
// ============================================================================

type DataListHeaderProps = React.HTMLAttributes<HTMLDivElement>

const DataListHeader = React.forwardRef<HTMLDivElement, DataListHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-3 px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
DataListHeader.displayName = 'DataListHeader'

// ============================================================================
// Exports
// ============================================================================

export {
  DataList,
  DataListItem,
  DataListItemSection,
  DataListItemSkeleton,
  DataListHeader,
}
