import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Eye,
  EyeOff,
  Users,
  Vote,
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
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import {
  RETROS_ENDPOINTS,
  TEAMS_ENDPOINTS,
  TEMPLATES_ENDPOINTS,
} from '@/lib/api-endpoints'
import type { Template } from '@/common/types/templates'
import type { Team } from '@/common/types/teams'
import type { CreateRetroInput } from '@/common/types/retros'
import { cn } from '@/lib/utils'
import type { PaginatedTemplatesResponse } from './types'
import { NewRetroSkeleton } from './skeleton'

const DEFAULT_TEMPLATE_PAGE_SIZE = 6

function buildTemplatesQueryKey(
  type: 'built-in' | 'organization',
  page: number,
  limit: number,
) {
  return ['new-retro-templates', type, page, limit] as const
}

function fetchTemplates(
  type: 'built-in' | 'organization',
  page: number,
  limit: number,
) {
  return api.get<PaginatedTemplatesResponse>(
    `${TEMPLATES_ENDPOINTS.LIST}?type=${type}&page=${page}&limit=${limit}`,
  )
}

const newRetroTeamsQueryOptions = {
  queryKey: ['teams'] as const,
  queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
  staleTime: 30_000,
}

export const Route = createFileRoute('/retros/new')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData({
        queryKey: buildTemplatesQueryKey(
          'built-in',
          1,
          DEFAULT_TEMPLATE_PAGE_SIZE,
        ),
        queryFn: () =>
          fetchTemplates('built-in', 1, DEFAULT_TEMPLATE_PAGE_SIZE),
      }),
      queryClient.ensureQueryData({
        queryKey: buildTemplatesQueryKey(
          'organization',
          1,
          DEFAULT_TEMPLATE_PAGE_SIZE,
        ),
        queryFn: () =>
          fetchTemplates('organization', 1, DEFAULT_TEMPLATE_PAGE_SIZE),
      }),
      queryClient.ensureQueryData(newRetroTeamsQueryOptions),
    ]),
  pendingComponent: NewRetroSkeleton,
  component: NewRetroPage,
})

type Step = 'template' | 'team' | 'settings' | 'confirm'

function NewRetroPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: teamsData } = useSuspenseQuery(newRetroTeamsQueryOptions)
  const teams = teamsData.teams

  // Template pagination state
  const [orgPage, setOrgPage] = useState(1)
  const [builtInPage, setBuiltInPage] = useState(1)

  const builtInQuery = useQuery({
    queryKey: buildTemplatesQueryKey(
      'built-in',
      builtInPage,
      DEFAULT_TEMPLATE_PAGE_SIZE,
    ),
    queryFn: () =>
      fetchTemplates('built-in', builtInPage, DEFAULT_TEMPLATE_PAGE_SIZE),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const orgQuery = useQuery({
    queryKey: buildTemplatesQueryKey(
      'organization',
      orgPage,
      DEFAULT_TEMPLATE_PAGE_SIZE,
    ),
    queryFn: () =>
      fetchTemplates('organization', orgPage, DEFAULT_TEMPLATE_PAGE_SIZE),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const builtInTemplates = (builtInQuery.data?.templates ?? []).map((t) => ({
    ...t,
    description: t.description ?? null,
    organizationId: t.organizationId ?? null,
  })) as Template[]
  const builtInTotal = builtInQuery.data?.total ?? 0
  const builtInTotalPages = Math.max(
    1,
    Math.ceil(builtInTotal / DEFAULT_TEMPLATE_PAGE_SIZE),
  )

  const orgTemplates = (orgQuery.data?.templates ?? []).map((t) => ({
    ...t,
    description: t.description ?? null,
    organizationId: t.organizationId ?? null,
  })) as Template[]
  const orgTotal = orgQuery.data?.total ?? 0
  const orgTotalPages = Math.max(
    1,
    Math.ceil(orgTotal / DEFAULT_TEMPLATE_PAGE_SIZE),
  )

  const allVisibleTemplates = [...builtInTemplates, ...orgTemplates]

  // Wizard state
  const [step, setStep] = useState<Step>('template')

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  )
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [retroName, setRetroName] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(true)
  const voteType = 'multi' as const
  const [maxVotes, setMaxVotes] = useState(3)
  const [timerEnabled, setTimerEnabled] = useState(true)
  const [timerMinutes, setTimerMinutes] = useState(5)

  const selectedTemplate = allVisibleTemplates.find(
    (t) => t.id === selectedTemplateId,
  )
  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>(RETROS_ENDPOINTS.LIST, {
        name: retroName || `${selectedTemplate?.name} Retro`,
        teamId: selectedTeamId!,
        templateId: selectedTemplateId!,
        isAnonymous,
        voteType,
        maxVotesPerUser: maxVotes,
        timerDuration: timerEnabled ? timerMinutes * 60 : undefined,
      } satisfies CreateRetroInput),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['retros'] })
      navigate({ to: '/retros/$retroId', params: { retroId: data.id } })
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to create retro'),
  })

  const canProceed = () => {
    switch (step) {
      case 'template':
        return !!selectedTemplateId
      case 'team':
        return !!selectedTeamId
      case 'settings':
        return true
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

  const steps: { id: Step; label: string }[] = [
    { id: 'template', label: 'Template' },
    { id: 'team', label: 'Team' },
    { id: 'settings', label: 'Settings' },
    { id: 'confirm', label: 'Confirm' },
  ]

  const stepIndex = steps.findIndex((s) => s.id === step)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/retros" search={{ page: 1, limit: 6 }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            New Retrospective
          </h1>
          <p className="text-muted-foreground">
            Set up your retrospective in a few simple steps
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
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending || !selectedTemplateId || !selectedTeamId
            }
          >
            {createMutation.isPending ? 'Creating...' : 'Create Retrospective'}
          </Button>
        ) : (
          <Button onClick={nextStep} disabled={!canProceed()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="min-h-[400px]">
        {step === 'template' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Choose a Template</h2>
              <p className="text-muted-foreground">
                Select a retrospective format that fits your team's needs
              </p>
            </div>

            {orgTotal === 0 && builtInTotal === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">
                    No templates available. Please refresh to seed templates.
                  </p>
                </CardContent>
              </Card>
            )}

            {orgTotal > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      Your Organization
                    </h3>
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
                    <TemplateCard
                      key={tmpl.id}
                      tmpl={tmpl}
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
                  <h3 className="text-sm font-semibold text-foreground">
                    Global Templates
                  </h3>
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
                    <TemplateCard
                      key={tmpl.id}
                      tmpl={tmpl}
                      selected={selectedTemplateId === tmpl.id}
                      onSelect={() => setSelectedTemplateId(tmpl.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'team' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Select Your Team</h2>
            <p className="text-muted-foreground">
              Choose which team this retrospective is for
            </p>
            {teams.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold">No Teams Found</h3>
                  <p className="mb-4 text-center text-muted-foreground">
                    You need to be a member of a team to create a retrospective.
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

        {step === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Configure Settings</h2>
            <p className="text-muted-foreground">
              Customize how your retrospective will work
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Retro Name */}
              <div className="space-y-2">
                <Label htmlFor="retroName">Retrospective Name (optional)</Label>
                <Input
                  id="retroName"
                  placeholder={`${selectedTemplate?.name} Retro`}
                  value={retroName}
                  onChange={(e) => setRetroName(e.target.value)}
                />
              </div>

              {/* Timer */}
              <div className="space-y-2">
                <Label htmlFor="timer">Card Creation Timer</Label>
                <div className="flex items-center gap-4">
                  <Switch
                    id="timer"
                    checked={timerEnabled}
                    onCheckedChange={setTimerEnabled}
                  />
                  {timerEnabled && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={timerMinutes}
                        onChange={(e) =>
                          setTimerMinutes(Number(e.target.value))
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        minutes
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {timerEnabled
                    ? 'Cards are hidden from others until the timer ends'
                    : 'Cards are visible immediately to all participants'}
                </p>
              </div>

              {/* Anonymous */}
              <div className="space-y-2">
                <Label>Anonymous Mode</Label>
                <div className="flex items-center gap-4">
                  <Switch
                    checked={isAnonymous}
                    onCheckedChange={setIsAnonymous}
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isAnonymous ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Authors hidden
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Authors visible
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isAnonymous
                    ? 'Card authors are hidden to encourage honest feedback'
                    : 'Card authors are visible to all participants'}
                </p>
              </div>

              {/* Voting */}
              <div className="space-y-2">
                <Label>Voting Type</Label>
                <p className="text-sm text-muted-foreground">
                  Multi-vote (set votes per person to 1 for single-vote
                  behavior)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxVotes">Votes per Person</Label>
                <Select
                  value={String(maxVotes)}
                  onValueChange={(v) => setMaxVotes(Number(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} vote{n > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Review & Create</h2>
            <p className="text-muted-foreground">
              Review your settings and create the retrospective
            </p>

            <Card>
              <CardHeader>
                <CardTitle>
                  {retroName || `${selectedTemplate?.name} Retro`}
                </CardTitle>
                <CardDescription>
                  {selectedTeam?.name} • {selectedTeam?.organization?.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Template Preview */}
                <div>
                  <Label className="text-muted-foreground">Template</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-medium">
                      {selectedTemplate?.name}
                    </span>
                    <div className="flex gap-1">
                      {selectedTemplate?.columns?.map((col) => (
                        <span key={col.id} className="text-lg" title={col.name}>
                          {col.emoji}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Settings Summary */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Timer</p>
                      <p className="text-xs text-muted-foreground">
                        {timerEnabled ? `${timerMinutes} minutes` : 'No timer'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    {isAnonymous ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {isAnonymous ? 'Anonymous' : 'Named'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isAnonymous ? 'Authors hidden' : 'Authors visible'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Vote className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Multi-vote</p>
                      <p className="text-xs text-muted-foreground">
                        {`${maxVotes} vote${maxVotes > 1 ? 's' : ''} per person`}
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
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function TemplateCard({
  tmpl,
  selected,
  onSelect,
}: {
  tmpl: Template
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50',
        selected && 'border-primary ring-2 ring-primary ring-offset-2',
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-snug break-all min-w-0 line-clamp-2">
            {tmpl.name}
          </CardTitle>
          {tmpl.isBuiltIn ? (
            <Badge variant="secondary" className="text-xs shrink-0">
              Built-in
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-xs border-primary/40 text-primary shrink-0"
            >
              Org
            </Badge>
          )}
        </div>
        <CardDescription className="text-sm line-clamp-2">
          {tmpl.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {tmpl.columns?.map((col) => (
            <div
              key={col.id}
              className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 max-w-full min-w-0"
            >
              <span className="text-lg shrink-0">{col.emoji}</span>
              <span className="text-xs font-medium truncate">{col.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
