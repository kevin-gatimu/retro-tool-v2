import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowLeft, Spade } from 'lucide-react'
import { useState } from 'react'

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
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import { useEstimateMutations } from './hooks/useEstimateMutations'
import type { Team } from '@/common/types/teams'

const estimateNewTeamsQueryOptions = {
  queryKey: ['teams'] as const,
  queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
  staleTime: 30_000,
}

function EstimateSessionsListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-9 w-48" />
          </div>
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-1/2" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/estimate/new')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(estimateNewTeamsQueryOptions),
  pendingComponent: EstimateSessionsListSkeleton,
  component: NewEstimateSessionPage,
})

function NewEstimateSessionPage() {
  const navigate = useNavigate()

  const { data: teamsData } = useSuspenseQuery(estimateNewTeamsQueryOptions)
  const teams = teamsData.teams

  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState('')
  const [sprintLink, setSprintLink] = useState('')
  const [timerDuration, setTimerDuration] = useState<number | undefined>(120)
  const [touched, setTouched] = useState({
    name: false,
    teamId: false,
    sprintLink: false,
  })

  const errors = {
    name: !name.trim() ? 'Session name is required' : '',
    teamId: !teamId ? 'Please select a team' : '',
    sprintLink:
      sprintLink.trim().length > 0 && !/^https?:\/\//.test(sprintLink.trim())
        ? 'Sprint link must be a valid URL (http/https)'
        : '',
  }

  const { createSessionMutation } = useEstimateMutations()

  const isValid = !errors.name && !errors.teamId && !errors.sprintLink

  const handleSubmit = () => {
    setTouched({
      name: true,
      teamId: true,
      sprintLink: true,
    })
    if (isValid)
      createSessionMutation.mutate({
        name,
        teamId,
        sprintLink: sprintLink.trim() || undefined,
        timerDuration,
      })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: '/estimate' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Spade className="h-6 w-6 text-primary" />
            New Estimation Session
          </h1>
          <p className="text-muted-foreground">
            Start estimating stories with your team
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
          <CardDescription>Configure your estimation session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              Session Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Sprint 42 Estimation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              aria-invalid={touched.name && !!errors.name}
              className={
                touched.name && errors.name ? 'border-destructive' : ''
              }
            />
            {touched.name && errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="team">
              Team <span className="text-destructive">*</span>
            </Label>
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You are not a member of any team. Join a team first.
              </p>
            ) : (
              <Select
                value={teamId}
                onValueChange={(v) => {
                  setTeamId(v)
                  setTouched((t) => ({ ...t, teamId: true }))
                }}
              >
                <SelectTrigger
                  className={
                    touched.teamId && errors.teamId ? 'border-destructive' : ''
                  }
                >
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.emoji} {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {touched.teamId && errors.teamId && (
              <p className="text-xs text-destructive">{errors.teamId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sprintLink">Sprint Link (optional)</Label>
            <Input
              id="sprintLink"
              placeholder="https://jira.example.com/secure/RapidBoard.jspa"
              value={sprintLink}
              onChange={(e) => setSprintLink(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, sprintLink: true }))}
              aria-invalid={touched.sprintLink && !!errors.sprintLink}
              className={
                touched.sprintLink && errors.sprintLink
                  ? 'border-destructive'
                  : ''
              }
            />
            {touched.sprintLink && errors.sprintLink && (
              <p className="text-xs text-destructive">{errors.sprintLink}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timer">Default timer per story estimate</Label>
            <Select
              value={timerDuration?.toString() ?? 'none'}
              onValueChange={(v) =>
                setTimerDuration(v === 'none' ? undefined : Number.parseInt(v))
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

          {createSessionMutation.isError && (
            <p className="text-sm text-destructive">
              {createSessionMutation.error instanceof Error
                ? createSessionMutation.error.message
                : 'Failed to create session. Please try again.'}
            </p>
          )}

          <Button
            className="w-full"
            disabled={createSessionMutation.isPending}
            onClick={handleSubmit}
          >
            {createSessionMutation.isPending ? 'Creating...' : 'Create Session'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
