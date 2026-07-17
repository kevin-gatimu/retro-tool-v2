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
import type { Mutation } from '../types'

interface DeleteRetroDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  retroName: string
  deleteRetroMutation: Mutation
}

export function DeleteRetroDialog({
  open,
  onOpenChange,
  retroName,
  deleteRetroMutation,
}: DeleteRetroDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Retrospective?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &ldquo;{retroName}&rdquo; and all its
            cards, votes, and action items. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => deleteRetroMutation.mutate()}
          >
            {deleteRetroMutation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
