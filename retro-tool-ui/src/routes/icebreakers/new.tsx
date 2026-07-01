import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Shuffle, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import {
  ICEBREAKER_TEMPLATES_ENDPOINTS,
  TEAMS_ENDPOINTS,
} from '@/lib/api-endpoints'
import type { Team } from '@/common/types/teams'
import type {
  CreateIcebreakerSessionInput,
  PaginatedIcebreakerTemplatesResponse,
} from '@/common/types/icebreakers'
import { ICEBREAKER_SELECTION_MODES } from '@/common/enums/icebreaker.enums'
import type {
  TIcebreakerFlavour,
  TIcebreakerSelectionMode,
} from '@/common/enums/icebreaker.enums'
import { cn } from '@/lib/utils'
import { useIcebreakerMutations } from './hooks/use-icebreaker-mutations'
import { NewIcebreakerSkeleton } from './skeleton'
import {
  ALL_FLAVOURS,
  FLAVOUR_ACCENTS,
  FLAVOUR_LABELS,
  defaultSessionName,
} from './helpers'

export const Route = createFileRoute('/icebreakers/new')({
  component: NewIcebreakerPage,
})

function NewIcebreakerPage() {
  // Pre-fill with the current day/date/time (e.g. "Monday 9th March - 8pm") so
  // a host can start a standup session without typing a name. Computed once on
  // mount; the host can still edit it.
  const [name, setName] = useState(defaultSessionName)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState<TIcebreakerSelectionMode>(
    ICEBREAKER_SELECTION_MODES.Ordered,
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  )
  const [flavourFilter, setFlavourFilter] = useState<TIcebreakerFlavour | null>(
    null,
  )

  const { createSessionMutation } = useIcebreakerMutations()

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
    staleTime: 60_000,
  })

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['new-icebreaker-templates'],
    queryFn: () =>
      api.get<PaginatedIcebreakerTemplatesResponse>(
        `${ICEBREAKER_TEMPLATES_ENDPOINTS.LIST}?page=1&limit=50`,
      ),
  })

  const isRandom = selectionMode === ICEBREAKER_SELECTION_MODES.Random

  const templates = useMemo(
    () => templatesData?.templates ?? [],
    [templatesData],
  )

  const canSubmit =
    name.trim().length > 0 &&
    selectedTeamId !== null &&
    (isRandom || selectedTemplateId !== null) &&
    !createSessionMutation.isPending

  const handleSubmit = () => {
    if (!selectedTeamId) return
    const payload: CreateIcebreakerSessionInput = {
      name: name.trim(),
      teamId: selectedTeamId,
      selectionMode,
      ...(isRandom
        ? { flavourFilter: flavourFilter ?? undefined }
        : { templateId: selectedTemplateId ?? undefined }),
    }
    createSessionMutation.mutate(payload)
  }

  if (templatesLoading) {
    return <NewIcebreakerSkeleton />
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/icebreakers">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to icebreakers</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-primary" />
            New Icebreaker
          </h1>
          <p className="text-muted-foreground">
            Pick a deck and warm up your team
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session details</CardTitle>
          <CardDescription>Name the session and pick a team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="icebreaker-name">Session name</Label>
            <Input
              id="icebreaker-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Monday standup warm-up"
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label>Team</Label>
            <Select
              value={selectedTeamId ?? undefined}
              onValueChange={setSelectedTeamId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {(teamsData?.teams ?? []).map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How should prompts be chosen?</CardTitle>
          <CardDescription>
            Use a specific deck in order, or pull a random reproducible mix.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={selectionMode}
            onValueChange={(value) =>
              setSelectionMode(value as TIcebreakerSelectionMode)
            }
            className="grid gap-3 sm:grid-cols-2"
          >
            <Label
              htmlFor="mode-ordered"
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border p-4',
                !isRandom && 'border-primary ring-1 ring-primary',
              )}
            >
              <RadioGroupItem
                value={ICEBREAKER_SELECTION_MODES.Ordered}
                id="mode-ordered"
              />
              <div className="space-y-1">
                <p className="font-medium">Pick a template</p>
                <p className="text-sm text-muted-foreground">
                  Use the prompts from a chosen deck.
                </p>
              </div>
            </Label>
            <Label
              htmlFor="mode-random"
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border p-4',
                isRandom && 'border-primary ring-1 ring-primary',
              )}
            >
              <RadioGroupItem
                value={ICEBREAKER_SELECTION_MODES.Random}
                id="mode-random"
              />
              <div className="space-y-1">
                <p className="font-medium flex items-center gap-1.5">
                  <Shuffle className="h-4 w-4" />
                  Random mix
                </p>
                <p className="text-sm text-muted-foreground">
                  Shuffle built-in prompts (reproducible by seed).
                </p>
              </div>
            </Label>
          </RadioGroup>

          {isRandom ? (
            <div className="space-y-2">
              <Label>Flavour (optional)</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFlavourFilter(null)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm',
                    flavourFilter === null &&
                      'border-primary bg-primary/10 text-primary',
                  )}
                >
                  Any
                </button>
                {ALL_FLAVOURS.map((flavour) => (
                  <button
                    key={flavour}
                    type="button"
                    onClick={() => setFlavourFilter(flavour)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm',
                      flavourFilter === flavour &&
                        'border-primary bg-primary/10 text-primary',
                    )}
                  >
                    {FLAVOUR_LABELS[flavour]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label>Choose a deck</Label>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No icebreaker templates available yet. Ask an admin to seed
                  the built-in decks.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={cn(
                        'rounded-lg border p-4 text-left transition-colors hover:border-primary/50',
                        selectedTemplateId === template.id &&
                          'border-primary ring-1 ring-primary',
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-medium">{template.name}</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'shrink-0',
                            FLAVOUR_ACCENTS[template.flavour],
                          )}
                        >
                          {FLAVOUR_LABELS[template.flavour]}
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {template.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {template.prompts.length} prompt
                        {template.prompts.length === 1 ? '' : 's'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between pt-2">
        <Button asChild variant="outline">
          <Link to="/icebreakers">Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {createSessionMutation.isPending ? 'Creating…' : 'Create icebreaker'}
        </Button>
      </div>
    </div>
  )
}
