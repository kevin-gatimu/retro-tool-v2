import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Confirmation dialog for deleting a template. Presentational: the parent owns
 * the open/close state and the delete mutation. `title` and `description` are
 * passed in so each template kind keeps its exact copy.
 */
export function DeleteTemplateDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  title,
  description,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
  title: string
  description: ReactNode
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
