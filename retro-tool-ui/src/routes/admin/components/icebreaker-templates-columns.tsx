import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { SortableHeader } from '@/components/ui/data-table'
import { FLAVOUR_ACCENTS, FLAVOUR_LABELS } from '@/routes/icebreakers/helpers'
import type { IcebreakerTemplate } from '@/common/types/icebreakers'
import { TemplateRowActions } from './template-row-actions'

/** Per-row action handlers + mutation state for the icebreaker templates table. */
export interface IcebreakerTemplateColumnHandlers {
  onView: (t: IcebreakerTemplate) => void
  onEdit: (t: IcebreakerTemplate) => void
  onDelete: (t: IcebreakerTemplate) => void
  actionsDisabled: boolean
}

/** Build column defs for the admin icebreaker templates table. */
export function buildIcebreakerTemplateColumns({
  onView,
  onEdit,
  onDelete,
  actionsDisabled,
}: IcebreakerTemplateColumnHandlers): ColumnDef<IcebreakerTemplate>[] {
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
      id: 'flavour',
      header: () => <span>Flavour</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${FLAVOUR_ACCENTS[row.original.flavour]}`}
        >
          {FLAVOUR_LABELS[row.original.flavour]}
        </span>
      ),
    },
    {
      id: 'prompts',
      header: () => <span>Prompts</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.prompts.length}</Badge>
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
