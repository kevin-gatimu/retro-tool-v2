import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, Clock, Spade, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { isTShirtTemplateName } from '@/components/t-shirt-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MusicPlayer } from '@/components/music-player'
import { RealtimeStatusBanner } from '@/components/realtime-status-banner'
import { EstimateConvexSync } from './components/estimate-convex-sync'
import { CompletedSessionReport } from './components/completed-session-report'
import { ParticipantsPanel } from './components/participants-panel'
import { RoundModal } from './components/round-modal'
import { SessionControls } from './components/session-controls'
import { VoteCards } from './components/vote-cards'
import { EstimateSessionDetailSkeleton } from './skeleton'
import { DEFAULT_POINT_VALUES, getRevealedVoteStats } from './helpers'
import { useEstimateSession, useRoundTimer, useSessionMutations } from './hooks'

export const Route = createFileRoute('/estimate/$sessionId')({
  component: EstimateSessionPage,
})

// ─── Main Page ────────────────────────────────────────────────────────────────

function EstimateSessionPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()

  const { session, isLoading, isError, usesConvexRealtime } =
    useEstimateSession(sessionId)

  const [selectedPoints, setSelectedPoints] = useState<string | null>(null)
  const [roundTicket, setRoundTicket] = useState('')
  const [isRoundModalOpen, setIsRoundModalOpen] = useState(false)
  const [agreedPoints, setAgreedPoints] = useState('')
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedAgreedPoints = useRef('')

  const timeRemaining = useRoundTimer(session?.timerEndsAt ?? null)

  // Redirect away from a missing/ended session. Runs in an effect (not the
  // render body) so we never call navigate/toast during render.
  useEffect(() => {
    if (isError) {
      toast.warning('Session not available', {
        description: 'This estimation session has ended or does not exist.',
      })
      navigate({ to: '/estimate' })
    }
  }, [isError, navigate])

  const {
    castVoteMutation,
    removeVoteMutation,
    revealVotesMutation,
    startRoundMutation,
    endSessionMutation,
    setConsensusMutation,
    revoteMutation,
  } = useSessionMutations(sessionId)

  // Effect 1: clear selectedPoints when the round changes or a revote happens.
  // This is the only place that legitimately resets the selection to null based
  // on server state (new round = different ID; revote = same ID but round goes
  // back to 'active' from 'revealed').
  const roundClearRef = useRef<{
    id: string | null
    status: string | undefined
  }>({
    id: null,
    status: undefined,
  })
  useEffect(() => {
    if (!session) return
    const id = session.currentRound?.id ?? null
    const status = session.currentRound?.status
    const prev = roundClearRef.current
    if (prev.status !== undefined) {
      const roundChanged = prev.id !== id
      const revoted =
        prev.id === id && prev.status === 'revealed' && status === 'active'
      if (roundChanged || revoted) setSelectedPoints(null)
    }
    roundClearRef.current = { id, status }
  }, [session?.currentRound?.id, session?.currentRound?.status])

  // Effect 2: sync a server-confirmed vote into local state.
  // Intentionally does NOT reset to null — stale Convex snapshots can briefly
  // report userVote=null while the fresh snapshot is still in-flight, which
  // would flash the selection away. Null resets come from Effect 1 above or
  // from the explicit setSelectedPoints(null) call inside handleVote (unvote).
  useEffect(() => {
    if (castVoteMutation.isPending || removeVoteMutation.isPending || !session)
      return
    if (session.userVote != null) setSelectedPoints(session.userVote)
  }, [
    session?.userVote,
    castVoteMutation.isPending,
    removeVoteMutation.isPending,
  ])

  // Sync agreedPoints input when votes are revealed: prefer saved value, fall back to avg
  useEffect(() => {
    if (session?.status === 'revealed') {
      const currentRoundInRounds = session.rounds.find(
        (r) => r.id === session.currentRound?.id,
      )
      const saved = currentRoundInRounds?.agreedPoints ?? null
      const numericVotes = session.votes
        .map((v) => {
          if (v.points === '½') return 0.5
          const n = Number.parseFloat(v.points)
          return Number.isNaN(n) ? null : n
        })
        .filter((v): v is number => v !== null)
      const computedAvg =
        numericVotes.length > 0
          ? (
              numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
            ).toFixed(1)
          : ''
      const value = saved ?? computedAvg
      setAgreedPoints(value)
      lastSavedAgreedPoints.current = saved ?? ''
    }
  }, [session?.status, session?.currentRound?.id])

  const handleVote = (points: string) => {
    if (!session?.currentRound) {
      toast.warning('Waiting for next story', {
        description:
          'The session host must add a story before voting can begin.',
      })
      return
    }

    // Prevent double-clicks on the same action
    if (castVoteMutation.isPending || removeVoteMutation.isPending) {
      return
    }

    if (selectedPoints === points) {
      // Second click on the same card = unvote
      setSelectedPoints(null)
      removeVoteMutation.mutate()
    } else {
      setSelectedPoints(points)
      castVoteMutation.mutate(points)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleAgreedPointsChange = (value: string) => {
    setAgreedPoints(value)
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    const trimmed = value.trim()
    if (!trimmed || trimmed === lastSavedAgreedPoints.current) return
    saveDebounceRef.current = setTimeout(() => {
      lastSavedAgreedPoints.current = trimmed
      setConsensusMutation.mutate(trimmed)
    }, 600)
  }

  const handleStartRound = () => {
    const ticketNumber = roundTicket.trim()
    if (!ticketNumber) {
      toast.error('Ticket number is required')
      return
    }

    startRoundMutation.mutate(
      { ticketNumber },
      {
        onSuccess: () => {
          setRoundTicket('')
          setIsRoundModalOpen(false)
        },
      },
    )
  }

  if (isError) {
    return null
  }

  if (isLoading || !session) {
    return (
      <>
        {usesConvexRealtime ? (
          <EstimateConvexSync sessionId={sessionId} />
        ) : null}
        <EstimateSessionDetailSkeleton />
      </>
    )
  }

  // Completed sessions → read-only report view
  if (session.status === 'completed') {
    return (
      <>
        {usesConvexRealtime ? (
          <EstimateConvexSync sessionId={sessionId} />
        ) : null}
        <CompletedSessionReport session={session} />
      </>
    )
  }

  const stats = getRevealedVoteStats(session)

  const voteOptions = session.template
    ? session.template.values.map((v) => ({
        label: v.label,
        value: v.value,
        color: v.color,
      }))
    : DEFAULT_POINT_VALUES

  const isTShirtTemplate = !!(
    session.template && isTShirtTemplateName(session.template.name)
  )

  const tShirtThemeColor =
    session.template?.values.find((v) => v.color)?.color ??
    session.template?.color ??
    '#f43f5e'

  const savedAgreedPoints =
    session.status === 'revealed'
      ? (session.rounds.find((r) => r.id === session.currentRound?.id)
          ?.agreedPoints ?? null)
      : null

  // Sort participants: current user first, then others
  const onlineParticipants = session.participants
    .filter((p) => p.isOnline)
    .filter((p, i, arr) => arr.findIndex((x) => x.userId === p.userId) === i)
    .sort((a, b) => {
      // Current user always first
      if (a.userId === session.currentUserId) return -1
      if (b.userId === session.currentUserId) return 1
      // Then by user name
      return a.user.name.localeCompare(b.user.name)
    })
  const displayedParticipants = onlineParticipants
  const votedCount = session.votes.length
  const isTimerActive = timeRemaining !== null && timeRemaining > 0
  const canEndSession = Boolean(session.isCreator || session.canEndSession)

  return (
    <>
      {usesConvexRealtime ? <EstimateConvexSync sessionId={sessionId} /> : null}
      <TooltipProvider>
        <div className="space-y-6">
          <RealtimeStatusBanner active={usesConvexRealtime} />
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/estimate">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <Spade className="h-6 w-6 text-primary" />
                  {session.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {session.team.name} •{' '}
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {onlineParticipants.length} online
                  </span>
                </p>
                {session.sprintLink && (
                  <a
                    href={session.sprintLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    Open sprint board
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={
                  session.status === 'voting'
                    ? 'default'
                    : session.status === 'revealed'
                      ? 'secondary'
                      : 'outline'
                }
              >
                {session.status === 'waiting'
                  ? 'Waiting for votes'
                  : session.status === 'voting'
                    ? 'Voting in progress'
                    : 'Votes revealed'}
              </Badge>

              {isTimerActive && (
                <Badge variant="outline" className="gap-1 font-mono">
                  <Clock className="h-3 w-3" />
                  {formatTime(timeRemaining)}
                </Badge>
              )}
            </div>
          </div>

          {/* Timer Progress */}
          {isTimerActive && session.timerDuration && (
            <Progress
              value={
                ((session.timerDuration - timeRemaining) /
                  session.timerDuration) *
                100
              }
              className="h-1"
            />
          )}

          {/* Story being estimated */}
          <Card>
            <CardHeader className="py-0 px-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Story
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-0 pt-0">
              <div className="space-y-0.5">
                {session.currentRound ? (
                  <>
                    <p className="text-base font-medium">
                      {session.currentRound.ticketNumber}
                      {session.currentRound.storyName !==
                      session.currentRound.ticketNumber
                        ? ` - ${session.currentRound.storyName}`
                        : ''}
                    </p>
                    {session.currentRound.storyDescription && (
                      <p className="text-sm text-muted-foreground">
                        {session.currentRound.storyDescription}
                      </p>
                    )}
                    {session.currentRound.storyLink && (
                      <a
                        href={session.currentRound.storyLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline underline-offset-2"
                      >
                        {session.currentRound.storyLink}
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground italic">
                    {canEndSession
                      ? "Click 'Start Round' in the controls below to begin the first round."
                      : 'Waiting for the host to start the first round...'}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Point Cards — only shown once a round is active */}
          {session.currentRound && (
            <VoteCards
              templateName={session.template?.name ?? null}
              voteOptions={voteOptions}
              selectedPoints={selectedPoints}
              disabled={session.status === 'revealed'}
              isTShirtTemplate={isTShirtTemplate}
              tShirtThemeColor={tShirtThemeColor}
              onVote={handleVote}
            />
          )}

          {/* Participants & Votes */}
          <ParticipantsPanel
            session={session}
            displayedParticipants={displayedParticipants}
            selectedPoints={selectedPoints}
            votedCount={votedCount}
            savedAgreedPoints={savedAgreedPoints}
            stats={stats}
          />

          {/* Controls (for session creator or admins) */}
          {canEndSession && (
            <SessionControls
              session={session}
              voteOptions={voteOptions}
              agreedPoints={agreedPoints}
              stats={stats}
              votedCount={votedCount}
              revealVotesMutation={revealVotesMutation}
              revoteMutation={revoteMutation}
              startRoundMutation={startRoundMutation}
              endSessionMutation={endSessionMutation}
              setConsensusMutation={setConsensusMutation}
              onOpenRoundModal={() => setIsRoundModalOpen(true)}
              onAgreedPointsChange={handleAgreedPointsChange}
            />
          )}

          <RoundModal
            open={isRoundModalOpen}
            onOpenChange={setIsRoundModalOpen}
            hasCurrentRound={!!session.currentRound}
            roundTicket={roundTicket}
            onRoundTicketChange={setRoundTicket}
            onStartRound={handleStartRound}
            isPending={startRoundMutation.isPending}
          />
        </div>

        {session.isCreator && <MusicPlayer />}
      </TooltipProvider>
    </>
  )
}
