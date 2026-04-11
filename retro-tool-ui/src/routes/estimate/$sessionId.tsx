import {
  useQuery as useTanStackQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useSessionMutations } from './hooks/useSessionMutations'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Clock,
  Download,
  Eye,
  Hash,
  Plus,
  Spade,
  Timer,
  CircleStop,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { getEstimateSocket } from '@/lib/socket'
import { ESTIMATES_ENDPOINTS } from '@/lib/api-endpoints'
import type { EstimateSession } from '@/common/types/estimates'
import { cn } from '@/lib/utils'
import { MusicPlayer } from '@/components/music-player'
import { usesConvexForEstimates } from '@/lib/realtime-config'
import { EstimateConvexSync } from './components/estimate-convex-sync'
import { getRoundDurationLabel } from './helpers'

const POINT_VALUES = [
  '0',
  '½',
  '1',
  '2',
  '3',
  '5',
  '8',
  '13',
  '20',
  '40',
  '100',
  '?',
  '☕',
]

export const Route = createFileRoute('/estimate/$sessionId')({
  component: EstimateSessionPage,
})

// ─── Completed Session Report ─────────────────────────────────────────────────

function CompletedSessionReport({ session }: { session: EstimateSession }) {
  const PAGE_SIZE = 5

  const uniqueParticipants = session.participants.filter(
    (p, i, arr) => arr.findIndex((x) => x.userId === p.userId) === i,
  )

  const [roundPageMap, setRoundPageMap] = useState<Record<string, number>>({})

  const totalVotes = session.rounds.reduce(
    (sum, round) => sum + round.votes.length,
    0,
  )

  const getRoundPage = (roundId: string) => roundPageMap[roundId] ?? 1

  const setRoundPage = (roundId: string, page: number) => {
    setRoundPageMap((prev) => ({ ...prev, [roundId]: page }))
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #estimate-report, #estimate-report * { visibility: visible; }
          #estimate-report { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div id="estimate-report" className="mx-auto max-w-5xl space-y-6">
        {/* Report Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="print:hidden"
            >
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
                {session.team.name} · Session Report
              </p>
              {session.sprintLink && (
                <a
                  href={session.sprintLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline underline-offset-2 print:hidden"
                >
                  Open sprint board
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Badge variant="secondary">Completed</Badge>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Rounds</CardDescription>
              <CardTitle className="text-base truncate">
                {session.rounds.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Date</CardDescription>
              <CardTitle className="text-base">
                {new Date(session.updatedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Participants</CardDescription>
              <CardTitle className="text-base">
                {uniqueParticipants.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Votes Cast</CardDescription>
              <CardTitle className="text-base">{totalVotes}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {session.rounds.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">
                No round data recorded for this session.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {session.rounds.map((round) => (
              <Card key={round.id} className="border-l-4 border-l-primary/60">
                <CardHeader className="space-y-3 rounded-t-md border-b bg-linear-to-r from-primary/15 via-primary/5 to-transparent">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        Round {round.roundNumber}
                      </div>

                      <CardTitle className="text-lg sm:text-xl">
                        Ticket No: {round.ticketNumber}
                      </CardTitle>

                      {round.storyName &&
                        round.storyName !== round.ticketNumber && (
                          <CardDescription className="text-sm text-muted-foreground">
                            {round.storyName}
                          </CardDescription>
                        )}
                    </div>

                    <div className="grid gap-2 sm:justify-items-end">
                      <div className="inline-flex items-center gap-2 rounded-md border bg-background/80 px-3 py-1 text-xs">
                        <Timer className="h-3.5 w-3.5 text-primary" />
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="font-semibold text-foreground">
                          {getRoundDurationLabel(round) ?? 'Not available'}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-md border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Started {new Date(round.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  {round.storyDescription && (
                    <p className="text-sm text-muted-foreground">
                      {round.storyDescription}
                    </p>
                  )}

                  {round.storyLink && (
                    <a
                      href={round.storyLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline underline-offset-2 break-all"
                    >
                      {round.storyLink}
                    </a>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Votes</p>
                      <p className="text-sm font-semibold">
                        {round.stats.votesCount}
                      </p>
                    </div>
                    <div className="rounded-md border-2 border-primary/50 bg-primary/10 p-2 shadow-sm">
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="text-lg font-extrabold text-primary">
                        {round.stats.average ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Minimum</p>
                      <p className="text-sm font-semibold">
                        {round.stats.min ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Maximum</p>
                      <p className="text-sm font-semibold">
                        {round.stats.max ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Consensus</p>
                      <p className="text-sm font-semibold">
                        {round.stats.consensus ?? '—'}
                      </p>
                    </div>
                  </div>

                  {round.votes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No votes recorded for this round.
                    </p>
                  ) : (
                    <div className="space-y-3 overflow-x-auto">
                      {(() => {
                        const currentPage = getRoundPage(round.id)
                        const totalPages = Math.max(
                          1,
                          Math.ceil(round.votes.length / PAGE_SIZE),
                        )
                        const safePage = Math.min(currentPage, totalPages)
                        if (safePage !== currentPage) {
                          setRoundPage(round.id, safePage)
                        }

                        const startIndex = (safePage - 1) * PAGE_SIZE
                        const pagedVotes = round.votes.slice(
                          startIndex,
                          startIndex + PAGE_SIZE,
                        )

                        const shouldPaginate = round.votes.length > PAGE_SIZE

                        return (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Member</TableHead>
                                  <TableHead>Role</TableHead>
                                  <TableHead className="text-right">
                                    Estimate
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pagedVotes.map((vote) => {
                                  const participant = uniqueParticipants.find(
                                    (p) => p.userId === vote.voterId,
                                  )
                                  return (
                                    <TableRow key={vote.id}>
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                          {participant && (
                                            <Avatar className="h-6 w-6">
                                              <AvatarImage
                                                src={
                                                  participant.user.image ??
                                                  undefined
                                                }
                                              />
                                              <AvatarFallback>
                                                {vote.user.name.charAt(0)}
                                              </AvatarFallback>
                                            </Avatar>
                                          )}
                                          <span>{vote.user.name}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {participant?.user.jobRole ? (
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            {participant.user.jobRole}
                                          </Badge>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            —
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span className="inline-flex min-w-10 items-center justify-center rounded-md border-2 border-primary bg-primary/10 px-2 py-1 text-sm font-bold text-primary">
                                          {vote.points}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>

                            {shouldPaginate && (
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">
                                  Showing{' '}
                                  {Math.min(startIndex + 1, round.votes.length)}
                                  -
                                  {Math.min(
                                    startIndex + PAGE_SIZE,
                                    round.votes.length,
                                  )}{' '}
                                  of {round.votes.length}
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setRoundPage(
                                        round.id,
                                        Math.max(1, safePage - 1),
                                      )
                                    }
                                    disabled={safePage <= 1}
                                  >
                                    Prev
                                  </Button>
                                  <span className="text-xs text-muted-foreground">
                                    Page {safePage} / {totalPages}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setRoundPage(
                                        round.id,
                                        Math.min(totalPages, safePage + 1),
                                      )
                                    }
                                    disabled={safePage >= totalPages}
                                  >
                                    Next
                                  </Button>
                                </div>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function EstimateSessionPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const usesConvexRealtime = usesConvexForEstimates()

  // Join session on mount
  useEffect(() => {
    api.post(ESTIMATES_ENDPOINTS.JOIN(sessionId)).catch(() => {
      // Silently ignore join errors
    })
  }, [sessionId])

  const {
    data: session,
    isLoading,
    isError,
  } = useTanStackQuery({
    queryKey: ['estimate-session', sessionId],
    queryFn: () =>
      api.get<EstimateSession>(ESTIMATES_ENDPOINTS.BY_ID(sessionId)),
    staleTime: 30_000,
    // Fallback sync in case a websocket room event is missed.
    refetchInterval: usesConvexRealtime ? false : 5_000,
  })

  useEffect(() => {
    if (usesConvexRealtime) {
      return
    }

    const socket = getEstimateSocket()

    const joinRoom = () => socket.emit('join-session', { sessionId })

    const onSessionChanged = () => {
      void queryClient.refetchQueries({
        queryKey: ['estimate-session', sessionId],
      })
    }

    const onSessionEnded = () => {
      navigate({ to: '/estimate' })
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

  const [selectedPoints, setSelectedPoints] = useState<string | null>(null)
  const [roundTicket, setRoundTicket] = useState('')
  const [isRoundModalOpen, setIsRoundModalOpen] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  const timerEndsAt = session?.timerEndsAt ?? null

  // Timer logic
  useEffect(() => {
    if (!timerEndsAt) {
      setTimeRemaining(null)
      return
    }

    const endTime = new Date(timerEndsAt).getTime()

    const calculateRemaining = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setTimeRemaining(remaining)
    }

    calculateRemaining()
    const interval = setInterval(calculateRemaining, 1000)
    return () => clearInterval(interval)
  }, [timerEndsAt])

  const {
    castVoteMutation,
    removeVoteMutation,
    revealVotesMutation,
    startRoundMutation,
    startTimerMutation,
    endSessionMutation,
  } = useSessionMutations(sessionId)

  // Sync selectedPoints from server — handles "New Round" clearing votes
  // Only sync when not actively voting to keep local state instant
  useEffect(() => {
    if (
      !castVoteMutation.isPending &&
      !removeVoteMutation.isPending &&
      session
    ) {
      setSelectedPoints(session.userVote ?? null)
    }
  }, [
    session?.userVote,
    session,
    castVoteMutation.isPending,
    removeVoteMutation.isPending,
  ])

  const hasActiveRoundStory = session?.currentRound !== null

  const handleVote = (points: string) => {
    if (!hasActiveRoundStory) {
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
    toast.warning('Session not available', {
      description: 'This estimation session has ended or does not exist.',
    })
    navigate({ to: '/estimate' })
    return null
  }

  if (isLoading || !session) {
    return (
      <>
        {usesConvexRealtime ? (
          <EstimateConvexSync sessionId={sessionId} />
        ) : null}
        <div className="space-y-6">
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="flex flex-wrap gap-3">
            {[...Array(13)].map((_, i) => (
              <div
                key={i}
                className="h-20 w-14 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        </div>
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

  const getVoteStats = () => {
    if (session.status !== 'revealed') return null

    const numericVotes = session.votes
      .map((v) => {
        if (v.points === '½') return 0.5
        const num = Number.parseFloat(v.points)
        return Number.isNaN(num) ? null : num
      })
      .filter((v): v is number => v !== null)

    if (numericVotes.length === 0) return null

    const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
    const sorted = [...numericVotes].sort((a, b) => a - b)
    const min = sorted[0]
    const max = sorted[sorted.length - 1]

    return { avg: avg.toFixed(1), min, max }
  }

  const stats = getVoteStats()
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
  const votedCount = session.votes.length
  const isTimerActive = timeRemaining !== null && timeRemaining > 0

  return (
    <>
      {usesConvexRealtime ? <EstimateConvexSync sessionId={sessionId} /> : null}
      <TooltipProvider>
        <div className="space-y-6">
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Round Story</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {session.currentRound ? (
                  <>
                    <p className="text-lg font-medium">
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
                    {session.isCreator
                      ? 'Start the first round by adding a ticket number.'
                      : 'Waiting for host to start a round...'}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Point Cards */}
          <div>
            <h3 className="text-sm font-medium mb-3">Select your estimate</h3>
            {hasActiveRoundStory ? (
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {POINT_VALUES.map((points) => (
                  <button
                    key={points}
                    type="button"
                    onClick={() => handleVote(points)}
                    disabled={session.status === 'revealed'}
                    className={cn(
                      'relative w-12 h-16 sm:w-14 sm:h-20 rounded-lg border-2 font-bold text-lg sm:text-xl',
                      'transition-all duration-150 ease-out',
                      'hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                      'bg-card flex items-center justify-center',
                      'active:scale-95',
                      selectedPoints === points
                        ? 'border-primary bg-primary/10 text-primary shadow-lg scale-105 animate-in zoom-in-95 duration-200'
                        : 'border-border hover:border-primary/50',
                      session.status === 'revealed' &&
                        'opacity-50 cursor-not-allowed hover:scale-100',
                    )}
                  >
                    {points}
                    {selectedPoints === points && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center animate-in zoom-in-50 duration-200">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-4 text-sm text-muted-foreground">
                  {session.isCreator
                    ? 'Add and save a story for the next round to unlock the estimate board.'
                    : 'Waiting for the session host to add the next story before voting starts.'}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Participants & Votes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participants ({votedCount}/{onlineParticipants.length} voted)
                </CardTitle>
                {stats && (
                  <div className="flex gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Avg:{' '}
                      <strong className="text-foreground">{stats.avg}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Range:{' '}
                      <strong className="text-foreground">
                        {stats.min} - {stats.max}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {onlineParticipants.map((participant) => {
                  // Check optimistic local vote first, then server data
                  const isCurrentUser =
                    participant.userId === session.currentUserId
                  const serverVote = session.votes.find(
                    (v) => v.voterId === participant.userId,
                  )
                  // For current user: show optimistic selectedPoints if voting, otherwise server vote
                  const vote =
                    isCurrentUser && selectedPoints
                      ? { points: selectedPoints, voterId: participant.userId }
                      : serverVote
                  const hasVoted = !!vote
                  const isRevealed =
                    session.status === 'revealed' || isCurrentUser

                  return (
                    <div
                      key={participant.id}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200',
                        hasVoted
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border',
                        isCurrentUser && 'ring-1 ring-primary/20',
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={participant.user.image ?? undefined}
                        />
                        <AvatarFallback>
                          {participant.user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-center truncate w-full">
                        {participant.user.name}
                        {isCurrentUser && ' (You)'}
                      </span>
                      {participant.user.jobRole && (
                        <Badge
                          className={`text-xs ${
                            {
                              Dev: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                              QA: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                              QE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
                              'QA/QE':
                                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                              DevOps:
                                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                              'BI-Dev':
                                'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
                              Oversight:
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                            }[participant.user.jobRole]
                          }`}
                        >
                          {participant.user.jobRole}
                        </Badge>
                      )}
                      <div
                        className={cn(
                          'w-10 h-12 rounded border-2 flex items-center justify-center font-bold text-sm transition-all duration-200',
                          hasVoted
                            ? isRevealed
                              ? 'border-primary bg-primary/10 text-primary animate-in zoom-in-95 duration-200'
                              : 'border-primary/50 bg-primary/20 animate-in zoom-in-95 duration-200'
                            : 'border-dashed border-muted-foreground/30',
                        )}
                      >
                        {hasVoted ? (
                          isRevealed ? (
                            <span className="animate-in zoom-in-50 duration-150">
                              {vote.points}
                            </span>
                          ) : (
                            <Check className="h-4 w-4 text-primary animate-in zoom-in-50 duration-150" />
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Controls (for session creator) */}
          {session.isCreator && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Session Controls</CardTitle>
                <CardDescription>
                  As the session creator, you can control the voting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {session.status !== 'revealed' ? (
                    <Button
                      onClick={() => revealVotesMutation.mutate()}
                      disabled={
                        revealVotesMutation.isPending ||
                        votedCount === 0 ||
                        !session.currentRound
                      }
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Reveal Votes
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setIsRoundModalOpen(true)}
                      disabled={startRoundMutation.isPending}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Round
                    </Button>
                  )}

                  {!session.currentRound && (
                    <Button
                      onClick={() => setIsRoundModalOpen(true)}
                      disabled={startRoundMutation.isPending}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Start Round
                    </Button>
                  )}

                  {session.status !== 'revealed' && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            onClick={() => startTimerMutation.mutate(60)}
                            disabled={
                              startTimerMutation.isPending ||
                              isTimerActive ||
                              !hasActiveRoundStory
                            }
                          >
                            <Clock className="mr-2 h-4 w-4" />1 min Timer
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Start a 1 minute countdown
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            onClick={() => startTimerMutation.mutate(180)}
                            disabled={
                              startTimerMutation.isPending ||
                              isTimerActive ||
                              !hasActiveRoundStory
                            }
                          >
                            <Clock className="mr-2 h-4 w-4" />3 min Timer
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Start a 3 minute countdown
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        disabled={endSessionMutation.isPending}
                      >
                        <CircleStop className="mr-2 h-4 w-4" />
                        End Session
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>End this session?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will complete the estimation session and move it
                          to history. All votes will be preserved for the
                          report.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => endSessionMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          End Session
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}

          <Dialog open={isRoundModalOpen} onOpenChange={setIsRoundModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {session.currentRound
                    ? 'Start Next Round'
                    : 'Start First Round'}
                </DialogTitle>
                <DialogDescription>
                  Enter the ticket number to start the next estimation round.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Input
                  placeholder="SPR-001"
                  value={roundTicket}
                  onChange={(e) => setRoundTicket(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (!startRoundMutation.isPending) {
                        handleStartRound()
                      }
                    }
                  }}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsRoundModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStartRound}
                  disabled={startRoundMutation.isPending}
                >
                  {startRoundMutation.isPending ? 'Starting...' : 'Start Round'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <MusicPlayer />
      </TooltipProvider>
    </>
  )
}
