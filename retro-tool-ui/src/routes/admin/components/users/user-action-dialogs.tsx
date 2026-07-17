import type { UserRow } from '@/components/tables/user-columns'
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { useAdminUserMutations } from '../../hooks'

type UserMutations = ReturnType<typeof useAdminUserMutations>

interface SuspendUserDialogProps {
  suspendModalUser: UserRow | null
  onClose: () => void
  suspendReason: string
  onSuspendReasonChange: (value: string) => void
  suspendMutation: UserMutations['suspendMutation']
}

export function SuspendUserDialog({
  suspendModalUser,
  onClose,
  suspendReason,
  onSuspendReasonChange,
  suspendMutation,
}: SuspendUserDialogProps) {
  return (
    <Dialog open={!!suspendModalUser} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend User</DialogTitle>
          <DialogDescription>
            Suspend {suspendModalUser?.name}'s account. They will not be able to
            access the system until reactivated.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (suspendModalUser && !suspendMutation.isPending)
              suspendMutation.mutate({
                userId: suspendModalUser.id,
                reason: suspendReason,
              })
          }}
        >
          <div className="py-4">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for suspension..."
              value={suspendReason}
              onChange={(e) => onSuspendReasonChange(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={suspendMutation.isPending}
            >
              {suspendMutation.isPending ? 'Suspending...' : 'Suspend User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteUserDialogProps {
  deleteConfirmUser: UserRow | null
  onClose: () => void
  deleteMutation: UserMutations['deleteMutation']
}

export function DeleteUserDialog({
  deleteConfirmUser,
  onClose,
  deleteMutation,
}: DeleteUserDialogProps) {
  return (
    <AlertDialog open={!!deleteConfirmUser} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {deleteConfirmUser?.name}'s account and
            all associated data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              deleteConfirmUser && deleteMutation.mutate(deleteConfirmUser.id)
            }
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface BulkActionDialogProps {
  bulkActionModal: string | null
  onClose: () => void
  selectedCount: number
  bulkMutation: UserMutations['bulkMutation']
}

export function BulkActionDialog({
  bulkActionModal,
  onClose,
  selectedCount,
  bulkMutation,
}: BulkActionDialogProps) {
  return (
    <AlertDialog open={!!bulkActionModal} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {bulkActionModal === 'approve'
              ? 'Approve Selected Users?'
              : 'Suspend Selected Users?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will {bulkActionModal === 'approve' ? 'approve' : 'suspend'}{' '}
            {selectedCount} selected users.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              bulkMutation.mutate({
                status:
                  bulkActionModal === 'approve' ? 'approved' : 'suspended',
              })
            }
          >
            {bulkActionModal === 'approve' ? 'Approve All' : 'Suspend All'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
