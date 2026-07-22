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
import type { TeamMutations } from '../types'

interface DeleteTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamName: string
  deleteMutation: TeamMutations['deleteMutation']
}

export function DeleteTeamDialog({
  open,
  onOpenChange,
  teamName,
  deleteMutation,
}: DeleteTeamDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Team?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "{teamName}". This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface LeaveTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamName: string
  leaveMutation: TeamMutations['leaveMutation']
}

export function LeaveTeamDialog({
  open,
  onOpenChange,
  teamName,
  leaveMutation,
}: LeaveTeamDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave Team?</AlertDialogTitle>
          <AlertDialogDescription>
            You will no longer be a member of "{teamName}".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => leaveMutation.mutate()}>
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface RemoveMemberDialogProps {
  removeMemberId: string | null
  onOpenChange: () => void
  removeMemberMutation: TeamMutations['removeMemberMutation']
}

export function RemoveMemberDialog({
  removeMemberId,
  onOpenChange,
  removeMemberMutation,
}: RemoveMemberDialogProps) {
  return (
    <AlertDialog open={!!removeMemberId} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Member?</AlertDialogTitle>
          <AlertDialogDescription>
            This member will be removed from the team.
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

interface CancelRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamName: string
  cancelRequestMutation: TeamMutations['cancelRequestMutation']
}

export function CancelRequestDialog({
  open,
  onOpenChange,
  teamName,
  cancelRequestMutation,
}: CancelRequestDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Join Request?</AlertDialogTitle>
          <AlertDialogDescription>
            Your pending request to join "{teamName}" will be cancelled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Request</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => cancelRequestMutation.mutate()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Cancel Request
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
