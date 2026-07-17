import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import {
  inviteEmailCheckColorClass,
  inviteEmailCheckMessage,
} from '@/common/helpers'
import type {
  InviteEmailCheckState,
  TeamMutations,
  TeamRoleSelection,
} from '../types'

interface InviteMemberDialogProps {
  teamId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  inviteEmail: string
  onInviteEmailChange: (value: string) => void
  inviteTag: TeamRoleSelection
  onInviteTagChange: (value: TeamRoleSelection) => void
  inviteEmailCheck: InviteEmailCheckState
  onInviteEmailCheckChange: (value: InviteEmailCheckState) => void
  inviteMemberMutation: TeamMutations['inviteMemberMutation']
}

export function InviteMemberDialog({
  teamId,
  open,
  onOpenChange,
  inviteEmail,
  onInviteEmailChange,
  inviteTag,
  onInviteTagChange,
  inviteEmailCheck,
  onInviteEmailCheckChange,
  inviteMemberMutation,
}: InviteMemberDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          onInviteEmailChange('')
          onInviteTagChange('member')
          onInviteEmailCheckChange(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <Mail className="mr-2 h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member by Email</DialogTitle>
          <DialogDescription>
            Send an invitation email. The invitee will also be added to this
            team's organisation.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (inviteEmail && !inviteMemberMutation.isPending)
              inviteMemberMutation.mutate({
                email: inviteEmail,
                tag: inviteTag,
              })
          }}
        >
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="team-invite-email">Email</Label>
              <Input
                id="team-invite-email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => {
                  onInviteEmailChange(e.target.value)
                  onInviteEmailCheckChange(null)
                }}
                onBlur={async () => {
                  if (!inviteEmail) return
                  try {
                    const result = await api.get<{
                      registered: boolean
                      name?: string
                      isMember?: boolean
                    }>(
                      `${TEAMS_ENDPOINTS.CHECK_INVITE_EMAIL(teamId)}?email=${encodeURIComponent(inviteEmail)}`,
                    )
                    onInviteEmailCheckChange(result)
                  } catch {
                    onInviteEmailCheckChange(null)
                  }
                }}
              />
              {inviteEmailCheck !== null && (
                <p
                  className={`text-xs ${inviteEmailCheckColorClass(inviteEmailCheck)}`}
                >
                  {inviteEmailCheckMessage(inviteEmailCheck, 'team')}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Team Rank</Label>
              <Select
                value={inviteTag}
                onValueChange={(v: string) =>
                  onInviteTagChange(v as TeamRoleSelection)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="team-lead">Team Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !inviteEmail ||
                inviteMemberMutation.isPending ||
                !!inviteEmailCheck?.isMember
              }
            >
              {inviteMemberMutation.isPending ? 'Sending...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
