import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, FileDown, Mail, Share2, Users, X } from 'lucide-react'

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
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import {
  ORGANIZATIONS_ENDPOINTS,
  TEAMS_ENDPOINTS,
  USERS_ENDPOINTS,
} from '@/lib/api-endpoints'
import { SURVEY_SCOPES } from '@/common/enums/survey.enums'
import type { TSurveyScope } from '@/common/enums/survey.enums'
import type { TeamMember } from '@/common/types/teams'
import type { OrganizationMember } from '@/common/types/organizations'
import type { User } from '@/common/types/users'

interface SurveyReportMenuProps {
  scope: TSurveyScope
  teamId: string | null
  organizationId: string | null
  /** Builds and downloads the client-side PDF. */
  onExportPdf: () => void
  /** Sends the email. `recipients` is undefined when none are picked (server
   *  then sends to the whole audience). For system surveys recipients is always
   *  the explicit picked set. */
  onSendEmail: (recipients?: string[]) => void
  isSending: boolean
}

type Recipient = { email: string; name: string }

/**
 * Survey "Report" control: a dropdown with "Export as PDF" and "Email
 * results…". The email dialog's recipient picker is scope-aware:
 * - team surveys list the team's members (checklist),
 * - org surveys list the org's members (checklist),
 * - system ("Everyone") surveys offer a user search box so the sender picks
 *   only the people they want (no bulk-all send).
 * The server independently restricts any provided recipients to the survey's
 * audience, so this is UX, not the security boundary.
 */
export function SurveyReportMenu({
  scope,
  teamId,
  organizationId,
  onExportPdf,
  onSendEmail,
  isSending,
}: SurveyReportMenuProps) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  // Checklist selection (team/org) keyed by email.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Search-picked recipients (system scope).
  const [picked, setPicked] = useState<Recipient[]>([])
  const [query, setQuery] = useState('')

  const isSystem = scope === SURVEY_SCOPES.System
  const isTeam = scope === SURVEY_SCOPES.Team
  const isOrg = scope === SURVEY_SCOPES.Org

  const { data: teamData } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () =>
      api.get<{ members?: TeamMember[]; data?: TeamMember[] }>(
        `${TEAMS_ENDPOINTS.MEMBERS(teamId!)}?limit=100`,
      ),
    enabled: emailDialogOpen && isTeam && Boolean(teamId),
    staleTime: 60_000,
  })

  const { data: orgData } = useQuery({
    queryKey: ['org-members', organizationId],
    queryFn: () =>
      api.get<{ members: OrganizationMember[] }>(
        `${ORGANIZATIONS_ENDPOINTS.MEMBERS(organizationId!)}?limit=100`,
      ),
    enabled: emailDialogOpen && isOrg && Boolean(organizationId),
    staleTime: 60_000,
  })

  const { data: searchResults = [] } = useQuery({
    queryKey: ['user-search', query],
    queryFn: () =>
      api.get<User[]>(
        `${USERS_ENDPOINTS.SEARCH}?q=${encodeURIComponent(query)}&limit=10`,
      ),
    enabled: emailDialogOpen && isSystem && query.trim().length >= 2,
    staleTime: 10_000,
  })

  const checklist: Recipient[] = useMemo(() => {
    if (isTeam) {
      const members = teamData?.members ?? teamData?.data ?? []
      return members.map((m) => ({
        email: m.user.email,
        name: m.user.name ?? m.user.email,
      }))
    }
    if (isOrg) {
      return (orgData?.members ?? []).map((m) => ({
        email: m.user.email,
        name: m.user.name,
      }))
    }
    return []
  }, [isTeam, isOrg, teamData, orgData])

  const toggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  const addPicked = (recipient: Recipient) => {
    setPicked((prev) =>
      prev.some((r) => r.email === recipient.email)
        ? prev
        : [...prev, recipient],
    )
    setQuery('')
  }

  const removePicked = (email: string) => {
    setPicked((prev) => prev.filter((r) => r.email !== email))
  }

  const handleSend = () => {
    if (isSystem) {
      onSendEmail(picked.map((r) => r.email))
    } else {
      onSendEmail(selected.size > 0 ? Array.from(selected) : undefined)
    }
  }

  // System sends require at least one picked recipient (no bulk-all); team/org
  // may send to everyone when nothing is selected.
  const sendDisabled = isSending || (isSystem && picked.length === 0)

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
            Email results…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Email results</DialogTitle>
            <DialogDescription>
              {isSystem
                ? 'Search for the people you want to send these results to.'
                : `Send these results to the whole ${isOrg ? 'organization' : 'team'}, or pick specific people.`}
            </DialogDescription>
          </DialogHeader>

          {isSystem ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 py-4">
              <div className="relative shrink-0">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search users by name or email…"
                  className={query ? 'pr-8' : ''}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {query.trim().length >= 2 &&
                  searchResults.filter(
                    (u) => !picked.some((r) => r.email === u.email),
                  ).length > 0 && (
                    <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {searchResults
                        .filter((u) => !picked.some((r) => r.email === u.email))
                        .map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                              onClick={() =>
                                addPicked({ email: u.email, name: u.name })
                              }
                            >
                              <span className="font-medium">{u.name}</span>{' '}
                              <span className="text-muted-foreground">
                                {u.email}
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                {picked.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No recipients yet — search above to add people.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {picked.map((recipient) => (
                      <li
                        key={recipient.email}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {recipient.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {recipient.email}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => removePicked(recipient.email)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {picked.length === 0
                  ? 'Pick at least one recipient.'
                  : `${picked.length} recipient${picked.length === 1 ? '' : 's'} selected.`}
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 py-4">
              <div className="flex shrink-0 items-center justify-between">
                <span className="text-sm font-medium">Recipients</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setSelected(new Set(checklist.map((r) => r.email)))
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
                  {checklist.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Loading members…
                    </p>
                  ) : (
                    checklist.map((recipient) => (
                      <label
                        key={recipient.email}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
                      >
                        <Checkbox
                          checked={selected.has(recipient.email)}
                          onCheckedChange={() => toggle(recipient.email)}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {recipient.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {recipient.email}
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
                  ? `No one selected — results go to the whole ${isOrg ? 'organization' : 'team'}.`
                  : `${selected.size} recipient${selected.size === 1 ? '' : 's'} selected.`}
              </p>
            </div>
          )}

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sendDisabled}>
              <Mail className="mr-2 h-4 w-4" />
              {isSending
                ? 'Sending…'
                : isSystem
                  ? `Send to ${picked.length}`
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
