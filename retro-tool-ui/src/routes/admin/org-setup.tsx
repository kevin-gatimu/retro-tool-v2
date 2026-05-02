import { createFileRoute } from '@tanstack/react-router'
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  useOrgSetupMutations,
  useOrganizationMemberSearch,
  useUserSearch,
} from './hooks'
import { slugify } from './helpers'
import type { CreatedOrg, SelectedUser, TeamDraft } from './types'

export const Route = createFileRoute('/admin/org-setup')({
  component: OrgSetupWizard,
})

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Create Org', icon: Building2 },
  { id: 2, label: 'Set Owner', icon: User },
  { id: 3, label: 'Add Admins', icon: Users },
  { id: 4, label: 'Add Members', icon: Users },
  { id: 5, label: 'Create Teams', icon: Building2 },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function UserSearchInput({
  placeholder,
  onSelect,
  exclude,
}: {
  placeholder?: string
  onSelect: (user: SelectedUser) => void
  exclude?: string[]
}) {
  const [q, setQ] = useState('')
  const { data: results = [] } = useUserSearch(q)
  const filtered = results.filter((u) => !exclude?.includes(u.id))

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? 'Search users…'}
      />
      {filtered.length > 0 && q.length >= 2 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {filtered.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect({ id: u.id, name: u.name, email: u.email })
                  setQ('')
                }}
              >
                <span className="font-medium">{u.name}</span>{' '}
                <span className="text-muted-foreground">{u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function OrgMemberSearchInput({
  placeholder,
  onSelect,
  exclude,
  orgId,
}: {
  placeholder?: string
  onSelect: (user: SelectedUser) => void
  exclude?: string[]
  orgId: string
}) {
  const [q, setQ] = useState('')
  const { data: results = [] } = useOrganizationMemberSearch(orgId, q)
  const filtered = results.filter((u) => !exclude?.includes(u.id))

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? 'Search org members…'}
      />
      {filtered.length > 0 && q.length >= 2 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
          {filtered.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect({ id: u.id, name: u.name, email: u.email })
                  setQ('')
                }}
              >
                <span className="font-medium">{u.name}</span>{' '}
                <span className="text-muted-foreground">{u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SelectedUserList({
  users,
  onRemove,
}: {
  users: SelectedUser[]
  onRemove: (id: string) => void
}) {
  if (users.length === 0) return null
  return (
    <ul className="mt-2 space-y-1">
      {users.map((u) => (
        <li
          key={u.id}
          className="flex items-center justify-between rounded-md border px-3 py-1.5"
        >
          <span className="text-sm">
            <span className="font-medium">{u.name}</span>{' '}
            <span className="text-muted-foreground">{u.email}</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onRemove(u.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </li>
      ))}
    </ul>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

function OrgSetupWizard() {
  const [step, setStep] = useState(1)

  // Step 1 — Create org
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [createdOrg, setCreatedOrg] = useState<CreatedOrg | null>(null)

  // Auto-generate slug from name unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited) {
      setOrgSlug(slugify(orgName))
    }
  }, [orgName, slugManuallyEdited])

  // Step 2 — Owner
  const [owner, setOwner] = useState<SelectedUser | null>(null)

  // Step 3 — Admins
  const [admins, setAdmins] = useState<SelectedUser[]>([])

  // Step 4 — Members
  const [members, setMembers] = useState<SelectedUser[]>([])

  // Step 5 — Teams
  const [teams, setTeams] = useState<TeamDraft[]>([{ name: '' }])

  // ── Mutations ────────────────────────────────────────────────────────────────

  const {
    createOrgMutation,
    assignOwnerMutation,
    addAdminsMutation,
    addMembersMutation,
    createTeamsMutation,
  } = useOrgSetupMutations({
    orgName,
    orgSlug,
    createdOrg,
    owner,
    admins,
    members,
    teams,
    setCreatedOrg,
    setStep,
    setTeams,
  })

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const excludedIds = [
    ...(owner ? [owner.id] : []),
    ...admins.map((u) => u.id),
    ...members.map((u) => u.id),
  ]

  const addTeam = () => setTeams((prev) => [...prev, { name: '' }])
  const removeTeam = (i: number) =>
    setTeams((prev) => prev.filter((_, idx) => idx !== i))
  const updateTeamName = (i: number, name: string) =>
    setTeams((prev) => prev.map((t, idx) => (idx === i ? { ...t, name } : t)))
  const updateTeamLead = (i: number, user: SelectedUser) =>
    setTeams((prev) =>
      prev.map((t, idx) =>
        idx === i ? { ...t, leadId: user.id, leadName: user.name } : t,
      ),
    )
  const clearTeamLead = (i: number) =>
    setTeams((prev) =>
      prev.map((t, idx) =>
        idx === i ? { ...t, leadId: undefined, leadName: undefined } : t,
      ),
    )

  // ── Render ───────────────────────────────────────────────────────────────────

  const isComplete = step === 6

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organisation Setup Wizard</h1>
        <p className="text-muted-foreground">
          Create a new organisation and configure it step-by-step.
        </p>
      </div>

      {/* Progress bar */}
      {!isComplete && (
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => createdOrg && setStep(s.id)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  step === s.id
                    ? 'bg-primary text-primary-foreground'
                    : step > s.id
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </button>
              <span
                className={cn(
                  'hidden text-xs sm:block',
                  step === s.id
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-px flex-1 bg-border',
                    step > s.id && 'bg-green-400',
                  )}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step 1 — Create Org */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Create Organisation
            </CardTitle>
            <CardDescription>Enter the organisation details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-1">
              <Label>Slug *</Label>
              <Input
                value={orgSlug}
                onChange={(e) => {
                  setSlugManuallyEdited(true)
                  setOrgSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  )
                }}
                placeholder="acme-corp"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only. Auto-generated
                from name.
              </p>
            </div>
            <Button
              onClick={() => createOrgMutation.mutate()}
              disabled={
                !orgName.trim() ||
                !orgSlug.trim() ||
                createOrgMutation.isPending
              }
              className="w-full"
            >
              {createOrgMutation.isPending
                ? 'Creating…'
                : 'Create Organisation'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Set Owner */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Set Organisation Owner
            </CardTitle>
            <CardDescription>
              Search for a user to make the owner of{' '}
              <span className="font-semibold">{createdOrg?.name}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UserSearchInput
              placeholder="Search users by name or email…"
              onSelect={(u) => setOwner(u)}
              exclude={owner ? [owner.id] : []}
            />
            {owner && (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm font-medium">
                  {owner.name} — {owner.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOwner(null)}
                >
                  Remove
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => assignOwnerMutation.mutate()}
                disabled={!owner || assignOwnerMutation.isPending}
                className="flex-1"
              >
                {assignOwnerMutation.isPending
                  ? 'Saving…'
                  : 'Set Owner & Continue'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => setStep(3)}>
                Skip
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Add Admins */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Add Organisation Admins
            </CardTitle>
            <CardDescription>
              Admins can manage members and teams in{' '}
              <span className="font-semibold">{createdOrg?.name}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UserSearchInput
              placeholder="Search users to add as admins…"
              onSelect={(u) =>
                setAdmins((prev) => [...prev.filter((x) => x.id !== u.id), u])
              }
              exclude={excludedIds}
            />
            <SelectedUserList
              users={admins}
              onRemove={(id) => setAdmins((p) => p.filter((u) => u.id !== id))}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() =>
                  admins.length > 0 ? addAdminsMutation.mutate() : setStep(4)
                }
                disabled={addAdminsMutation.isPending}
                className="flex-1"
              >
                {addAdminsMutation.isPending
                  ? 'Adding…'
                  : admins.length > 0
                    ? `Add ${admins.length} Admin(s) & Continue`
                    : 'Continue'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Add Members */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Add Members
            </CardTitle>
            <CardDescription>
              Optionally invite additional members to{' '}
              <span className="font-semibold">{createdOrg?.name}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UserSearchInput
              placeholder="Search users to add as members…"
              onSelect={(u) =>
                setMembers((prev) => [...prev.filter((x) => x.id !== u.id), u])
              }
              exclude={excludedIds}
            />
            <SelectedUserList
              users={members}
              onRemove={(id) => setMembers((p) => p.filter((u) => u.id !== id))}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() =>
                  members.length > 0 ? addMembersMutation.mutate() : setStep(5)
                }
                disabled={addMembersMutation.isPending}
                className="flex-1"
              >
                {addMembersMutation.isPending
                  ? 'Adding…'
                  : members.length > 0
                    ? `Add ${members.length} Member(s) & Continue`
                    : 'Continue'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5 — Create Teams */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Create Teams
            </CardTitle>
            <CardDescription>
              Optionally create teams within{' '}
              <span className="font-semibold">{createdOrg?.name}</span> and
              assign team leads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {teams.map((t, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={t.name}
                    onChange={(e) => updateTeamName(i, e.target.value)}
                    placeholder={`Team ${i + 1} name`}
                    className="flex-1"
                  />
                  {teams.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeTeam(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Team Lead (optional)
                </div>
                {t.leadName ? (
                  <div className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1">
                    <span className="text-sm">{t.leadName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6"
                      onClick={() => clearTeamLead(i)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <OrgMemberSearchInput
                    placeholder="Search org members for team lead…"
                    onSelect={(u) => updateTeamLead(i, u)}
                    orgId={createdOrg!.id}
                    exclude={
                      teams
                        .filter((_, idx) => idx !== i)
                        .map((team) => team.leadId)
                        .filter(Boolean) as string[]
                    }
                  />
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addTeam}
              className="w-full"
            >
              <Plus className="mr-1 h-4 w-4" /> Add Another Team
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(4)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() =>
                  teams.some((t) => t.name.trim())
                    ? createTeamsMutation.mutate()
                    : setStep(6)
                }
                disabled={createTeamsMutation.isPending}
                className="flex-1"
              >
                {createTeamsMutation.isPending
                  ? 'Creating…'
                  : teams.some((t) => t.name.trim())
                    ? 'Create Teams & Finish'
                    : 'Skip & Finish'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6 — Done */}
      {isComplete && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold">Setup Complete!</h2>
            <p className="text-center text-muted-foreground">
              <span className="font-semibold">{createdOrg?.name}</span> has been
              created and configured successfully.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setStep(1)
                  setOrgName('')
                  setOrgSlug('')
                  setSlugManuallyEdited(false)
                  setCreatedOrg(null)
                  setOwner(null)
                  setAdmins([])
                  setMembers([])
                  setTeams([{ name: '' }])
                }}
                variant="outline"
              >
                Create Another
              </Button>
              <Button asChild>
                <a href={`/organizations/${createdOrg?.id}`}>
                  View Organisation
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
