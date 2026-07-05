import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleStop,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { getIcebreakerSocket } from '@/lib/socket'
import { ICEBREAKERS_ENDPOINTS } from '@/lib/api-endpoints'
import type { IcebreakerSession } from '@/common/types/icebreakers'
import { ICEBREAKER_SESSION_STATUSES } from '@/common/enums/icebreaker.enums'
import type { TIcebreakerPromptDecision } from '@/common/enums/icebreaker.enums'
import { usesConvexForIcebreakers } from '@/lib/realtime-config'
import { CelebrationBar } from './components/celebration-bar'
import { IcebreakerConvexSync } from './components/icebreaker-convex-sync'
import { SwipeDeck } from './components/swipe-deck'
import { IcebreakerSessionDetailSkeleton } from './skeleton'
import { STATUS_LABELS } from './helpers'
import { useSessionMutations } from './hooks/use-session-mutations'

export const Route = createFileRoute('/icebreakers/$sessionId')({
  component: IcebreakerSessionPage,
})

function IcebreakerSessionPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const usesConvexRealtime = usesConvexForIcebreakers()

  // Join session on mount.
  useEffect(() => {
    api.post(ICEBREAKERS_ENDPOINTS.JOIN(sessionId)).catch(() => {
      // Silently ignore join errors.
    })
  }, [sessionId])

  const {
    data: session,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['icebreaker-session', sessionId],
    queryFn: () =>
      api.get<IcebreakerSession>(ICEBREAKERS_ENDPOINTS.BY_ID(sessionId)),
    staleTime: 30_000,
    refetchInterval: usesConvexRealtime ? false : 5_000,
  })

  useEffect(() => {
    if (usesConvexRealtime) {
      return
    }

    const socket = getIcebreakerSocket()
    const joinRoom = () => socket.emit('join-session', { sessionId })

    const onSessionChanged = () => {
      void queryClient.refetchQueries({
        queryKey: ['icebreaker-session', sessionId],
      })
    }
    const onSessionEnded = () => {
      // Drop stale list caches so the ended session doesn't linger as ongoing.
      void queryClient.invalidateQueries({
        queryKey: ['active-icebreaker-sessions'],
      })
      void queryClient.invalidateQueries({ queryKey: ['icebreaker-history'] })
      navigate({ to: '/icebreakers' })
    }

    socket.on('session-changed', onSessionChanged)
    socket.on('session-ended', onSessionEnded)
    socket.on('connect', joinRoom)

    if (socket.connected) {
      joinRoom()
    } else {
      socket.connect()
    }

    return () => {
      socket.emit('leave-session', { sessionId })
      socket.off('session-changed', onSessionChanged)
      socket.off('session-ended', onSessionEnded)
      socket.off('connect', joinRoom)
    }
  }, [sessionId, queryClient, navigate, usesConvexRealtime])

  if (isLoading) {
    return (
      <>
        {usesConvexRealtime ? (
          <IcebreakerConvexSync sessionId={sessionId} />
        ) : null}
        <IcebreakerSessionDetailSkeleton />
      </>
    )
  }

  if (isError || !session) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/icebreakers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to icebreakers
          </Link>
        </Button>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            This icebreaker session could not be loaded.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      {usesConvexRealtime ? (
        <IcebreakerConvexSync sessionId={sessionId} />
      ) : null}
      <SessionView session={session} sessionId={sessionId} />
    </>
  )
}

function SessionView({
  session,
  sessionId,
}: {
  session: IcebreakerSession
  sessionId: string
}) {
  const { swipePromptMutation, advancePromptMutation, endSessionMutation } =
    useSessionMutations(sessionId)
  const [endConfirmOpen, setEndConfirmOpen] = useState(false)

  const pending = session.deck.filter((p) => p.decision === 'pending')
  const kept = session.deck.filter((p) => p.decision === 'kept')
  const decided = session.deck.length - pending.length
  const canManage = session.canManage
  const isCompleted = session.status === ICEBREAKER_SESSION_STATUSES.Completed
  const onlineParticipants = session.participants.filter((p) => p.isOnline)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link to="/icebreakers">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to icebreakers</span>
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Sparkles className="h-6 w-6 shrink-0 text-primary" />
              <span className="truncate">{session.name}</span>
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {session.team.emoji ? `${session.team.emoji} ` : ''}
              {session.team.name}
              {session.template ? ` · ${session.template.name}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant={isCompleted ? 'outline' : 'secondary'}
            className={cn(
              'gap-1.5',
              !isCompleted &&
                'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
            )}
          >
            {!isCompleted && (
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                aria-hidden="true"
              />
            )}
            {STATUS_LABELS[session.status]}
          </Badge>
          {canManage && !isCompleted && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setEndConfirmOpen(true)}
              disabled={endSessionMutation.isPending}
            >
              <CircleStop className="h-4 w-4" />
              {endSessionMutation.isPending ? 'Ending…' : 'End session'}
            </Button>
          )}
        </div>
      </div>

      {!isCompleted && session.deck.length > 0 && (
        <div className="flex items-center gap-4">
          <Progress
            value={(decided / session.deck.length) * 100}
            className="h-1.5 flex-1"
          />
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {decided}/{session.deck.length} prompts
          </span>
        </div>
      )}

      <PhaseContent
        session={session}
        pending={pending}
        kept={kept}
        onDecide={(decision, sessionPromptId) =>
          swipePromptMutation.mutate({ decision, sessionPromptId })
        }
        decidePending={swipePromptMutation.isPending}
        onAdvance={() => advancePromptMutation.mutate()}
        advancePending={advancePromptMutation.isPending}
      />

      {onlineParticipants.length > 0 && !isCompleted && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>{onlineParticipants.length} online</span>
          <div className="flex -space-x-2">
            {onlineParticipants.slice(0, 8).map((p) => (
              <Avatar
                key={p.id}
                className="h-7 w-7 border-2 border-background"
                title={p.user.name}
              >
                <AvatarImage src={p.user.image ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {p.user.name
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {onlineParticipants.length > 8 && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                +{onlineParticipants.length - 8}
              </span>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={endConfirmOpen} onOpenChange={setEndConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this icebreaker?</AlertDialogTitle>
            <AlertDialogDescription>
              The session will be marked as completed for everyone.{' '}
              {pending.length > 0
                ? `${pending.length} prompt${pending.length === 1 ? '' : 's'} in the deck will be left undiscussed.`
                : 'All prompts have already been decided.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={endSessionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={endSessionMutation.isPending}
              onClick={() => endSessionMutation.mutate()}
            >
              End session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface PhaseContentProps {
  session: IcebreakerSession
  pending: IcebreakerSession['deck']
  kept: IcebreakerSession['deck']
  onDecide: (
    decision: TIcebreakerPromptDecision,
    sessionPromptId: string,
  ) => void
  decidePending: boolean
  onAdvance: () => void
  advancePending: boolean
}

function PhaseContent({
  session,
  pending,
  kept,
  onDecide,
  decidePending,
  onAdvance,
  advancePending,
}: PhaseContentProps) {
  const { canManage } = session
  const currentPrompt = session.currentPrompt

  switch (session.status) {
    case ICEBREAKER_SESSION_STATUSES.Waiting:
      return (
        <Card className="border-dashed">
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 py-12 text-center">
            <Sparkles className="h-8 w-8 text-primary/60" aria-hidden="true" />
            <p className="font-medium">Waiting to start</p>
            <p className="text-sm text-muted-foreground">
              The session hasn&apos;t kicked off yet — hang tight.
            </p>
          </CardContent>
        </Card>
      )

    case ICEBREAKER_SESSION_STATUSES.Curating:
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {canManage ? 'Pick a prompt' : 'Host is picking a prompt'}
            </CardTitle>
            <CardDescription>
              {canManage
                ? 'Browse the deck, then Skip or Select the prompt on screen.'
                : 'Hang tight — the host is choosing the next prompt.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <SwipeDeck
                pending={pending}
                disabled={decidePending}
                onDecide={onDecide}
              />
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
                <span
                  className="flex gap-1.5"
                  aria-hidden="true"
                  role="presentation"
                >
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60" />
                </span>
                Waiting for the host…
              </div>
            )}
          </CardContent>
        </Card>
      )

    case ICEBREAKER_SESSION_STATUSES.Presenting:
      // The kept prompt is on screen for everyone to answer out loud — no
      // in-app responses. The host moves on with Next / Finish.
      return (
        <div className="space-y-4">
          <Card className="border-primary/40 bg-linear-to-br from-primary/5 via-transparent to-transparent">
            <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 py-12 text-center">
              <Badge variant="outline" className="text-xs uppercase">
                Discuss together
              </Badge>
              <p className="max-w-2xl text-balance text-2xl font-semibold leading-relaxed sm:text-3xl">
                {currentPrompt?.text ?? '—'}
              </p>
            </CardContent>
          </Card>

          {/* Anyone can react to a great answer — fires a local confetti burst. */}
          <CelebrationBar />

          {canManage && (
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground">
                {pending.length > 0
                  ? `${pending.length} prompt${pending.length === 1 ? '' : 's'} left in the deck`
                  : 'Last prompt — finishing ends the session'}
              </span>
              <Button
                onClick={onAdvance}
                disabled={advancePending}
                className="gap-1.5"
              >
                {pending.length > 0 ? (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Next prompt
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Finish
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )

    case ICEBREAKER_SESSION_STATUSES.Completed:
      return <CompletedRecap session={session} kept={kept} />

    default:
      return null
  }
}

function CompletedRecap({
  session,
  kept,
}: {
  session: IcebreakerSession
  kept: IcebreakerSession['deck']
}) {
  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2
            className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">This icebreaker is done</p>
            <p className="text-sm text-muted-foreground">
              {kept.length} of {session.deck.length} prompt
              {session.deck.length === 1 ? '' : 's'} discussed
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recap</CardTitle>
          <CardDescription>Prompts the team talked through</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {kept.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No prompts were discussed in this session.
            </p>
          ) : (
            kept.map((prompt, i) => (
              <div
                key={prompt.id}
                className="flex items-start gap-3 rounded-lg border p-4"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <p className="font-medium leading-relaxed">{prompt.text}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link to="/icebreakers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to icebreakers
          </Link>
        </Button>
      </div>
    </div>
  )
}
