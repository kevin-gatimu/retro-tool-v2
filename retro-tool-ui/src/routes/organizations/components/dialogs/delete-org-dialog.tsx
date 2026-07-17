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

interface DeleteOrgDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationName: string
  deleteOrgMutation: OrgDetailMutations['deleteOrgMutation']
}

export function DeleteOrgDialog({
  open,
  onOpenChange,
  organizationName,
  deleteOrgMutation,
}: DeleteOrgDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Organization?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "{organizationName}" and all its teams.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteOrgMutation.mutate()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
