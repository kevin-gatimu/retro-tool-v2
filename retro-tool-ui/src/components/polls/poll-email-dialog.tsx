import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Mail, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type { TeamMember } from '@/common/types/teams'

interface PollEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  isSending: boolean
  /** `recipients` is undefined when none are picked (server sends to whole team). */
  onSend: (recipients?: string[]) => void
}

/**
 * Recipient picker for emailing poll results. Polls are team-scoped, so the
 * checklist is the poll's team members; sending with none selected emails the
 * whole team. Mirrors the shared ReportMenu email dialog.
 */
export function PollEmailDialog({
  open,
  onOpenChange,
  teamId,
  isSending,
  onSend,
}: PollEmailDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: membersData } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () =>
      api.get<{ members?: TeamMember[]; data?: TeamMember[] }>(
        `${TEAMS_ENDPOINTS.MEMBERS(teamId)}?limit=100`,
      ),
    enabled: open,
    staleTime: 60_000,
  })

  const members = membersData?.members ?? membersData?.data ?? []

  const toggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Email results</DialogTitle>
          <DialogDescription>
            Send these poll results to the whole team, or pick specific people.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 py-4">
          <div className="flex shrink-0 items-center justify-between">
            <span className="text-sm font-medium">Recipients</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setSelected(new Set(members.map((m) => m.user.email)))
                }
              >
                Select all
              </button>
              {selected.size > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
            <div className="divide-y">
              {members.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Loading team members…
                </p>
              ) : (
                members.map((member) => (
                  <label
                    key={member.userId}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
                  >
                    <Checkbox
                      checked={selected.has(member.user.email)}
                      onCheckedChange={() => toggle(member.user.email)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.user.name ?? member.user.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {selected.size === 0
              ? 'No one selected — results go to all team members.'
              : `${selected.size} recipient${selected.size === 1 ? '' : 's'} selected.`}
          </p>
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSend(selected.size > 0 ? Array.from(selected) : undefined)
            }
            disabled={isSending}
          >
            <Mail className="mr-2 h-4 w-4" />
            {isSending
              ? 'Sending…'
              : selected.size > 0
                ? `Send to ${selected.size}`
                : 'Send to all'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
