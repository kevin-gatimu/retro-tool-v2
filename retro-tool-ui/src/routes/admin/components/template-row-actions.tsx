import {
  Loader2,
  MoreHorizontal,
  Pencil,
  SquareStack,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * View / Edit / Delete action dropdown for an admin template table row. Shared
 * across the retro, estimate, and icebreaker tabs. `rowActionLoading` swaps the
 * trigger icon for a spinner (retro tab tracks per-row update/delete state; the
 * other tabs pass the default `false`).
 */
export function TemplateRowActions({
  onView,
  onEdit,
  onDelete,
  actionsDisabled,
  rowActionLoading = false,
}: {
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  actionsDisabled: boolean
  rowActionLoading?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={actionsDisabled}
        >
          {rowActionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <SquareStack className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={actionsDisabled} onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          disabled={actionsDisabled}
          onClick={onDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
