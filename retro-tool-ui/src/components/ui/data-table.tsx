import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  Table as TableType,
  VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// ============================================================================
// DataTable Props
// ============================================================================

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Enable row selection with checkboxes */
  selectable?: boolean
  /** Callback when selection changes (uncontrolled mode) */
  onSelectionChange?: (selectedRows: TData[]) => void
  /** Controlled row selection state */
  rowSelection?: RowSelectionState
  /** Callback for controlled row selection */
  onRowSelectionChange?: (rowSelection: RowSelectionState) => void
  /** Function to get unique row ID */
  getRowId?: (row: TData) => string
  /** Column ID to use for global search filter */
  searchColumn?: string
  /** Placeholder for search input */
  searchPlaceholder?: string
  /** Enable column visibility toggle */
  columnVisibility?: boolean
  /** Default page size */
  defaultPageSize?: number
  /** Page size options */
  pageSizeOptions?: number[]
  /** Show pagination */
  pagination?: boolean
  /** Compact row styling */
  compact?: boolean
  /** Custom empty state */
  emptyState?: React.ReactNode
  /** Additional toolbar content */
  toolbar?: React.ReactNode
  /** Additional class name for the table container */
  className?: string
  /** Controlled sorting state */
  sorting?: SortingState
  /** Callback for controlled sorting */
  onSortingChange?: (sorting: SortingState) => void
  /** Enable manual/server-side sorting */
  manualSorting?: boolean
  /** Callback to refresh data */
  onRefresh?: () => void
  /** Whether a refresh is in progress */
  isRefreshing?: boolean
  /** Enable manual/server-side pagination */
  manualPagination?: boolean
  /** Total page count (required when manualPagination is true) */
  pageCount?: number
  /** Total row count for display (used with manualPagination) */
  rowCount?: number
  /** Callback when pagination changes (used with manualPagination) */
  onPaginationChange?: (pagination: {
    pageIndex: number
    pageSize: number
  }) => void
  /** Controlled pagination state (used with manualPagination) */
  paginationState?: {
    pageIndex: number
    pageSize: number
  }
  /** Show loading skeleton rows inside the table */
  loading?: boolean
  /** Show a fetching overlay over existing data (use with keepPreviousData) */
  isFetching?: boolean
}

// ============================================================================
// DataTable Component
// ============================================================================

export function DataTable<TData, TValue>({
  columns: userColumns,
  data,
  selectable = false,
  onSelectionChange,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  getRowId,
  searchColumn,
  searchPlaceholder = 'Search...',
  columnVisibility: enableColumnVisibility = false,
  defaultPageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  pagination = true,
  compact = true,
  emptyState,
  toolbar,
  className,
  sorting: controlledSorting,
  onSortingChange,
  manualSorting = false,
  onRefresh,
  isRefreshing = false,
  manualPagination = false,
  pageCount,
  rowCount,
  onPaginationChange,
  paginationState: controlledPaginationState,
  loading = false,
  isFetching = false,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const [internalPaginationState, setInternalPaginationState] = React.useState({
    pageIndex: 0,
    pageSize: pagination ? defaultPageSize : Number.MAX_SAFE_INTEGER,
  })
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [internalRowSelection, setInternalRowSelection] =
    React.useState<RowSelectionState>({})

  const isSortingControlled = controlledSorting !== undefined
  const sorting = isSortingControlled ? controlledSorting : internalSorting

  // Keep a ref to always read the latest sorting state inside the controlled setter,
  // preventing stale-closure bugs when TanStack Table calls toggleSorting rapidly.
  const sortingRef = React.useRef<SortingState>(sorting)
  React.useEffect(() => {
    sortingRef.current = sorting
  }, [sorting])

  const setSorting = isSortingControlled
    ? (updater: SortingState | ((old: SortingState) => SortingState)) => {
        const current = sortingRef.current
        const newValue =
          typeof updater === 'function' ? updater(current) : updater
        sortingRef.current = newValue
        onSortingChange?.(newValue)
      }
    : setInternalSorting

  // Use controlled or uncontrolled row selection
  const isControlled = controlledRowSelection !== undefined
  const rowSelection = isControlled
    ? controlledRowSelection
    : internalRowSelection
  const setRowSelection = isControlled
    ? (
        updater:
          | RowSelectionState
          | ((old: RowSelectionState) => RowSelectionState),
      ) => {
        const newValue =
          typeof updater === 'function' ? updater(rowSelection) : updater
        onRowSelectionChange?.(newValue)
      }
    : setInternalRowSelection

  const isPaginationControlled = controlledPaginationState !== undefined
  const paginationState = isPaginationControlled
    ? controlledPaginationState
    : internalPaginationState

  // Build columns - don't add select column if user already provided one
  const hasSelectColumn = userColumns.some((col) => col.id === 'select')
  const columns = React.useMemo(() => {
    if (!selectable || hasSelectColumn) return userColumns

    const selectColumn: ColumnDef<TData, TValue> = {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }

    return [selectColumn, ...userColumns]
  }, [userColumns, selectable, hasSelectColumn])

  const handlePaginationChange = React.useCallback(
    (
      updater:
        | { pageIndex: number; pageSize: number }
        | ((old: { pageIndex: number; pageSize: number }) => {
            pageIndex: number
            pageSize: number
          }),
    ) => {
      if (isPaginationControlled) {
        const next =
          typeof updater === 'function' ? updater(paginationState) : updater
        onPaginationChange?.(next)
        return
      }

      setInternalPaginationState((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        onPaginationChange?.(next)
        return next
      })
    },
    [isPaginationControlled, onPaginationChange, paginationState],
  )

  const table = useReactTable({
    data,
    columns,
    getRowId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    ...(pagination && !manualPagination
      ? { getPaginationRowModel: getPaginationRowModel() }
      : {}),
    ...(manualSorting ? {} : { getSortedRowModel: getSortedRowModel() }),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    ...(manualPagination
      ? {
          manualPagination: true,
          pageCount: pageCount ?? -1,
          rowCount,
          onPaginationChange: handlePaginationChange,
        }
      : {}),
    initialState: {
      pagination: {
        pageSize: pagination ? defaultPageSize : Number.MAX_SAFE_INTEGER,
      },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(manualPagination ? { pagination: paginationState } : {}),
    },
  })

  // Notify parent of selection changes (uncontrolled mode only)
  React.useEffect(() => {
    if (onSelectionChange && !isControlled) {
      const selectedRows = table
        .getFilteredSelectedRowModel()
        .rows.map((row) => row.original)
      onSelectionChange(selectedRows)
    }
  }, [onSelectionChange, table, isControlled])

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Toolbar */}
      {(searchColumn || enableColumnVisibility || toolbar) && (
        <div className="flex items-center gap-2">
          {searchColumn && (
            <Input
              placeholder={searchPlaceholder}
              value={
                (table.getColumn(searchColumn)?.getFilterValue() as string) ||
                ''
              }
              onChange={(event) =>
                table
                  .getColumn(searchColumn)
                  ?.setFilterValue(event.target.value)
              }
              className="max-w-sm h-8"
            />
          )}
          {toolbar}
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto h-8">
                  Columns <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Table */}
      <div className="relative">
        {isFetching && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        className={compact ? 'py-2 px-3' : undefined}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({
                  length: Math.min(
                    table.getState().pagination.pageSize,
                    defaultPageSize,
                  ),
                }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {columns.map((__, j) => (
                      <TableCell
                        key={`skeleton-${i}-${j}`}
                        className={compact ? 'py-1.5 px-3' : undefined}
                      >
                        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={compact ? 'py-1.5 px-3' : undefined}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {emptyState || 'No results.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && (
        <DataTablePagination
          table={table}
          pageSizeOptions={pageSizeOptions}
          showSelectedCount={selectable}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          totalRowCount={manualPagination ? rowCount : undefined}
        />
      )}
    </div>
  )
}

// ============================================================================
// DataTablePagination Component
// ============================================================================

interface DataTablePaginationProps<TData> {
  table: TableType<TData>
  pageSizeOptions?: number[]
  showSelectedCount?: boolean
  onRefresh?: () => void
  isRefreshing?: boolean
  totalRowCount?: number
}

function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 50, 100],
  showSelectedCount = false,
  onRefresh,
  isRefreshing = false,
  totalRowCount,
}: DataTablePaginationProps<TData>) {
  const displayTotal = totalRowCount ?? table.getFilteredRowModel().rows.length

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Row count / Selection info */}
      <div className="text-sm text-muted-foreground">
        {showSelectedCount ? (
          <>
            {table.getFilteredSelectedRowModel().rows.length} of {displayTotal}{' '}
            row(s) selected.
          </>
        ) : (
          <>{displayTotal} row(s) total.</>
        )}
      </div>

      {/* Page size and navigation */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page info */}
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount() || 1}
        </span>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
            <span className="sr-only">First page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
            <span className="sr-only">Last page</span>
          </Button>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 gap-1"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Helper Components for Column Definitions
// ============================================================================

interface SortableHeaderProps {
  column: {
    getIsSorted: () => false | 'asc' | 'desc'
    toggleSorting: (desc?: boolean) => void
  }
  children: React.ReactNode
}

export function SortableHeader({ column, children }: SortableHeaderProps) {
  const sorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting()}
    >
      {children}
      {sorted === 'asc' ? (
        <ArrowUp className="ml-1 h-4 w-4" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="ml-1 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  )
}

// ============================================================================
// Exports
// ============================================================================

export type { ColumnDef } from '@tanstack/react-table'
