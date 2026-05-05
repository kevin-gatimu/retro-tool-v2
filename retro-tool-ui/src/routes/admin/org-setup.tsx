import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  User,
  Users,
  X,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useOrgBulkSetupMutation, useUserSearch } from './hooks'
import { slugify } from './helpers'
import type { SelectedUser, TeamDraft } from './types'
import type { BulkSetupResult } from './hooks'

function OrgSetupSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="hidden sm:block h-4 w-16" />
            {i < 5 && <Skeleton className="h-px w-4" />}
          </div>
        ))}
      </div>
      {/* Form card */}
      <div className="border rounded-lg p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/admin/org-setup')({
  pendingComponent: OrgSetupSkeleton,
  component: OrgSetupWizard,
})

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Create Org', icon: Building2 },
  { id: 2, label: 'Set Owner', icon: User },
  { id: 3, label: 'Add Admins', icon: Users },
  { id: 4, label: 'Add Members', icon: Users },
  { id: 5, label: 'Create Teams', icon: Building2 },
  { id: 6, label: 'Review', icon: Check },
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
      <div className="relative">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder ?? 'Search users…'}
          className={q ? 'pr-8' : ''}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
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
            className="h-6 w-6 shrink-0"
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
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [result, setResult] = useState<BulkSetupResult | null>(null)

  // Step 1 — org details
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

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

  // ── Single mutation ───────────────────────────────────────────────────────────

  const bulkSetupMutation = useOrgBulkSetupMutation()

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // All users already chosen across steps 2-4 (for the team lead picker)
  const allSelectedUsers: SelectedUser[] = [
    ...(owner ? [owner] : []),
    ...admins,
    ...members,
  ]
  const allSelectedIds = allSelectedUsers.map((u) => u.id)

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

  const handleSubmit = () => {
    const seen = new Set<string>()
    const validTeams = teams
      .filter((t) => t.name.trim())
      .filter((t) => {
        const key = t.name.trim().toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((t) => ({ name: t.name.trim(), leadId: t.leadId }))

    bulkSetupMutation.mutate(
      {
        name: orgName.trim(),
        slug: orgSlug.trim(),
        ownerId: owner?.id,
        adminIds: admins.map((u) => u.id),
        memberIds: members.map((u) => u.id),
        teams: validTeams,
      },
      {
        onSuccess: (data) => {
          setResult(data)
          setStep(7)
        },
      },
    )
  }

  const resetWizard = () => {
    setStep(1)
    setResult(null)
    setOrgName('')
    setOrgSlug('')
    setSlugManuallyEdited(false)
    setOwner(null)
    setAdmins([])
    setMembers([])
    setTeams([{ name: '' }])
    bulkSetupMutation.reset()
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const isComplete = step === 7

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organisation Setup Wizard</h1>
        <p className="text-muted-foreground">
          Configure everything first, then create the organisation in one step.
        </p>
        <p className="mt-1 text-sm text-amber-500">
          Invitations are only sent to users already registered on this
          platform.
        </p>
      </div>

      {/* Progress stepper */}
      {!isComplete && (
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => step > s.id && setStep(s.id)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  step === s.id
                    ? 'bg-primary text-primary-foreground'
                    : step > s.id
                      ? 'cursor-pointer bg-green-500 text-white hover:bg-green-600'
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
                    'h-px w-4 flex-shrink-0 bg-border',
                    step > s.id && 'bg-green-400',
                  )}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Step 1 — Organisation Details ── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Organisation Details
            </CardTitle>
            <CardDescription>
              Enter the organisation name and slug.
            </CardDescription>
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
              onClick={() => setStep(2)}
              disabled={!orgName.trim() || !orgSlug.trim()}
              className="w-full"
            >
              Continue <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2 — Set Owner ── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Set Organisation Owner
            </CardTitle>
            <CardDescription>
              Optionally designate an owner for{' '}
              <span className="font-semibold">{orgName}</span>. If skipped, you
              (the admin) will be the sole owner.
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
                  {owner.name}{' '}
                  <span className="text-muted-foreground">— {owner.email}</span>
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
              <Button onClick={() => setStep(3)} className="flex-1">
                {owner ? 'Owner Set — Continue' : 'Skip'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3 — Add Admins ── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Add Organisation Admins
            </CardTitle>
            <CardDescription>
              Admins can manage members and teams in{' '}
              <span className="font-semibold">{orgName}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UserSearchInput
              placeholder="Search users to add as admins…"
              onSelect={(u) =>
                setAdmins((prev) => [...prev.filter((x) => x.id !== u.id), u])
              }
              exclude={[
                ...(owner ? [owner.id] : []),
                ...admins.map((u) => u.id),
              ]}
            />
            <SelectedUserList
              users={admins}
              onRemove={(id) => setAdmins((p) => p.filter((u) => u.id !== id))}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                {admins.length > 0
                  ? `${admins.length} Admin(s) Added — Continue`
                  : 'Skip'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4 — Add Members ── */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Add Members
            </CardTitle>
            <CardDescription>
              Optionally add members to{' '}
              <span className="font-semibold">{orgName}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UserSearchInput
              placeholder="Search users to add as members…"
              onSelect={(u) =>
                setMembers((prev) => [...prev.filter((x) => x.id !== u.id), u])
              }
              exclude={[
                ...(owner ? [owner.id] : []),
                ...admins.map((u) => u.id),
                ...members.map((u) => u.id),
              ]}
            />
            <SelectedUserList
              users={members}
              onRemove={(id) => setMembers((p) => p.filter((u) => u.id !== id))}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(5)} className="flex-1">
                {members.length > 0
                  ? `${members.length} Member(s) Added — Continue`
                  : 'Skip'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 5 — Create Teams ── */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Create Teams
            </CardTitle>
            <CardDescription>
              Optionally create teams within{' '}
              <span className="font-semibold">{orgName}</span>. Assign a lead
              from the users selected in previous steps.
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
                ) : allSelectedUsers.length > 0 ? (
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value=""
                    onChange={(e) => {
                      const selected = allSelectedUsers.find(
                        (u) => u.id === e.target.value,
                      )
                      if (selected) updateTeamLead(i, selected)
                    }}
                  >
                    <option value="">— pick a team lead —</option>
                    {allSelectedUsers
                      .filter(
                        (u) =>
                          !teams.some(
                            (team, idx) => idx !== i && team.leadId === u.id,
                          ),
                      )
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <UserSearchInput
                    placeholder="Search any user for team lead…"
                    onSelect={(u) => {
                      if (!allSelectedIds.includes(u.id)) {
                        setMembers((prev) => [
                          ...prev.filter((x) => x.id !== u.id),
                          u,
                        ])
                      }
                      updateTeamLead(i, u)
                    }}
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
              <Button onClick={() => setStep(6)} className="flex-1">
                {teams.some((t) => t.name.trim())
                  ? `${teams.filter((t) => t.name.trim()).length} Team(s) — Review`
                  : 'Skip — Review'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 6 — Review & Submit ── */}
      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5" /> Review &amp; Create
            </CardTitle>
            <CardDescription>
              Review the configuration below. Nothing is saved until you click
              "Create Organisation".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Org */}
            <div className="rounded-md border p-4 space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Organisation
              </p>
              <p className="font-semibold">{orgName}</p>
              <p className="text-sm text-muted-foreground">/{orgSlug}</p>
            </div>

            {/* Owner */}
            <div className="rounded-md border p-4 space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Owner
              </p>
              {owner ? (
                <p className="text-sm">
                  {owner.name}{' '}
                  <span className="text-muted-foreground">— {owner.email}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  None specified — you will be the owner
                </p>
              )}
            </div>

            {/* Admins */}
            <div className="rounded-md border p-4 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Admins ({admins.length})
              </p>
              {admins.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {admins.map((u) => (
                    <Badge key={u.id} variant="secondary">
                      {u.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Members */}
            <div className="rounded-md border p-4 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Members ({members.length})
              </p>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {members.map((u) => (
                    <Badge key={u.id} variant="secondary">
                      {u.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Teams */}
            <div className="rounded-md border p-4 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Teams ({teams.filter((t) => t.name.trim()).length})
              </p>
              {!teams.some((t) => t.name.trim()) ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1">
                  {teams
                    .filter((t) => t.name.trim())
                    .map((t, i) => (
                      <li key={i} className="text-sm flex items-center gap-2">
                        <span className="font-medium">{t.name}</span>
                        {t.leadName && (
                          <span className="text-muted-foreground text-xs">
                            — lead: {t.leadName}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {bulkSetupMutation.isError && (
              <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                {bulkSetupMutation.error.message ||
                  'Something went wrong. Please try again.'}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(5)}
                disabled={bulkSetupMutation.isPending}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={bulkSetupMutation.isPending}
                className="flex-1"
              >
                {bulkSetupMutation.isPending
                  ? 'Creating Organisation…'
                  : 'Create Organisation'}
                {!bulkSetupMutation.isPending && (
                  <Check className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 7 — Success ── */}
      {isComplete && result && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold">Setup Complete!</h2>
            <p className="text-center text-muted-foreground">
              <span className="font-semibold">{result.org.name}</span> has been
              created with{' '}
              <span className="font-semibold">{result.memberCount}</span>{' '}
              member(s) and{' '}
              <span className="font-semibold">{result.teamCount}</span> team(s).
            </p>
            <div className="flex gap-3">
              <Button onClick={resetWizard} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Create Another
              </Button>
              <Button
                onClick={() =>
                  navigate({
                    to: '/organizations/$orgId',
                    params: { orgId: result.org.id },
                  })
                }
              >
                View Organisation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
