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

interface RemoveMemberDialogProps {
  removeMemberId: string | null
  onClose: () => void
  removeMemberMutation: OrgDetailMutations['removeMemberMutation']
}

export function RemoveMemberDialog({
  removeMemberId,
  onClose,
  removeMemberMutation,
}: RemoveMemberDialogProps) {
  return (
    <AlertDialog open={!!removeMemberId} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Member?</AlertDialogTitle>
          <AlertDialogDescription>
            This member will lose access to the organization and all its teams.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              removeMemberId && removeMemberMutation.mutate(removeMemberId)
            }
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
