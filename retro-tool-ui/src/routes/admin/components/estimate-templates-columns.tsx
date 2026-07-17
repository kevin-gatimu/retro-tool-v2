import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { SortableHeader } from '@/components/ui/data-table'
import type { EstimateTemplate } from '@/common/types/estimates'
import { TemplateRowActions } from './template-row-actions'

/** Per-row action handlers + mutation state for the estimate templates table. */
export interface EstimateTemplateColumnHandlers {
  onView: (t: EstimateTemplate) => void
  onEdit: (t: EstimateTemplate) => void
  onDelete: (t: EstimateTemplate) => void
  actionsDisabled: boolean
}

/** Build column defs for the admin story estimate templates table. */
export function buildEstimateTemplateColumns({
  onView,
  onEdit,
  onDelete,
  actionsDisabled,
}: EstimateTemplateColumnHandlers): ColumnDef<EstimateTemplate>[] {
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
      id: 'values',
      header: () => <span>Values</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.values.length}</Badge>
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
        return (
          <TemplateRowActions
            onView={() => onView(t)}
            onEdit={() => onEdit(t)}
            onDelete={() => onDelete(t)}
            actionsDisabled={actionsDisabled}
          />
        )
      },
    },
  ]
}
