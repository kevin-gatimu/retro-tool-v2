import {
  useQuery as useTanStackQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useSessionMutations } from './hooks/useSessionMutations'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Download,
  Eye,
  Hash,
  Mail,
  Plus,
  RefreshCw,
  Spade,
  Timer,
  CircleStop,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  TShirtIcon,
  getShirtScale,
  isTShirtTemplateName,
} from '@/components/TShirtIcon'
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
import { ESTIMATES_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type { EstimateSession } from '@/common/types/estimates'
import { cn } from '@/lib/utils'
import { MusicPlayer } from '@/components/music-player'
import { usesConvexForEstimates } from '@/lib/realtime-config'
import { EstimateConvexSync } from './components/estimate-convex-sync'
import { EstimateSessionDetailSkeleton } from './skeleton'
import { getRoundDurationLabel } from './helpers'
import { useSendEstimateReport } from './hooks/useSendEstimateReport'
import type { TeamMember } from '@/common/types/teams'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const DEFAULT_POINT_VALUES = [
  { label: '0', value: '0', color: null },
  { label: '½', value: '0.5', color: null },
  { label: '1', value: '1', color: null },
  { label: '2', value: '2', color: null },
  { label: '3', value: '3', color: null },
  { label: '5', value: '5', color: null },
  { label: '8', value: '8', color: null },
  { label: '13', value: '13', color: null },
  { label: '20', value: '20', color: null },
  { label: '40', value: '40', color: null },
  { label: '100', value: '100', color: null },
  { label: '?', value: '?', color: null },
  { label: '☕', value: '☕', color: null },
]

export const Route = createFileRoute('/estimate/$sessionId')({
  component: EstimateSessionPage,
})

// ─── Completed Session Report ─────────────────────────────────────────────────

function formatTemplatePoint(
  value: string | number | null,
  template: EstimateSession['template'],
): string {
  if (value === null) return '—'
  const strValue = String(value)
  if (!template) return strValue
  const found = template.values.find((v) => v.value === strValue)
  if (!found || found.label === strValue) return strValue
  return `${found.label} (${strValue})`
}

function closestTemplateLabel(
  avg: number,
  template: EstimateSession['template'],
): string | null {
  if (!template) return null
  const numeric = template.values
    .map((v) => ({ label: v.label, n: parseFloat(v.value) }))
    .filter((v) => !isNaN(v.n))
    .sort((a, b) => Math.abs(a.n - avg) - Math.abs(b.n - avg))
  return numeric[0]?.label ?? null
}

function CompletedSessionReport({ session }: { session: EstimateSession }) {
  const PAGE_SIZE = 5

  const uniqueParticipants = session.participants.filter(
    (p, i, arr) => arr.findIndex((x) => x.userId === p.userId) === i,
  )

  const [roundPageMap, setRoundPageMap] = useState<Record<string, number>>({})
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(
    new Set(),
  )

  const sendReportMutation = useSendEstimateReport(session.id, {
    onSuccess: () => setSelectedRecipients(new Set()),
  })

  const { data: membersData } = useQuery({
    queryKey: ['team-members', session.team.id],
    queryFn: () =>
      api.get<{
        members: TeamMember[]
        total: number
        page: number
        totalPages: number
        data?: TeamMember[]
      }>(`${TEAMS_ENDPOINTS.MEMBERS(session.team.id)}?limit=100`),
    staleTime: 60_000,
  })
  const teamMembers = membersData?.members ?? membersData?.data ?? []

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
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-r-none border-r-0"
                    onClick={() =>
                      sendReportMutation.mutate({
                        recipients:
                          selectedRecipients.size > 0
                            ? Array.from(selectedRecipients)
                            : undefined,
                      })
                    }
                    disabled={sendReportMutation.isPending}
                  >
                    <Mail className="mr-1.5 h-4 w-4" />
                    {sendReportMutation.isPending
                      ? 'Sending...'
                      : selectedRecipients.size > 0
                        ? `Email (${selectedRecipients.size})`
                        : 'Email Report'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8}>
                  {selectedRecipients.size > 0
                    ? `Send report to ${selectedRecipients.size} selected recipient${selectedRecipients.size !== 1 ? 's' : ''}`
                    : 'Send report to all team members'}
                </TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-l-none px-2"
                    disabled={sendReportMutation.isPending}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Recipients</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {teamMembers.map((member) => (
                    <DropdownMenuCheckboxItem
                      key={member.userId}
                      checked={selectedRecipients.has(member.user.email)}
                      onCheckedChange={(checked) => {
                        setSelectedRecipients((prev) => {
                          const next = new Set(prev)
                          if (checked) next.add(member.user.email)
                          else next.delete(member.user.email)
                          return next
                        })
                      }}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {member.user.name ?? member.user.email}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {teamMembers.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No members found
                    </div>
                  )}
                  {selectedRecipients.size > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={false}
                        onCheckedChange={() => setSelectedRecipients(new Set())}
                        onSelect={(e) => e.preventDefault()}
                        className="text-muted-foreground"
                      >
                        Clear selection
                      </DropdownMenuCheckboxItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Votes</p>
                      <p className="text-sm font-semibold">
                        {round.stats.votesCount}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="text-sm font-semibold">
                        {round.stats.average !== null ? (
                          <>
                            {round.stats.average}
                            {(() => {
                              const hint = closestTemplateLabel(
                                round.stats.average,
                                session.template,
                              )
                              return hint ? (
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                  (~{hint})
                                </span>
                              ) : null
                            })()}
                          </>
                        ) : (
                          '—'
                        )}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Range</p>
                      <p className="text-sm font-semibold">
                        {round.stats.min !== null && round.stats.max !== null
                          ? `${formatTemplatePoint(round.stats.min, session.template)} – ${formatTemplatePoint(round.stats.max, session.template)}`
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded-md border-2 border-primary/50 bg-primary/10 p-2 shadow-sm">
                      <p className="text-xs text-muted-foreground">
                        Agreed Points
                      </p>
                      <p className="text-lg font-extrabold text-primary">
                        {round.agreedPoints !== null
                          ? formatTemplatePoint(
                              round.agreedPoints,
                              session.template,
                            )
                          : round.stats.average !== null
                            ? formatTemplatePoint(
                                round.stats.average,
                                session.template,
                              )
                            : '—'}
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
                                          <Avatar className="h-6 w-6">
                                            <AvatarImage
                                              src={
                                                participant?.user.image ??
                                                undefined
                                              }
                                            />
                                            <AvatarFallback>
                                              {vote.user.name.charAt(0)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span>{vote.user.name}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {vote.user.jobRole ? (
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            {vote.user.jobRole}
                                          </Badge>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            —
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span className="inline-flex min-w-10 items-center justify-center rounded-md border-2 border-primary bg-primary/10 px-2 py-1 text-sm font-bold text-primary">
                                          {formatTemplatePoint(
                                            vote.points,
                                            session.template,
                                          )}
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
  const [agreedPoints, setAgreedPoints] = useState('')
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedAgreedPoints = useRef('')

  const timerEndsAt = session?.timerEndsAt ?? null

  // Countdown timer
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

  const displayVote = (points: string): string => {
    if (!session.template) return points
    return (
      session.template.values.find((v) => v.value === points)?.label ?? points
    )
  }

  const closestLabel = (avg: string | null): string | null => {
    if (!avg || !session.template) return null
    const avgNum = parseFloat(avg)
    if (isNaN(avgNum)) return null
    const numeric = session.template.values
      .map((v) => ({ label: v.label, n: parseFloat(v.value) }))
      .filter((v) => !isNaN(v.n))
      .sort((a, b) => Math.abs(a.n - avgNum) - Math.abs(b.n - avgNum))
    return numeric[0]?.label ?? null
  }

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
            <div>
              <h3 className="text-sm font-medium mb-3">
                Select your estimate
                {session.template && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    · {session.template.name}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                {voteOptions.map((option) => (
                  <Tooltip key={option.value}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleVote(option.value)}
                        disabled={session.status === 'revealed'}
                        style={
                          !isTShirtTemplate &&
                          option.color &&
                          selectedPoints !== option.value
                            ? {
                                borderColor: `${option.color}40`,
                                color: option.color,
                              }
                            : undefined
                        }
                        className={cn(
                          'relative cursor-pointer rounded-lg transition-all duration-150 ease-out',
                          'hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                          'flex flex-col items-center justify-center active:scale-95',
                          'text-center',
                          isTShirtTemplate
                            ? 'w-20 h-20 sm:w-24 sm:h-24 border-0 bg-transparent p-0 overflow-hidden'
                            : 'min-w-12 sm:min-w-14 min-h-16 sm:min-h-20 border-2 font-bold text-sm sm:text-base bg-card px-2 py-1 break-words',
                          !isTShirtTemplate &&
                            (selectedPoints === option.value
                              ? 'border-primary bg-primary/10 text-primary shadow-lg scale-105 animate-in zoom-in-95 duration-200'
                              : 'border-border hover:border-primary/50'),
                          isTShirtTemplate &&
                            selectedPoints === option.value &&
                            'scale-110 shadow-lg drop-shadow-md animate-in zoom-in-95 duration-200',
                          session.status === 'revealed' &&
                            'opacity-50 cursor-not-allowed hover:scale-100',
                        )}
                      >
                        {isTShirtTemplate ? (
                          <TShirtIcon
                            label={option.label}
                            themeColor={option.color ?? tShirtThemeColor}
                            selected={selectedPoints === option.value}
                            scale={getShirtScale(option.label)}
                          />
                        ) : (
                          option.label
                        )}
                        {selectedPoints === option.value && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center animate-in zoom-in-50 duration-200">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{option.value}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          {/* Participants & Votes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participants ({votedCount}/{displayedParticipants.length}{' '}
                  voted)
                </CardTitle>
                {/* Reserve a fixed-height row so the card never shifts when
                    stats appear. Items are always rendered but invisible until
                    they have a value — this keeps the layout stable. */}
                <div className="flex min-h-[1.75rem] flex-wrap items-center gap-3 text-sm">
                  {savedAgreedPoints ? (
                    <span className="inline-flex items-center gap-1 rounded-md border-2 border-primary bg-primary/10 px-2 py-0.5 font-bold text-primary">
                      <Check className="h-3 w-3" />
                      Agreed: {savedAgreedPoints}
                    </span>
                  ) : (
                    <span className="invisible inline-flex items-center gap-1 rounded-md border-2 px-2 py-0.5 font-bold">
                      Agreed: —
                    </span>
                  )}
                  {stats ? (
                    <>
                      <span className="text-muted-foreground">
                        Avg:{' '}
                        <strong className="text-foreground">{stats.avg}</strong>
                        {closestLabel(stats.avg) && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (~{closestLabel(stats.avg)})
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        Range:{' '}
                        <strong className="text-foreground">
                          {stats.min} - {stats.max}
                        </strong>
                      </span>
                    </>
                  ) : (
                    <span className="invisible text-muted-foreground">
                      Avg: — Range: —
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {displayedParticipants.map((participant) => {
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
                        'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 w-32',
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
                          'w-full min-h-10 rounded border-2 flex items-center justify-center font-bold text-sm transition-all duration-200 px-1 py-1 text-center break-words',
                          hasVoted
                            ? isRevealed
                              ? 'border-primary bg-primary/10 text-primary animate-in zoom-in-95 duration-200'
                              : 'border-primary/50 bg-primary/20 animate-in zoom-in-95 duration-200'
                            : 'border-dashed border-muted-foreground/30',
                        )}
                      >
                        {hasVoted ? (
                          isRevealed ? (
                            <span className="animate-in zoom-in-50 duration-150 break-words w-full text-center leading-tight">
                              {displayVote(vote.points)}
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

          {/* Controls (for session creator or admins) */}
          {canEndSession && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Session Controls</CardTitle>
                <CardDescription>
                  You can control the voting and change the Agreed Points.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Left — round & session actions */}
                  <div className="flex flex-wrap items-center gap-2">
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
                      <>
                        <Button
                          variant="outline"
                          onClick={() => revoteMutation.mutate()}
                          disabled={revoteMutation.isPending}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Revote
                        </Button>
                        <Button
                          onClick={() => setIsRoundModalOpen(true)}
                          disabled={startRoundMutation.isPending}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          New Round
                        </Button>
                      </>
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
                            This will complete the estimation session and move
                            it to history. All votes will be preserved for the
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

                  {/* Agreed points (only when votes are revealed) */}
                  {session.status === 'revealed' && (
                    <>
                      <div className="w-full h-px bg-border sm:w-px sm:h-auto sm:self-stretch" />
                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor="agreed-points-input"
                          className="text-sm font-medium text-muted-foreground whitespace-nowrap"
                        >
                          Agreed Points
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {voteOptions
                            .filter((v) => v.value !== '?')
                            .map((v) => (
                              <Button
                                key={v.value}
                                variant={
                                  agreedPoints === v.value
                                    ? 'default'
                                    : 'secondary'
                                }
                                size="sm"
                                className="h-8 min-w-[2rem] px-2.5 text-sm font-semibold"
                                onClick={() =>
                                  handleAgreedPointsChange(v.value)
                                }
                              >
                                {v.label}
                              </Button>
                            ))}
                        </div>
                        <div className="relative">
                          <Input
                            id="agreed-points-input"
                            className="w-28 cursor-default border-primary/60 bg-primary/5 text-center font-semibold focus-visible:ring-primary focus-visible:border-primary"
                            placeholder={stats?.avg ?? '—'}
                            value={agreedPoints}
                            readOnly
                          />
                          {setConsensusMutation.isPending && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
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

        {session.isCreator && <MusicPlayer />}
      </TooltipProvider>
    </>
  )
}
