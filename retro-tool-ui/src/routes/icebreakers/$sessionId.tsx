import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, CircleStop, Sparkles } from 'lucide-react'
import { useEffect } from 'react'

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
    const onSessionEnded = () => navigate({ to: '/icebreakers' })

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

  const pending = session.deck.filter((p) => p.decision === 'pending')
  const canManage = session.canManage

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link to="/icebreakers">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to icebreakers</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              {session.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {session.team.name}
              {session.template ? ` · ${session.template.name}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{STATUS_LABELS[session.status]}</Badge>
          {canManage &&
            session.status !== ICEBREAKER_SESSION_STATUSES.Completed && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => endSessionMutation.mutate()}
                disabled={endSessionMutation.isPending}
              >
                <CircleStop className="h-4 w-4" />
                End
              </Button>
            )}
        </div>
      </div>

      <PhaseContent
        session={session}
        pending={pending}
        onDecide={(decision, sessionPromptId) =>
          swipePromptMutation.mutate({ decision, sessionPromptId })
        }
        decidePending={swipePromptMutation.isPending}
        onAdvance={() => advancePromptMutation.mutate()}
        advancePending={advancePromptMutation.isPending}
      />
    </div>
  )
}

interface PhaseContentProps {
  session: IcebreakerSession
  pending: IcebreakerSession['deck']
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
  onDecide,
  decidePending,
  onAdvance,
  advancePending,
}: PhaseContentProps) {
  const { canManage } = session
  const currentPrompt = session.currentPrompt

  switch (session.status) {
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
              <div className="flex h-48 items-center justify-center text-muted-foreground">
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
          <Card className="border-primary/40">
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 py-12 text-center">
              <CardDescription>Discuss together</CardDescription>
              <p className="text-2xl font-semibold leading-relaxed">
                {currentPrompt?.text ?? '—'}
              </p>
            </CardContent>
          </Card>

          {/* Anyone can react to a great answer — fires a local confetti burst. */}
          <CelebrationBar />

          {canManage && (
            <div className="flex justify-end">
              <Button
                onClick={onAdvance}
                disabled={advancePending}
                className="gap-1.5"
              >
                <ArrowRight className="h-4 w-4" />
                {pending.length > 0 ? 'Next prompt' : 'Finish'}
              </Button>
            </div>
          )}
        </div>
      )

    case ICEBREAKER_SESSION_STATUSES.Completed:
      return <CompletedRecap session={session} />

    default:
      return null
  }
}

function CompletedRecap({ session }: { session: IcebreakerSession }) {
  const keptPrompts = session.deck.filter((p) => p.decision === 'kept')
  return (
    <Card>
      <CardHeader>
        <CardTitle>Icebreaker recap</CardTitle>
        <CardDescription>
          {keptPrompts.length} prompt{keptPrompts.length === 1 ? '' : 's'}{' '}
          discussed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {keptPrompts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No prompts were discussed in this session.
          </p>
        ) : (
          keptPrompts.map((prompt) => (
            <div key={prompt.id} className="rounded-lg border p-4">
              <p className="font-medium">{prompt.text}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
