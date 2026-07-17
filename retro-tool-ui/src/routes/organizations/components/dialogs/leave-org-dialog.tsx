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

interface LeaveOrgDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationName: string
  leaveOrgMutation: OrgDetailMutations['leaveOrgMutation']
}

export function LeaveOrgDialog({
  open,
  onOpenChange,
  organizationName,
  leaveOrgMutation,
}: LeaveOrgDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave Organization?</AlertDialogTitle>
          <AlertDialogDescription>
            You will lose access to "{organizationName}" and all its teams.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => leaveOrgMutation.mutate()}>
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
