import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface LeagueColumn<TRow> {
  header: string
  align?: 'left' | 'right'
  render: (row: TRow) => ReactNode
  /** raw value used for CSV export */
  csv: (row: TRow) => string | number
}

interface LeaguePagination {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

interface LeagueSearch {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

interface LeagueTableProps<TRow> {
  rows: TRow[]
  rowKey: (row: TRow) => string
  columns: Array<LeagueColumn<TRow>>
  emptyMessage: string
  pagination?: LeaguePagination
  search?: LeagueSearch
  onExportCsv?: () => void
  isFetching?: boolean
}

export function LeagueTable<TRow>({
  rows,
  rowKey,
  columns,
  emptyMessage,
  pagination,
  search,
  onExportCsv,
  isFetching = false,
}: LeagueTableProps<TRow>) {
  const lastPage = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1

  return (
    <div className="space-y-3">
      {(search || onExportCsv) && (
        <div className="flex items-center justify-between gap-2">
          {search ? (
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder ?? 'Search…'}
                className="pl-8"
              />
            </div>
          ) : (
            <span />
          )}
          {onExportCsv ? (
            <Button variant="outline" size="sm" onClick={onExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          ) : null}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div
          className={isFetching ? 'opacity-60 transition-opacity' : undefined}
        >
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.header}
                    className={
                      column.align === 'right' ? 'text-right' : undefined
                    }
                  >
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.header}
                      className={
                        column.align === 'right' ? 'text-right' : undefined
                      }
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.total > pagination.pageSize ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {lastPage} ({pagination.total} rows)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page >= lastPage}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
