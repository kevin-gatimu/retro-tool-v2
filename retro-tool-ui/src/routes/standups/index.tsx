import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Plus,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { api } from '@/lib/api'
import { STANDUPS_ENDPOINTS } from '@/lib/api-endpoints'
import type { StandupSummary } from '@/common/types/standups'
import { StandupListSkeleton } from './skeleton'
import { CADENCE_LABELS, scheduleDaysLabel } from './helpers'

export const Route = createFileRoute('/standups/')({
  component: StandupsIndexPage,
})

function StandupsIndexPage() {
  const {
    data: standups,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['standups'],
    queryFn: () => api.get<StandupSummary[]>(STANDUPS_ENDPOINTS.LIST),
    staleTime: 30_000,
  })

  if (isLoading) {
    return <StandupListSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CalendarCheck className="h-8 w-8 text-primary" />
            Standups
          </h1>
          <p className="text-muted-foreground">
            Async daily updates that keep your team aligned
          </p>
        </div>
        <Button asChild>
          <Link to="/standups/new">
            <Plus className="mr-2 h-4 w-4" />
            New Standup
          </Link>
        </Button>
      </div>

      {isError || !standups || standups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <CalendarCheck className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mb-2">No standups yet</CardTitle>
            <CardDescription className="text-center max-w-sm">
              Create a standup with custom questions and a schedule. Your team
              gets a persistent room for each day — no meetings required.
            </CardDescription>
            <Button asChild className="mt-4">
              <Link to="/standups/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Standup
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {standups.map((standup) => (
            <StandupCard key={standup.id} standup={standup} />
          ))}
        </div>
      )}
    </div>
  )
}

function StandupCard({ standup }: { standup: StandupSummary }) {
  return (
    <Card className="flex h-full flex-col border-primary/20 transition-all hover:border-primary/50 hover:shadow-md">
      <CardHeader>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <CardTitle className="min-w-0 flex-1 truncate text-lg">
            {standup.name}
          </CardTitle>
          <Badge
            variant={standup.isActive ? 'secondary' : 'outline'}
            className="shrink-0 whitespace-nowrap"
          >
            {standup.isActive ? CADENCE_LABELS[standup.cadence] : 'Paused'}
          </Badge>
        </div>
        <CardDescription className="truncate">
          {standup.team.emoji ? `${standup.team.emoji} ` : ''}
          {standup.team.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{scheduleDaysLabel(standup.scheduleDays)}</span>
          <span>
            {standup.questions.length} question
            {standup.questions.length === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {standup.memberCount}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {standup.todaySubmissionCount}/{standup.memberCount} submitted today
          </span>
          <Button asChild size="sm" className="gap-1">
            <Link to="/standups/$standupId" params={{ standupId: standup.id }}>
              Open room
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
