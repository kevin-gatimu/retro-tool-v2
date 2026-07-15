import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  MoreVertical,
  OctagonX,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Vote,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { UserAvatar } from '@/components/user-avatar'
import { api } from '@/lib/api'
import { getStandupSocket } from '@/lib/socket'
import { STANDUPS_ENDPOINTS } from '@/lib/api-endpoints'
import { usesConvexForStandups } from '@/lib/realtime-config'
import { cn } from '@/lib/utils'
import type {
  StandupEntryDetail,
  StandupSubmission,
} from '@/common/types/standups'
import type { PollView } from '@/common/types/polls'
import { StandupConvexSync } from './components/standup-convex-sync'
import { SubmissionDialog } from './components/submission-dialog'
import { CommentsPanel } from './components/comments-panel'
import { ReactionBar } from './components/reaction-bar'
import { StandupReportMenu } from './components/standup-report-menu'
import { EditStandupDialog } from './components/edit-standup-dialog'
import { SkipDaysDialog } from './components/skip-days-dialog'
import { PollCard } from '@/components/polls/poll-card'
import { CreatePollDialog } from '@/components/polls/create-poll-dialog'
import { usePollMutations } from '@/hooks/use-poll-mutations'
import { IcebreakerSessionCard } from '@/components/icebreakers/icebreaker-session-card'
import { StartIcebreakerDialog } from '@/components/icebreakers/start-icebreaker-dialog'
import { IcebreakerRunnerDialog } from '@/components/icebreakers/icebreaker-runner-dialog'
import { useIcebreakerMutations } from '@/routes/icebreakers/hooks/use-icebreaker-mutations'
import { StandupRoomSkeleton } from './skeleton'
import { useStandupEntryMutations } from './hooks/use-standup-mutations'
import {
  formatEntryDate,
  formatTimeRange,
  shiftDate,
  todayDateString,
} from './helpers'

type StandupSearch = {
  date?: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const Route = createFileRoute('/standups/$standupId')({
  validateSearch: (search: Record<string, unknown>): StandupSearch => {
    const date = typeof search.date === 'string' ? search.date : undefined
    return { date: date && DATE_PATTERN.test(date) ? date : undefined }
  },
  component: StandupRoomPage,
})

function StandupRoomPage() {
  const { standupId } = Route.useParams()
  const { date: dateParam } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const usesConvexRealtime = usesConvexForStandups()

  const date = dateParam ?? todayDateString()
  const isToday = date === todayDateString()

  const setDate = (nextDate: string) => {
    navigate({
      search: {
        date: nextDate === todayDateString() ? undefined : nextDate,
      },
    })
  }

  const {
    data: entryDetail,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['standup-entry', standupId, date],
    queryFn: () =>
      api.get<StandupEntryDetail>(STANDUPS_ENDPOINTS.ENTRY(standupId, date)),
    staleTime: 15_000,
    refetchInterval: usesConvexRealtime ? false : 10_000,
  })

  // Socket.IO fallback realtime: refetch the room when anything changes.
  useEffect(() => {
    if (usesConvexRealtime) {
      return
    }

    const socket = getStandupSocket()
    const joinRoom = () => socket.emit('join-standup', { standupId })

    const onEntryChanged = (payload: { standupId: string; date: string }) => {
      void queryClient.refetchQueries({
        queryKey: ['standup-entry', payload.standupId, payload.date],
      })
    }
    const onStandupChanged = () => {
      void queryClient.refetchQueries({
        queryKey: ['standup-entry', standupId],
      })
    }

    socket.on('standup-entry-changed', onEntryChanged)
    socket.on('standup-changed', onStandupChanged)
    socket.on('connect', joinRoom)

    if (socket.connected) {
      joinRoom()
    } else {
      socket.connect()
    }

    return () => {
      socket.emit('leave-standup', { standupId })
      socket.off('standup-entry-changed', onEntryChanged)
      socket.off('standup-changed', onStandupChanged)
      socket.off('connect', joinRoom)
    }
  }, [standupId, queryClient, usesConvexRealtime])

  if (isLoading) {
    return (
      <>
        {usesConvexRealtime ? (
          <StandupConvexSync standupId={standupId} date={date} />
        ) : null}
        <StandupRoomSkeleton />
      </>
    )
  }

  if (isError || !entryDetail) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/standups">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to standups
          </Link>
        </Button>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            This standup could not be loaded.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <TooltipProvider>
      {usesConvexRealtime ? (
        <StandupConvexSync standupId={standupId} date={date} />
      ) : null}
      <RoomView
        entryDetail={entryDetail}
        standupId={standupId}
        date={date}
        isToday={isToday}
        onDateChange={setDate}
      />
    </TooltipProvider>
  )
}

function RoomView({
  entryDetail,
  standupId,
  date,
  isToday,
  onDateChange,
}: {
  entryDetail: StandupEntryDetail
  standupId: string
  date: string
  isToday: boolean
  onDateChange: (date: string) => void
}) {
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false)
  const [pollDialogOpen, setPollDialogOpen] = useState(false)
  const [icebreakerDialogOpen, setIcebreakerDialogOpen] = useState(false)
  // Session currently running inside the in-page modal (null = closed). Keeps
  // the icebreaker on the standup page instead of navigating to its own route.
  const [runningIcebreakerId, setRunningIcebreakerId] = useState<string | null>(
    null,
  )
  const [commentsSubmissionId, setCommentsSubmissionId] = useState<
    string | null
  >(null)
  const [endConfirmOpen, setEndConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteSubmissionOpen, setDeleteSubmissionOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [skipManagerOpen, setSkipManagerOpen] = useState(false)
  const [editingPoll, setEditingPoll] = useState<PollView | null>(null)

  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const {
    submitMutation,
    deleteSubmissionMutation,
    addCommentMutation,
    deleteCommentMutation,
    addReactionMutation,
    removeReactionMutation,
    updateStandupMutation,
    skipDayMutation,
    deleteStandupMutation,
  } = useStandupEntryMutations(standupId, date)

  const standupEntryKey = ['standup-entry', standupId, date]

  // Optimistically patch a poll inside the standup entry cache so voting feels
  // instant. Returns a rollback used if the request fails.
  const patchPoll = (pollId: string, updater: (poll: PollView) => PollView) => {
    const previous =
      queryClient.getQueryData<StandupEntryDetail>(standupEntryKey)
    queryClient.setQueryData<StandupEntryDetail>(standupEntryKey, (current) =>
      current
        ? {
            ...current,
            polls: current.polls.map((poll) =>
              poll.id === pollId ? updater(poll) : poll,
            ),
          }
        : current,
    )
    return () => queryClient.setQueryData(standupEntryKey, previous)
  }

  const {
    createPollMutation,
    updatePollMutation,
    voteMutation,
    retractVoteMutation,
    setClosedMutation,
    deletePollMutation,
  } = usePollMutations(() => {
    void queryClient.invalidateQueries({ queryKey: standupEntryKey })
  }, patchPoll)

  // Attach the new session to this standup day and open it in the in-page modal
  // so the host stays on the standup. The entry refetch surfaces the card too.
  const { createSessionMutation } = useIcebreakerMutations({
    onCreated: (sessionId) => {
      setIcebreakerDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: standupEntryKey })
      setRunningIcebreakerId(sessionId)
    },
  })

  const { standup, members, submissions, icebreakers, polls } = entryDetail
  const currentUserId = standup.currentUserId
  const isActive = standup.isActive
  const canManage = standup.canManage
  const isSkipped = entryDetail.isSkipped

  const ownSubmission = useMemo(
    () =>
      submissions.find((submission) => submission.userId === currentUserId) ??
      null,
    [submissions, currentUserId],
  )

  const submitted = members.filter((member) => member.hasSubmitted)
  const notSubmitted = members.filter((member) => !member.hasSubmitted)

  const commentsSubmission =
    submissions.find((submission) => submission.id === commentsSubmissionId) ??
    null

  const canSubmitForDate = date <= todayDateString() && isActive && !isSkipped

  const handleToggleReaction = (
    submissionId: string,
    emoji: string,
    hasReacted: boolean,
  ) => {
    if (hasReacted) {
      removeReactionMutation.mutate({ submissionId, emoji })
    } else {
      addReactionMutation.mutate({ submissionId, emoji })
    }
  }

  // Jump the feed to a given member's submission when their name is clicked in
  // the sidebar. Briefly ring the card so it's obvious which one we landed on.
  const scrollToSubmission = (userId: string) => {
    const el = document.getElementById(`submission-${userId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('ring-2', 'ring-primary')
    window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-primary')
    }, 1600)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link to="/standups">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to standups</span>
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {standup.name}
            </h1>
            <p className="flex flex-wrap items-center gap-2 truncate text-sm text-muted-foreground">
              {standup.team.name}
              {formatTimeRange(standup.startTime, standup.endTime) && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTimeRange(standup.startTime, standup.endTime)}
                </span>
              )}
              {!isActive && (
                <Badge
                  variant="outline"
                  className="gap-1 border-destructive/50 text-destructive"
                >
                  <OctagonX className="h-3 w-3" />
                  Ended
                </Badge>
              )}
              {isActive && isSkipped && (
                <Badge
                  variant="outline"
                  className="gap-1 text-amber-600 border-amber-500/50 dark:text-amber-400"
                >
                  <CalendarDays className="h-3 w-3" />
                  Skipped day
                </Badge>
              )}
              {isActive && !isSkipped && !entryDetail.isScheduledDay && (
                <Badge variant="outline">Not a scheduled day</Badge>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {/* Date navigation */}
          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => onDateChange(shiftDate(date, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous day</span>
            </Button>
            <button
              type="button"
              onClick={() => onDateChange(todayDateString())}
              className="flex items-center gap-2 border-x px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {isToday ? `Today, ${date.slice(5)}` : date}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => onDateChange(shiftDate(date, 1))}
              disabled={isToday}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next day</span>
            </Button>
          </div>

          {canSubmitForDate && (
            <>
              <Button variant="outline" onClick={() => setPollDialogOpen(true)}>
                <Vote className="mr-2 h-4 w-4" />
                Add Poll
              </Button>
              <Button
                variant="outline"
                onClick={() => setIcebreakerDialogOpen(true)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Add Icebreaker
              </Button>
              {!ownSubmission && (
                <Button onClick={() => setSubmissionDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Submission
                </Button>
              )}
            </>
          )}

          {/* End standup — visible to all members when active */}
          {isActive && (
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setEndConfirmOpen(true)}
            >
              <OctagonX className="mr-2 h-4 w-4" />
              End standup
            </Button>
          )}

          {/* Export PDF + email report — visible to all members */}
          <StandupReportMenu
            entryDetail={entryDetail}
            standupId={standupId}
            date={date}
          />

          {/* Reactivate + Delete — canManage only */}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Standup options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit standup
                </DropdownMenuItem>
                {isSkipped ? (
                  <DropdownMenuItem
                    onClick={() => skipDayMutation.mutate(false)}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Restore this day
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => skipDayMutation.mutate(true)}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Skip this day
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setSkipManagerOpen(true)}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Manage skipped days…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {!isActive && (
                  <>
                    <DropdownMenuItem
                      onClick={() =>
                        updateStandupMutation.mutate({ isActive: true })
                      }
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Reactivate standup
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  Delete standup
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <h2 className="text-xl font-semibold">{formatEntryDate(date)}</h2>

      {isActive && isSkipped && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <CalendarDays className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              This day is skipped
            </p>
            <p className="text-xs text-muted-foreground">
              No updates are expected for this day.{' '}
              {canManage && (
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => skipDayMutation.mutate(false)}
                >
                  Restore day
                </button>
              )}
            </p>
          </div>
        </div>
      )}

      {!isActive && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <OctagonX className="h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-destructive">
              This standup has ended
            </p>
            <p className="text-xs text-muted-foreground">
              New submissions and polls are disabled. Past entries remain
              visible.{' '}
              {canManage && (
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() =>
                    updateStandupMutation.mutate({ isActive: true })
                  }
                >
                  Reactivate
                </button>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[200px_1fr]">
        {/* Participation sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
              Submitted <Check className="h-4 w-4" />
            </h3>
            {submitted.length === 0 ? (
              <p className="text-xs text-muted-foreground">No updates yet.</p>
            ) : (
              submitted.map((member) => (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => scrollToSubmission(member.userId)}
                  className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent"
                  title={`Jump to ${member.name}'s update`}
                >
                  <UserAvatar
                    image={member.image}
                    name={member.name}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {member.name}
                  </span>
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                </button>
              ))
            )}
          </div>

          {notSubmitted.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Not Submitted
              </h3>
              {notSubmitted.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 opacity-70"
                >
                  <UserAvatar
                    image={member.image}
                    name={member.name}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {member.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Submissions feed */}
        <div className="min-w-0 space-y-4">
          {icebreakers.length > 0 && (
            <div className="grid items-start gap-4 2xl:grid-cols-2">
              {icebreakers.map((session) => (
                <IcebreakerSessionCard
                  key={session.id}
                  session={session}
                  onOpen={setRunningIcebreakerId}
                />
              ))}
            </div>
          )}
          {polls.length > 0 && (
            <div className="grid items-start gap-4 2xl:grid-cols-2">
              {polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  onEdit={(p) => setEditingPoll(p)}
                  onVote={(pollId, optionId) =>
                    voteMutation.mutate({ pollId, optionId })
                  }
                  onRetractVote={(pollId) => retractVoteMutation.mutate(pollId)}
                  onSetClosed={(pollId, isClosed) =>
                    setClosedMutation.mutate({ pollId, isClosed })
                  }
                  onDelete={(pollId) => deletePollMutation.mutate(pollId)}
                />
              ))}
            </div>
          )}
          {submissions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="mb-1 font-medium">No updates yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {canSubmitForDate
                    ? 'Be the first to share what you\u2019re working on.'
                    : 'Nobody submitted an update on this day.'}
                </p>
                {canSubmitForDate && (
                  <Button
                    className="mt-4"
                    onClick={() => setSubmissionDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Submission
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid items-start gap-4 xl:grid-cols-2 min-[1800px]:grid-cols-3">
              {submissions.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  id={`submission-${submission.userId}`}
                  submission={submission}
                  entryDetail={entryDetail}
                  currentUserId={currentUserId}
                  canManageOwn={submission.userId === currentUserId && isActive}
                  onOpenComments={() => setCommentsSubmissionId(submission.id)}
                  onToggleReaction={(emoji, hasReacted) =>
                    handleToggleReaction(submission.id, emoji, hasReacted)
                  }
                  onEdit={() => setSubmissionDialogOpen(true)}
                  onDelete={() => setDeleteSubmissionOpen(true)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <SubmissionDialog
        open={submissionDialogOpen}
        onOpenChange={setSubmissionDialogOpen}
        date={date}
        questions={standup.questions}
        existingSubmission={ownSubmission}
        onSubmit={(data) =>
          submitMutation.mutate(data, {
            onSuccess: () => setSubmissionDialogOpen(false),
          })
        }
        isSubmitting={submitMutation.isPending}
      />

      <CreatePollDialog
        open={pollDialogOpen}
        onOpenChange={setPollDialogOpen}
        teamId={standup.teamId}
        standupId={standupId}
        entryDate={date}
        onCreate={(data) =>
          createPollMutation.mutate(data, {
            onSuccess: () => setPollDialogOpen(false),
          })
        }
        isCreating={createPollMutation.isPending}
      />

      <StartIcebreakerDialog
        open={icebreakerDialogOpen}
        onOpenChange={setIcebreakerDialogOpen}
        teamId={standup.teamId}
        standupId={standupId}
        entryDate={date}
        onCreate={(data) => createSessionMutation.mutate(data)}
        isCreating={createSessionMutation.isPending}
      />

      {/* Run the icebreaker in place — closing returns to the standup without
          ending the session. Refetch so the card shows the latest progress. */}
      <IcebreakerRunnerDialog
        sessionId={runningIcebreakerId}
        onOpenChange={(open) => {
          if (!open) {
            setRunningIcebreakerId(null)
            void queryClient.invalidateQueries({ queryKey: standupEntryKey })
          }
        }}
      />

      {editingPoll && (
        <CreatePollDialog
          open={!!editingPoll}
          onOpenChange={(open) => {
            if (!open) setEditingPoll(null)
          }}
          editingPoll={editingPoll}
          onCreate={() => {}}
          onUpdate={(data) =>
            updatePollMutation.mutate(
              { pollId: editingPoll.id, data },
              { onSuccess: () => setEditingPoll(null) },
            )
          }
          isCreating={updatePollMutation.isPending}
        />
      )}

      <CommentsPanel
        submission={commentsSubmission}
        currentUserId={currentUserId}
        canManage={standup.canManage}
        onClose={() => setCommentsSubmissionId(null)}
        onAddComment={(submissionId, content) =>
          addCommentMutation.mutate({ submissionId, content })
        }
        onDeleteComment={(commentId) => deleteCommentMutation.mutate(commentId)}
        isPosting={addCommentMutation.isPending}
      />

      <EditStandupDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        standup={standup}
        onSave={(data) =>
          updateStandupMutation.mutate(data, {
            onSuccess: () => setEditDialogOpen(false),
          })
        }
        isSaving={updateStandupMutation.isPending}
      />

      <SkipDaysDialog
        open={skipManagerOpen}
        onOpenChange={setSkipManagerOpen}
        standup={standup}
        standupId={standupId}
      />

      {/* Delete own submission confirmation */}
      <AlertDialog
        open={deleteSubmissionOpen}
        onOpenChange={setDeleteSubmissionOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your update?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your submission for {formatEntryDate(date)}, along
              with its comments and reactions. You can add a new update
              afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteSubmissionMutation.mutate(undefined, {
                  onSuccess: () => setDeleteSubmissionOpen(false),
                })
              }
            >
              Delete update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* End standup confirmation */}
      <AlertDialog open={endConfirmOpen} onOpenChange={setEndConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End standup?</AlertDialogTitle>
            <AlertDialogDescription>
              Members will no longer be able to submit updates or add polls.
              Past entries and submissions remain visible.
              {canManage && ' You can reactivate the standup at any time.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                updateStandupMutation.mutate(
                  { isActive: false },
                  { onSuccess: () => setEndConfirmOpen(false) },
                )
              }
            >
              End standup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete standup confirmation (canManage only) */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete standup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{standup.name}</strong> and
              all its entries, submissions, polls, comments, and reactions. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteStandupMutation.mutate(undefined, {
                  onSuccess: () => {
                    setDeleteConfirmOpen(false)
                    void navigate({ to: '/standups' })
                  },
                })
              }
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SubmissionCard({
  id,
  submission,
  entryDetail,
  currentUserId,
  canManageOwn,
  onOpenComments,
  onToggleReaction,
  onEdit,
  onDelete,
}: {
  id?: string
  submission: StandupSubmission
  entryDetail: StandupEntryDetail
  currentUserId: string
  canManageOwn: boolean
  onOpenComments: () => void
  onToggleReaction: (emoji: string, hasReacted: boolean) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { questions } = entryDetail.standup
  const answerByQuestion = new Map(
    submission.answers.map((answer) => [answer.questionId, answer.content]),
  )

  return (
    <Card
      id={id}
      className={cn(
        'scroll-mt-4 transition-shadow',
        submission.userId === currentUserId && 'border-primary/40',
      )}
    >
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-3">
          <UserAvatar
            image={submission.user.image}
            name={submission.user.name}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{submission.user.name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(submission.updatedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
          {canManageOwn && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                title="Update your update"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Update
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                title="Delete your update"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {questions.map((question) => {
            const content = answerByQuestion.get(question.id)
            if (!content) return null
            return (
              <div
                key={question.id}
                className="border-l-4 pl-3"
                style={{ borderLeftColor: question.color ?? '#94a3b8' }}
              >
                <p className="mb-1 text-sm font-semibold">{question.prompt}</p>
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {content}
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <ReactionBar
            reactions={submission.reactions}
            currentUserId={currentUserId}
            onToggle={onToggleReaction}
          />
          <button
            type="button"
            onClick={onOpenComments}
            className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <MessageSquare className="h-4 w-4" />
            {submission.comments.length}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
