import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Layers,
  Spade,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import {
  ESTIMATE_TEMPLATES_ENDPOINTS,
  TEAMS_ENDPOINTS,
} from '@/lib/api-endpoints'
import { useEstimateMutations } from './hooks/use-estimate-mutations'
import type { Team } from '@/common/types/teams'
import type {
  EstimateTemplate,
  PaginatedEstimateTemplatesResponse,
} from '@/common/types/estimates'
import { cn } from '@/lib/utils'
import { NewEstimateSkeleton } from './skeleton'

const DEFAULT_TEMPLATE_PAGE_SIZE = 6

type Step = 'template' | 'team' | 'settings' | 'confirm'

function buildEstTemplateKey(
  type: 'built-in' | 'organization',
  page: number,
  limit: number,
) {
  return ['new-estimate-templates', type, page, limit] as const
}

function fetchEstTemplates(
  type: 'built-in' | 'organization',
  page: number,
  limit: number,
) {
  return api.get<PaginatedEstimateTemplatesResponse>(
    `${ESTIMATE_TEMPLATES_ENDPOINTS.LIST}?type=${type}&page=${page}&limit=${limit}`,
  )
}

const estimateNewTeamsQueryOptions = {
  queryKey: ['teams'] as const,
  queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
  staleTime: 30_000,
}

export const Route = createFileRoute('/estimate/new')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({
        queryKey: buildEstTemplateKey(
          'built-in',
          1,
          DEFAULT_TEMPLATE_PAGE_SIZE,
        ),
        queryFn: () =>
          fetchEstTemplates('built-in', 1, DEFAULT_TEMPLATE_PAGE_SIZE),
      }),
      queryClient.ensureQueryData({
        queryKey: buildEstTemplateKey(
          'organization',
          1,
          DEFAULT_TEMPLATE_PAGE_SIZE,
        ),
        queryFn: () =>
          fetchEstTemplates('organization', 1, DEFAULT_TEMPLATE_PAGE_SIZE),
      }),
      queryClient.ensureQueryData(estimateNewTeamsQueryOptions),
    ]),
  pendingComponent: NewEstimateSkeleton,
  component: NewEstimateSessionPage,
})

function NewEstimateSessionPage() {
  const navigate = useNavigate()

  const { data: teamsData } = useSuspenseQuery(estimateNewTeamsQueryOptions)
  const teams = teamsData.teams

  const [orgPage, setOrgPage] = useState(1)
  const [builtInPage, setBuiltInPage] = useState(1)

  const builtInQuery = useQuery({
    queryKey: buildEstTemplateKey(
      'built-in',
      builtInPage,
      DEFAULT_TEMPLATE_PAGE_SIZE,
    ),
    queryFn: () =>
      fetchEstTemplates('built-in', builtInPage, DEFAULT_TEMPLATE_PAGE_SIZE),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const orgQuery = useQuery({
    queryKey: buildEstTemplateKey(
      'organization',
      orgPage,
      DEFAULT_TEMPLATE_PAGE_SIZE,
    ),
    queryFn: () =>
      fetchEstTemplates('organization', orgPage, DEFAULT_TEMPLATE_PAGE_SIZE),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const builtInTemplates = builtInQuery.data?.templates ?? []
  const builtInTotal = builtInQuery.data?.total ?? 0
  const builtInTotalPages = Math.max(
    1,
    Math.ceil(builtInTotal / DEFAULT_TEMPLATE_PAGE_SIZE),
  )

  const orgTemplates = orgQuery.data?.templates ?? []
  const orgTotal = orgQuery.data?.total ?? 0
  const orgTotalPages = Math.max(
    1,
    Math.ceil(orgTotal / DEFAULT_TEMPLATE_PAGE_SIZE),
  )

  // Wizard state
  const [step, setStep] = useState<Step>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  )
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState('')
  const [sprintLink, setSprintLink] = useState('')
  const [timerDuration, setTimerDuration] = useState<number | undefined>(120)

  const allTemplates = [...builtInTemplates, ...orgTemplates]
  const selectedTemplate = allTemplates.find((t) => t.id === selectedTemplateId)
  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  const { createSessionMutation } = useEstimateMutations()

  const steps: { id: Step; label: string }[] = [
    { id: 'template', label: 'Template' },
    { id: 'team', label: 'Team' },
    { id: 'settings', label: 'Settings' },
    { id: 'confirm', label: 'Confirm' },
  ]
  const stepIndex = steps.findIndex((s) => s.id === step)

  const canProceed = () => {
    switch (step) {
      case 'template':
        return true
      case 'team':
        return !!selectedTeamId
      case 'settings':
        return (
          sessionName.trim().length > 0 &&
          (sprintLink.trim().length === 0 ||
            /^https?:\/\//.test(sprintLink.trim()))
        )
      case 'confirm':
        return true
      default:
        return false
    }
  }

  const nextStep = () => {
    if (step === 'template') setStep('team')
    else if (step === 'team') setStep('settings')
    else if (step === 'settings') setStep('confirm')
  }

  const prevStep = () => {
    if (step === 'team') setStep('template')
    else if (step === 'settings') setStep('team')
    else if (step === 'confirm') setStep('settings')
  }

  const handleCreate = () => {
    if (!selectedTeamId) return
    createSessionMutation.mutate({
      name: sessionName.trim(),
      teamId: selectedTeamId,
      sprintLink: sprintLink.trim() || undefined,
      timerDuration,
      templateId: selectedTemplateId ?? undefined,
    })
  }

  const sprintLinkError =
    sprintLink.trim().length > 0 && !/^https?:\/\//.test(sprintLink.trim())
      ? 'Sprint link must be a valid URL'
      : ''

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: '/estimate' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Spade className="h-7 w-7 text-primary" />
            New Estimation Session
          </h1>
          <p className="text-muted-foreground">
            Set up your estimation session in a few simple steps
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium',
                i < stepIndex
                  ? 'border-primary bg-primary text-primary-foreground'
                  : i === stepIndex
                    ? 'border-primary text-primary'
                    : 'border-muted text-muted-foreground',
              )}
            >
              {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                'ml-2 text-sm font-medium',
                i <= stepIndex ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'mx-4 h-0.5 w-16',
                  i < stepIndex ? 'bg-primary' : 'bg-muted',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-3">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 'template'}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step === 'confirm' ? (
          <Button
            onClick={handleCreate}
            disabled={createSessionMutation.isPending || !selectedTeamId}
          >
            {createSessionMutation.isPending ? 'Creating...' : 'Create Session'}
          </Button>
        ) : (
          <div className="flex items-center">
            <Button onClick={nextStep} disabled={!canProceed()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Step Content */}
      <div className="min-h-100">
        {/* ── Template Step ── */}
        {step === 'template' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">
                Choose an Estimate Template
              </h2>
              <p className="text-muted-foreground">
                Select a voting scale for this session — or use the default
                story estimate values
              </p>
            </div>

            {/* No template selected indicator */}
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg border-2 border-dashed p-3 cursor-pointer transition-all',
                selectedTemplateId === null
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50',
              )}
              onClick={() => setSelectedTemplateId(null)}
            >
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border-2',
                  selectedTemplateId === null
                    ? 'border-primary bg-primary'
                    : 'border-muted',
                )}
              >
                {selectedTemplateId === null && (
                  <Check className="h-3 w-3 text-primary-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  Default story estimate values
                </p>
                <p className="text-xs text-muted-foreground">
                  0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕
                </p>
              </div>
            </div>

            {orgTotal === 0 && builtInTotal === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Layers className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No estimate templates available.
                  </p>
                </CardContent>
              </Card>
            )}

            {orgTotal > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Your Organization</h3>
                    <Badge variant="outline" className="text-xs">
                      {orgTotal} template{orgTotal !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {orgTotalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={orgPage <= 1}
                        onClick={() => setOrgPage((p) => p - 1)}
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground px-1">
                        {orgPage}/{orgTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={orgPage >= orgTotalPages}
                        onClick={() => setOrgPage((p) => p + 1)}
                      >
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {orgTemplates.map((tmpl) => (
                    <EstimateTemplateSelectCard
                      key={tmpl.id}
                      template={tmpl}
                      selected={selectedTemplateId === tmpl.id}
                      onSelect={() => setSelectedTemplateId(tmpl.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {builtInTotal > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Global Templates</h3>
                  {builtInTotalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={builtInPage <= 1}
                        onClick={() => setBuiltInPage((p) => p - 1)}
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground px-1">
                        {builtInPage}/{builtInTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={builtInPage >= builtInTotalPages}
                        onClick={() => setBuiltInPage((p) => p + 1)}
                      >
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {builtInTemplates.map((tmpl) => (
                    <EstimateTemplateSelectCard
                      key={tmpl.id}
                      template={tmpl}
                      selected={selectedTemplateId === tmpl.id}
                      onSelect={() => setSelectedTemplateId(tmpl.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Team Step ── */}
        {step === 'team' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Select Your Team</h2>
            <p className="text-muted-foreground">
              Choose which team this estimation session is for
            </p>
            {teams.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold">No Teams Found</h3>
                  <p className="mb-4 text-center text-muted-foreground">
                    You need to be a member of a team to create a session.
                  </p>
                  <Button asChild>
                    <Link to="/teams">Join or Create a Team</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {teams.map((team) => (
                  <Card
                    key={team.id}
                    className={cn(
                      'cursor-pointer transition-all hover:border-primary/50',
                      selectedTeamId === team.id &&
                        'border-primary ring-2 ring-primary ring-offset-2',
                    )}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{team.emoji ?? '👥'}</span>
                        <div>
                          <CardTitle>{team.name}</CardTitle>
                          <CardDescription>
                            {team.organization?.name ?? 'Organization'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Badge
                        variant={
                          team.myRole === 'team-lead' ? 'default' : 'outline'
                        }
                      >
                        {team.myRole === 'team-lead' ? 'Team Lead' : 'Member'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Settings Step ── */}
        {step === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Configure Settings</h2>
            <p className="text-muted-foreground">
              Set the session name, sprint link, and default timer
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sessionName">
                  Session Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sessionName"
                  placeholder="Sprint 42 Estimation"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className={
                    sessionName.trim().length === 0 ? 'border-destructive' : ''
                  }
                />
                {sessionName.trim().length === 0 && (
                  <p className="text-xs text-destructive">
                    Session name is required
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sprintLink">Sprint Link (optional)</Label>
                <Input
                  id="sprintLink"
                  placeholder="https://jira.example.com/secure/RapidBoard.jspa"
                  value={sprintLink}
                  onChange={(e) => setSprintLink(e.target.value)}
                  className={sprintLinkError ? 'border-destructive' : ''}
                />
                {sprintLinkError && (
                  <p className="text-xs text-destructive">{sprintLinkError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timer">Default Timer per Story</Label>
                <Select
                  value={timerDuration?.toString() ?? 'none'}
                  onValueChange={(v) =>
                    setTimerDuration(
                      v === 'none' ? undefined : Number.parseInt(v),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No timer</SelectItem>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="120">2 minutes</SelectItem>
                    <SelectItem value="180">3 minutes</SelectItem>
                    <SelectItem value="300">5 minutes</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Countdown that auto-starts when each story round begins
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirm Step ── */}
        {step === 'confirm' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Review & Create</h2>
            <p className="text-muted-foreground">
              Review your settings and create the session
            </p>

            <Card>
              <CardHeader>
                <CardTitle>{sessionName}</CardTitle>
                <CardDescription>
                  {selectedTeam?.name} &bull; {selectedTeam?.organization?.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Template preview */}
                <div>
                  <Label className="text-muted-foreground">
                    Estimate Template
                  </Label>
                  <div className="mt-1">
                    {selectedTemplate ? (
                      <div className="space-y-1">
                        <span className="font-medium">
                          {selectedTemplate.name}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {selectedTemplate.values.slice(0, 8).map((v) => (
                            <span
                              key={v.id}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted font-medium"
                              style={{
                                color: selectedTemplate.color ?? '#6366f1',
                              }}
                            >
                              {v.label}
                            </span>
                          ))}
                          {selectedTemplate.values.length > 8 && (
                            <span className="text-xs text-muted-foreground">
                              +{selectedTemplate.values.length - 8}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Default story estimate (0, ½, 1, 2, 3, 5, 8, 13…)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Timer</p>
                      <p className="text-xs text-muted-foreground">
                        {timerDuration
                          ? `${timerDuration / 60} minute${timerDuration / 60 !== 1 ? 's' : ''}`
                          : 'No timer'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {selectedTeam?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedTeam?.organization?.name}
                      </p>
                    </div>
                  </div>

                  {sprintLink && (
                    <div className="flex items-center gap-3 rounded-lg border p-3 md:col-span-2">
                      <Spade className="h-5 w-5 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Sprint Link</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {sprintLink}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {createSessionMutation.isError && (
                  <p className="text-sm text-destructive">
                    {createSessionMutation.error instanceof Error
                      ? createSessionMutation.error.message
                      : 'Failed to create session. Please try again.'}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function EstimateTemplateSelectCard({
  template,
  selected,
  onSelect,
}: {
  template: EstimateTemplate
  selected: boolean
  onSelect: () => void
}) {
  const themeColor = template.color ?? '#6366f1'
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50',
        selected && 'border-primary ring-2 ring-primary ring-offset-2',
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{template.name}</CardTitle>
            {template.description && (
              <CardDescription className="text-xs mt-0.5 line-clamp-2">
                {template.description}
              </CardDescription>
            )}
          </div>
          {template.isBuiltIn ? (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 shrink-0"
            >
              Built-in
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 shrink-0"
            >
              {template.organizationName ?? 'Org'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-1">
          {template.values.slice(0, 8).map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted font-medium"
              style={{ color: themeColor }}
            >
              {v.label}
            </span>
          ))}
          {template.values.length > 8 && (
            <span className="text-xs text-muted-foreground">
              +{template.values.length - 8}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
