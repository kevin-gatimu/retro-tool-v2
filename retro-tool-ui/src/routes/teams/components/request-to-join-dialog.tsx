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
import type { TeamMutations } from '../types'

interface RequestToJoinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  joinRequestMessage: string
  onJoinRequestMessageChange: (value: string) => void
  requestToJoinMutation: TeamMutations['requestToJoinMutation']
}

export function RequestToJoinDialog({
  open,
  onOpenChange,
  joinRequestMessage,
  onJoinRequestMessageChange,
  requestToJoinMutation,
}: RequestToJoinDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request to Join Team</DialogTitle>
          <DialogDescription>
            Your request will be sent to the team leads and organization admins
            for approval.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="joinMessage">Message (optional)</Label>
            <Textarea
              id="joinMessage"
              placeholder="Tell us why you'd like to join this team..."
              value={joinRequestMessage}
              onChange={(e) => onJoinRequestMessageChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => requestToJoinMutation.mutate()}
            disabled={requestToJoinMutation.isPending}
          >
            {requestToJoinMutation.isPending ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
