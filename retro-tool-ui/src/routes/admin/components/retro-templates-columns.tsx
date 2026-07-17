import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { SortableHeader } from '@/components/ui/data-table'
import type { TemplateWithColumns } from '../types'
import { TemplateRowActions } from './template-row-actions'

/** Per-row action handlers + mutation state for the retro templates table. */
export interface RetroTemplateColumnHandlers {
  onView: (t: TemplateWithColumns) => void
  onEdit: (t: TemplateWithColumns) => void
  onDelete: (t: TemplateWithColumns) => void
  updatePending: boolean
  updateVariablesTemplateId: string | undefined
  deletePending: boolean
  deleteVariables: string | undefined
}

/** Build column defs for the admin retro templates table. */
export function buildRetroTemplateColumns({
  onView,
  onEdit,
  onDelete,
  updatePending,
  updateVariablesTemplateId,
  deletePending,
  deleteVariables,
}: RetroTemplateColumnHandlers): ColumnDef<TemplateWithColumns>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <SortableHeader column={column}>Name</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      id: 'type',
      header: () => <span>Type</span>,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.isBuiltIn ? (
          <Badge variant="secondary">Built-in</Badge>
        ) : (
          <Badge variant="outline">
            {row.original.organizationName ?? 'Organization'}
          </Badge>
        ),
    },
    {
      id: 'description',
      header: () => <span>Description</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground line-clamp-1 max-w-xs">
          {row.original.description ?? '—'}
        </span>
      ),
    },
    {
      id: 'columns',
      header: () => <span>Columns</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.columns.length}</Badge>
      ),
    },
    {
      id: 'createdAt',
      accessorFn: (row) => new Date(row.createdAt).getTime(),
      header: ({ column }) => (
        <SortableHeader column={column}>Created</SortableHeader>
      ),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: () => <span>Actions</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const t = row.original
        const isUpdatingRow =
          updatePending && updateVariablesTemplateId === t.id
        const isDeletingRow = deletePending && deleteVariables === t.id
        const rowActionLoading = isUpdatingRow || isDeletingRow
        const actionsDisabled = updatePending || deletePending

        return (
          <TemplateRowActions
            onView={() => onView(t)}
            onEdit={() => onEdit(t)}
            onDelete={() => onDelete(t)}
            actionsDisabled={actionsDisabled}
            rowActionLoading={rowActionLoading}
          />
        )
      },
    },
  ]
}
