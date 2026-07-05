import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  Plus,
  Vote,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { StandupConvexSync } from './components/standup-convex-sync'
import { SubmissionDialog } from './components/submission-dialog'
import { CommentsPanel } from './components/comments-panel'
import { ReactionBar } from './components/reaction-bar'
import { PollCard } from '@/components/polls/poll-card'
import { CreatePollDialog } from '@/components/polls/create-poll-dialog'
import { usePollMutations } from '@/hooks/use-poll-mutations'
import { StandupRoomSkeleton } from './skeleton'
import { useStandupEntryMutations } from './hooks/use-standup-mutations'
import { formatEntryDate, shiftDate, todayDateString } from './helpers'

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
  const [commentsSubmissionId, setCommentsSubmissionId] = useState<
    string | null
  >(null)

  const queryClient = useQueryClient()

  const {
    submitMutation,
    addCommentMutation,
    deleteCommentMutation,
    addReactionMutation,
    removeReactionMutation,
  } = useStandupEntryMutations(standupId, date)

  const {
    createPollMutation,
    voteMutation,
    retractVoteMutation,
    setClosedMutation,
    deletePollMutation,
  } = usePollMutations(() => {
    void queryClient.refetchQueries({
      queryKey: ['standup-entry', standupId, date],
    })
  })

  const { standup, members, submissions } = entryDetail
  const currentUserId = standup.currentUserId

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

  const canSubmitForDate = date <= todayDateString()

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
            <p className="truncate text-sm text-muted-foreground">
              {standup.team.name}
              {!entryDetail.isScheduledDay && (
                <Badge variant="outline" className="ml-2">
                  Not a scheduled day
                </Badge>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
              <Button onClick={() => setSubmissionDialogOpen(true)}>
                {ownSubmission ? (
                  <>
                    <Pencil className="mr-2 h-4 w-4" />
                    Update
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Submission
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <h2 className="text-xl font-semibold">{formatEntryDate(date)}</h2>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Participation sidebar */}
        <aside className="space-y-6">
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
              Submitted <Check className="h-4 w-4" />
            </h3>
            {submitted.length === 0 ? (
              <p className="text-xs text-muted-foreground">No updates yet.</p>
            ) : (
              submitted.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
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
                </div>
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
          {entryDetail.polls.length > 0 && (
            <div className="grid items-start gap-4 2xl:grid-cols-2">
              {entryDetail.polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
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
                  submission={submission}
                  entryDetail={entryDetail}
                  currentUserId={currentUserId}
                  onOpenComments={() => setCommentsSubmissionId(submission.id)}
                  onToggleReaction={(emoji, hasReacted) =>
                    handleToggleReaction(submission.id, emoji, hasReacted)
                  }
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
    </div>
  )
}

function SubmissionCard({
  submission,
  entryDetail,
  currentUserId,
  onOpenComments,
  onToggleReaction,
}: {
  submission: StandupSubmission
  entryDetail: StandupEntryDetail
  currentUserId: string
  onOpenComments: () => void
  onToggleReaction: (emoji: string, hasReacted: boolean) => void
}) {
  const { questions } = entryDetail.standup
  const answerByQuestion = new Map(
    submission.answers.map((answer) => [answer.questionId, answer.content]),
  )

  return (
    <Card
      className={cn(submission.userId === currentUserId && 'border-primary/40')}
    >
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-3">
          <UserAvatar
            image={submission.user.image}
            name={submission.user.name}
            size="lg"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold">{submission.user.name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(submission.updatedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
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
