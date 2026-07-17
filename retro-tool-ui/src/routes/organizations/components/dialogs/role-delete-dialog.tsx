import { Loader2 } from 'lucide-react'
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
import type { OrgTeamRoleMutations } from '../../types'

interface RoleDeleteDialogProps {
  roleDeleteId: string | null
  onClose: () => void
  deleteCustomRoleMutation: OrgTeamRoleMutations['deleteCustomRoleMutation']
}

export function RoleDeleteDialog({
  roleDeleteId,
  onClose,
  deleteCustomRoleMutation,
}: RoleDeleteDialogProps) {
  return (
    <AlertDialog
      open={roleDeleteId !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Role?</AlertDialogTitle>
          <AlertDialogDescription>
            This role will be permanently removed. Deletion will be blocked if
            any team members are currently assigned this role.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (roleDeleteId)
                deleteCustomRoleMutation.mutate(roleDeleteId, {
                  onSuccess: () => onClose(),
                })
            }}
          >
            {deleteCustomRoleMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
