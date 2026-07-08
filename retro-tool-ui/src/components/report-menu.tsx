import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, FileDown, Mail, Share2, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

interface ReportMenuProps {
  /** Team whose members populate the email recipient checklist. */
  teamId: string
  /** Builds and downloads the client-side PDF. */
  onExportPdf: () => void
  /** Sends the email report. `recipients` is undefined when none are picked
   *  (server then sends to the whole team). */
  onSendEmail: (recipients?: string[]) => void
  isSending: boolean
  dialogTitle?: string
  dialogDescription?: string
}

/**
 * Shared "Report" control: a dropdown offering "Export as PDF" and
 * "Email report…", the latter opening a dialog with a team-member recipient
 * checklist. Each feature (retros, estimates, standups) supplies its own PDF
 * builder and send mutation via props, so the UX stays identical everywhere.
 */
export function ReportMenu({
  teamId,
  onExportPdf,
  onSendEmail,
  isSending,
  dialogTitle = 'Email report',
  dialogDescription = 'Send this report to the whole team, or pick specific people.',
}: ReportMenuProps) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: membersData } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () =>
      api.get<{ members?: TeamMember[]; data?: TeamMember[] }>(
        `${TEAMS_ENDPOINTS.MEMBERS(teamId)}?limit=100`,
      ),
    enabled: emailDialogOpen,
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

  const handleSend = () => {
    onSendEmail(selected.size > 0 ? Array.from(selected) : undefined)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" />
            Report
            <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Export &amp; share</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExportPdf}>
            <FileDown className="mr-2 h-4 w-4" />
            Export as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEmailDialogOpen(true)}>
            <Mail className="mr-2 h-4 w-4" />
            Email report…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
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
                ? 'No one selected — the report goes to all team members.'
                : `${selected.size} recipient${selected.size === 1 ? '' : 's'} selected.`}
            </p>
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
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
    </>
  )
}
