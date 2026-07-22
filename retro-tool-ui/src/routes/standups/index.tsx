import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  OctagonX,
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
import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { STANDUPS_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import { cn } from '@/lib/utils'
import type { StandupSummary } from '@/common/types/standups'
import type { Team } from '@/common/types/teams'
import { StandupCalendar } from './components/standup-calendar'
import { StandupListSkeleton } from './skeleton'
import {
  CADENCE_LABELS,
  formatEntryDate,
  formatTimeRange,
  scheduleDaysLabel,
  standupsScheduledOn,
  toDateString,
  todayDateString,
} from './helpers'

export const Route = createFileRoute('/standups/')({
  component: StandupsIndexPage,
})

function StandupsIndexPage() {
  const today = todayDateString()
  const now = new Date()
  const navigate = useNavigate()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState(today)

  // Open a standup room for a given day. Today drops the date param so the room
  // opens on its default (today) view — matching the StandupCard links.
  const openRoom = (standupId: string, date: string) => {
    void navigate({
      to: '/standups/$standupId',
      params: { standupId },
      search: date === today ? {} : { date },
    })
  }

  const {
    data: standups,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['standups'],
    queryFn: () => api.get<StandupSummary[]>(STANDUPS_ENDPOINTS.LIST),
    staleTime: 30_000,
    // No list-level realtime projection exists for standups, so poll as a
    // backstop: a standup created by another manager appears here within the
    // interval instead of requiring a manual reload.
    refetchInterval: 30_000,
  })

  // Creating a standup is a manager action (team-lead, org owner/admin, or
  // system-admin). Offer "New Standup" only when the viewer holds that role on
  // at least one team — mirrors the server's assertCanCreateStandup guard.
  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
    staleTime: 60_000,
  })
  const canCreateStandup = (teamsData?.teams ?? []).some(
    (team) =>
      team.isSystemAdmin ||
      team.orgRole === 'org-owner' ||
      team.orgRole === 'org-admin' ||
      team.myRole === 'team-lead',
  )

  // Activity (entry dates with submissions) for the visible calendar grid —
  // fetched with a week of padding on both sides for the adjacent-month cells.
  const gridStart = toDateString(new Date(year, month, -6))
  const gridEnd = toDateString(new Date(year, month + 1, 13))
  const { data: activityRows } = useQuery({
    queryKey: ['standup-activity', gridStart, gridEnd],
    queryFn: () =>
      api.get<
        { standupId: string; entryDate: string; submissionCount: number }[]
      >(STANDUPS_ENDPOINTS.ACTIVITY(gridStart, gridEnd)),
    staleTime: 30_000,
  })

  const activity = useMemo(
    () =>
      new Set(
        (activityRows ?? []).map((row) => `${row.standupId}:${row.entryDate}`),
      ),
    [activityRows],
  )

  // Standups shown for the selected day, grouped per team. Same rule as the
  // calendar dots: future/today shows scheduled standups; past days only show
  // rooms that actually have submissions.
  const teamsForDay = useMemo(() => {
    if (!standups) return []
    const scheduled = standupsScheduledOn(
      standups,
      selectedDate,
      activity,
      today,
    )
    const byTeam = new Map<
      string,
      { teamName: string; teamEmoji: string | null; items: StandupSummary[] }
    >()
    for (const standup of scheduled) {
      const group = byTeam.get(standup.teamId) ?? {
        teamName: standup.team.name,
        teamEmoji: standup.team.emoji,
        items: [],
      }
      group.items.push(standup)
      byTeam.set(standup.teamId, group)
    }
    return [...byTeam.entries()].map(([teamId, group]) => ({
      teamId,
      ...group,
    }))
  }, [standups, activity, selectedDate, today])

  if (isLoading) {
    return <StandupListSkeleton />
  }

  const hasStandups = !isError && standups && standups.length > 0
  const isSelectedToday = selectedDate === today

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-8">
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
          {canCreateStandup && (
            <Button asChild>
              <Link to="/standups/new">
                <Plus className="mr-2 h-4 w-4" />
                New Standup
              </Link>
            </Button>
          )}
        </div>

        {!hasStandups ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <CalendarCheck className="h-12 w-12 text-primary" />
              </div>
              <CardTitle className="mb-2">No standups yet</CardTitle>
              <CardDescription className="text-center max-w-sm">
                {canCreateStandup
                  ? 'Create a standup with custom questions and a schedule. Your team gets a persistent room for each day — no meetings required.'
                  : 'No standups have been set up for your teams yet. A team lead or admin can create one.'}
              </CardDescription>
              {canCreateStandup && (
                <Button asChild className="mt-4">
                  <Link to="/standups/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Standup
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <StandupCalendar
              standups={standups}
              activity={activity}
              month={month}
              year={year}
              selectedDate={selectedDate}
              onMonthChange={(nextMonth, nextYear) => {
                setMonth(nextMonth)
                setYear(nextYear)
              }}
              onSelectDate={setSelectedDate}
              onOpenRoom={openRoom}
            />

            {/* Selected day */}
            <section className="space-y-6">
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-semibold">
                  {formatEntryDate(selectedDate)}
                </h2>
                {isSelectedToday && <Badge variant="secondary">Today</Badge>}
              </div>

              {teamsForDay.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    No standups scheduled on this day.
                  </CardContent>
                </Card>
              ) : (
                teamsForDay.map((team) => (
                  <div key={team.teamId} className="space-y-3">
                    <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-semibold text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {team.teamEmoji ? `${team.teamEmoji} ` : ''}
                      {team.teamName}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {team.items.map((standup) => (
                        <StandupCard
                          key={standup.id}
                          standup={standup}
                          date={selectedDate}
                          isToday={isSelectedToday}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

function StandupCard({
  standup,
  date,
  isToday,
}: {
  standup: StandupSummary
  date: string
  isToday: boolean
}) {
  const isOngoing = standup.isActive && date >= todayDateString()

  return (
    <Card
      className={cn(
        'flex h-full flex-col transition-all hover:shadow-md',
        isOngoing
          ? 'border-emerald-500/30 hover:border-emerald-500/60'
          : 'border-border opacity-90 hover:border-primary/40',
      )}
    >
      <CardHeader>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <CardTitle className="min-w-0 flex-1 truncate text-lg">
            {standup.name}
          </CardTitle>
          {isOngoing ? (
            <Badge
              variant="secondary"
              className="shrink-0 gap-1.5 whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {CADENCE_LABELS[standup.cadence]}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="shrink-0 gap-1 whitespace-nowrap"
            >
              <OctagonX className="h-3 w-3" />
              {standup.isActive ? 'Past day' : 'Ended'}
            </Badge>
          )}
        </div>
        <CardDescription className="truncate">
          {standup.team.emoji ? `${standup.team.emoji} ` : ''}
          {standup.team.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{scheduleDaysLabel(standup.scheduleDays)}</span>
          {formatTimeRange(standup.startTime, standup.endTime) && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeRange(standup.startTime, standup.endTime)}
            </span>
          )}
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
          {isToday ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {standup.todaySubmissionCount}/{standup.memberCount} submitted
              today
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              View this day&apos;s updates
            </span>
          )}
          <Button
            asChild
            size="sm"
            className="gap-1"
            variant={isOngoing ? 'default' : 'outline'}
          >
            <Link
              to="/standups/$standupId"
              params={{ standupId: standup.id }}
              search={isToday ? {} : { date }}
            >
              Open room
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
