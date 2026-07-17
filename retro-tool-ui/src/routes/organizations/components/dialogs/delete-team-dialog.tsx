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
import type { OrgDetailMutations } from '../../types'

interface DeleteTeamDialogProps {
  deleteTeamId: string | null
  onClose: () => void
  deleteTeamMutation: OrgDetailMutations['deleteTeamMutation']
}

export function DeleteTeamDialog({
  deleteTeamId,
  onClose,
  deleteTeamMutation,
}: DeleteTeamDialogProps) {
  return (
    <AlertDialog open={!!deleteTeamId} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Team?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this team. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              deleteTeamId &&
              deleteTeamMutation.mutate(deleteTeamId, {
                onSuccess: () => onClose(),
              })
            }
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
