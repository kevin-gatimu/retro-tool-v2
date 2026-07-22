import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Template } from '@/common/types/templates'

interface TemplateDeleteDialogProps {
  templateToDelete: Template | null
  onClose: () => void
  onConfirm: (id: string) => void
}

export function TemplateDeleteDialog({
  templateToDelete,
  onClose,
  onConfirm,
}: TemplateDeleteDialogProps) {
  return (
    <AlertDialog
      open={templateToDelete !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete template &quot;{templateToDelete?.name}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (templateToDelete) onConfirm(templateToDelete.id)
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
