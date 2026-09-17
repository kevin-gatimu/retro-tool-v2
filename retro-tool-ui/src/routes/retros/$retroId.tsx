import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  useConvexAuth,
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react'
import { convexApi } from '@/lib/convex-api'
import { useCurrentUser } from '@/hooks/use-current-user'
import {
  useCarriedForward,
  useRetroCardMutations,
  useRetroMutations,
} from './hooks'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { RETROS_ENDPOINTS } from '@/lib/api-endpoints'
import type { RetroDetail } from '@/common/types/retros'
import type { Template } from '@/common/types/templates'
import { RetroReport } from '@/components/retro-report'
import { MusicPlayer } from '@/components/music-player'
import { usesConvexForRetros } from '@/lib/realtime-config'
import { RealtimeStatusBanner } from '@/components/realtime-status-banner'
import { RetroConvexSync } from './components/retro-convex-sync'
import { RetroDiscussionView } from './components/retro-discussion-view'
import { RetroHeader } from './components/retro-header'
import { RetroLobbyView } from './components/retro-lobby-view'
import { ReadyBar } from './components/ready-bar'
import { PhaseAlerts } from './components/phase-alerts'
import { DeleteRetroDialog } from './components/delete-retro-dialog'
import type { LocalPendingCards, TypingUser } from './types'
import { RetroBoardSkeleton, RetroDetailSkeleton } from './skeleton'

// Lazy-load the heavy dnd-kit board so it stays out of the initial route chunk;
// it only mounts for the active/voting/grouping phases.
const RetroBoard = lazy(() =>
  import('./components/retro-board').then((m) => ({ default: m.RetroBoard })),
)

// Slow REST backstop poll kept even in Convex realtime mode. If Convex silently
// stops delivering (socket down, JWT auth failure), the board still refreshes
// from REST within this window instead of showing stale/empty data forever.
// Socket.IO mode keeps a faster 3s poll (its own connection model).
const CONVEX_BACKSTOP_POLL_MS = 30_000
const SOCKET_IO_POLL_MS = 3_000

const startTypingMutationRef = convexApi.liveRetros.startTyping
const stopTypingMutationRef = convexApi.liveRetros.stopTyping
const getTypingUsersQueryRef = convexApi.liveRetros.getTypingUsers
const setReadyStatusMutationRef = convexApi.liveRetros.setReadyStatus
const clearAllReadyMutationRef = convexApi.liveRetros.clearAllReady
const getReadyStatusQueryRef = convexApi.liveRetros.getReadyStatus

function RetroAccessError({ error }: { error: Error }) {
  const navigate = useNavigate()
  useEffect(() => {
    toast.error(error.message)
    void navigate({ to: '/retros' })
  }, [error, navigate])
  return null
}

export const Route = createFileRoute('/retros/$retroId')({
  loader: ({ context: { queryClient }, params: { retroId } }) =>
    queryClient.ensureQueryData({
      queryKey: ['retro', retroId] as const,
      queryFn: () => api.get<RetroDetail>(RETROS_ENDPOINTS.BY_ID(retroId)),
      staleTime: 5_000,
    }),
  errorComponent: RetroAccessError,
  pendingComponent: RetroDetailSkeleton,
  component: RetroDetailPage,
})

function RetroDetailPage() {
  const { retroId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const usesConvexRealtime = usesConvexForRetros()
  // Convex queries below call requireIdentity server-side; skip them until the
  // Convex client is authenticated so they don't throw Unauthenticated during
  // the connect → token-ready window.
  const { isAuthenticated: convexAuthed } = useConvexAuth()
  const convexReady = usesConvexRealtime && convexAuthed

  const { data: currentUser } = useCurrentUser()

  // ── Convex typing indicator ──────────────────────────────────────────────────
  const startTypingConvex = useConvexMutation(startTypingMutationRef)
  const stopTypingConvex = useConvexMutation(stopTypingMutationRef)
  const rawTypingUsers = useConvexQuery(
    getTypingUsersQueryRef,
    convexReady ? { retroId } : 'skip',
  )
  const typingUsers = ((rawTypingUsers ?? []) as Array<TypingUser>).filter(
    (u) => u.userId !== currentUser?.id,
  )
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  const handleTypingStart = useCallback(() => {
    if (!usesConvexRealtime || !currentUser) return
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    // Only fire mutation on idle → typing transition
    if (!isTypingRef.current) {
      isTypingRef.current = true
      // userId is derived server-side from the JWT; only displayName is sent.
      startTypingConvex({
        retroId,
        displayName: currentUser.name,
      })
    }
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false
      typingTimeoutRef.current = null
      stopTypingConvex({ retroId })
    }, 3000)
  }, [
    usesConvexRealtime,
    currentUser,
    retroId,
    startTypingConvex,
    stopTypingConvex,
  ])

  const handleTypingStop = useCallback(() => {
    if (!usesConvexRealtime || !currentUser) return
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    if (isTypingRef.current) {
      isTypingRef.current = false
      stopTypingConvex({ retroId })
    }
  }, [usesConvexRealtime, currentUser, retroId, stopTypingConvex])

  // ── Convex ready status ──────────────────────────────────────────────────────
  const setReadyStatusConvex = useConvexMutation(setReadyStatusMutationRef)
  const clearAllReadyConvex = useConvexMutation(clearAllReadyMutationRef)
  const rawReadyStatuses = useConvexQuery(
    getReadyStatusQueryRef,
    convexReady ? { retroId } : 'skip',
  )
  const readyStatuses = (rawReadyStatuses ?? []) as Array<{
    userId: string
    isReady: boolean
  }>
  const myReady = Boolean(
    readyStatuses.find((r) => r.userId === currentUser?.id)?.isReady,
  )
  const readyCount = readyStatuses.filter((r) => r.isReady).length

  const [readyAnimating, setReadyAnimating] = useState(false)
  const [minAcceptedBoardUpdatedAt, setMinAcceptedBoardUpdatedAt] = useState(0)

  const markConvexBoardSnapshotFloor = useCallback(() => {
    if (!usesConvexRealtime) return
    setMinAcceptedBoardUpdatedAt(Date.now())
  }, [usesConvexRealtime])

  const toggleReady = useCallback(() => {
    if (!usesConvexRealtime || !currentUser) return
    const next = !myReady
    if (next) setReadyAnimating(true)
    // userId is derived server-side from the JWT; only displayName is sent.
    setReadyStatusConvex({
      retroId,
      displayName: currentUser.name,
      isReady: next,
    })
  }, [usesConvexRealtime, currentUser, myReady, retroId, setReadyStatusConvex])

  const invalidateRetroDetail = useCallback(() => {
    if (usesConvexRealtime) {
      return
    }
    void queryClient.invalidateQueries({ queryKey: ['retro', retroId] })
  }, [queryClient, retroId, usesConvexRealtime])

  const invalidatePreviousCarried = useCallback(() => {
    if (usesConvexRealtime) {
      return
    }
    void queryClient.invalidateQueries({
      queryKey: ['retro-previous-carried', retroId],
    })
  }, [queryClient, retroId, usesConvexRealtime])

  // Join retro on mount — ref prevents double-fire under React StrictMode
  const joinedRef = useRef(false)
  useEffect(() => {
    if (joinedRef.current) return
    joinedRef.current = true
    api.post(RETROS_ENDPOINTS.JOIN(retroId)).catch((error: unknown) => {
      console.warn('Failed to join the retrospective session', error)
    })
  }, [retroId])

  const {
    data: retro,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['retro', retroId],
    queryFn: () => api.get<RetroDetail>(RETROS_ENDPOINTS.BY_ID(retroId)),
    staleTime: 5_000,
    refetchInterval: usesConvexRealtime
      ? CONVEX_BACKSTOP_POLL_MS
      : SOCKET_IO_POLL_MS,
  })

  // Clear typing + ready status when the active phase ends
  const prevRetroStatusRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevRetroStatusRef.current
    if (prev === 'active' && retro?.status !== 'active' && usesConvexRealtime) {
      if (currentUser) {
        stopTypingConvex({ retroId })
      }
      clearAllReadyConvex({ retroId })
    }
    prevRetroStatusRef.current = retro?.status ?? null
  }, [
    retro?.status,
    usesConvexRealtime,
    currentUser,
    retroId,
    stopTypingConvex,
    clearAllReadyConvex,
  ])

  // Derive jobRole from the current user's participant entry (team role for this retro)
  const currentUserJobRole = useMemo(
    () =>
      retro?.participants.find((p) => p.userId === currentUser?.id)?.user
        ?.jobRole ?? null,
    [currentUser?.id, retro?.participants],
  )

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  // Lobby auto-start timer state
  const [lobbyTimeRemaining, setLobbyTimeRemaining] = useState<number | null>(
    null,
  )

  // Card creation state per column
  const [newCardContent, setNewCardContent] = useState<
    Partial<Record<string, string>>
  >({})
  const [localPendingCards, setLocalPendingCards] = useState<LocalPendingCards>(
    {},
  )
  const [selectedCardIds, setSelectedCardIds] = useState<
    Record<string, boolean>
  >({})

  const [deleteRetroConfirmOpen, setDeleteRetroConfirmOpen] = useState(false)

  // Track which column just had a card added for auto-scroll
  const [scrollToColumn, setScrollToColumn] = useState<string | null>(null)
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const prevCardCountByColumnRef = useRef<Record<string, number> | null>(null)

  // Calculate time remaining
  useEffect(() => {
    if (!retro?.timerEndsAt) {
      return
    }

    const calculateRemaining = () => {
      if (!retro.timerEndsAt) {
        setTimeRemaining(null)
        return
      }
      const now = Date.now()
      const endTime = new Date(retro.timerEndsAt).getTime()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeRemaining(remaining)
    }

    calculateRemaining()
    const interval = setInterval(calculateRemaining, 1000)
    return () => clearInterval(interval)
  }, [retro])

  // Calculate lobby time remaining
  useEffect(() => {
    if (!retro?.lobbyAutoStartsAt || retro.status !== 'waiting') {
      setLobbyTimeRemaining(null)
      return
    }

    const calculateLobbyRemaining = () => {
      if (!retro.lobbyAutoStartsAt) {
        setLobbyTimeRemaining(null)
        return
      }
      const now = Date.now()
      const autoStartTime = new Date(retro.lobbyAutoStartsAt).getTime()
      const remaining = Math.max(0, Math.floor((autoStartTime - now) / 1000))
      setLobbyTimeRemaining(remaining)
    }

    calculateLobbyRemaining()
    const interval = setInterval(calculateLobbyRemaining, 1000)
    return () => clearInterval(interval)
  }, [retro])

  const isTimerActive = timeRemaining !== null && timeRemaining > 0
  const isLobbyTimerActive =
    lobbyTimeRemaining !== null && lobbyTimeRemaining > 0

  const {
    startLobbyMutation,
    startRetroMutation,
    moveToVotingMutation,
    moveToGroupingMutation,
    moveToDiscussionMutation,
    completeRetroMutation,
  } = useRetroMutations(retroId)

  // Auto-start retro when lobby timer expires (creator or team lead triggers this)
  const autoStartTriggeredRef = useRef(false)
  useEffect(() => {
    if (!retro) {
      return
    }

    if (
      retro.status === 'waiting' &&
      (retro.isCreator || retro.isTeamLead) &&
      lobbyTimeRemaining === 0 &&
      !autoStartTriggeredRef.current &&
      !startRetroMutation.isPending
    ) {
      autoStartTriggeredRef.current = true
      startRetroMutation.mutate()
    }
    // Reset the ref when status changes back to waiting (e.g., new lobby)
    if (retro.status !== 'waiting') {
      autoStartTriggeredRef.current = false
    }
  }, [retro, lobbyTimeRemaining, startRetroMutation])

  const {
    createCardMutation,
    deleteCardMutation,
    mergeCardsMutation,
    unmergeCardMutation,
    voteMutation,
    removeVoteMutation,
    discussCardMutation,
    markDiscussedMutation,
    createCommentMutation,
    deleteCommentMutation,
    deleteRetroMutation,
  } = useRetroCardMutations({
    retroId,
    retroStatus: retro?.status,
    currentUser,
    currentUserJobRole,
    setLocalPendingCards,
    setNewCardContent,
    setScrollToColumn,
    setSelectedCardIds,
    markConvexBoardSnapshotFloor,
    invalidateRetroDetail,
    onRetroDeleted: () => void navigate({ to: '/retros' }),
  })

  // Auto-scroll to bottom when a new card is added
  useEffect(() => {
    if (scrollToColumn) {
      const container = scrollRefs.current[scrollToColumn]
      if (container) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight
          setScrollToColumn(null)
        }, 100)
      }
    }
  }, [scrollToColumn, retro])

  // Scroll all users to bottom when new cards arrive from anyone
  useEffect(() => {
    const cards = retro?.cards
    if (!cards) return

    const byColumn: Record<string, number> = {}
    for (const card of cards) {
      byColumn[card.columnId] = (byColumn[card.columnId] ?? 0) + 1
    }

    if (prevCardCountByColumnRef.current !== null) {
      for (const [columnId, count] of Object.entries(byColumn)) {
        const prev = prevCardCountByColumnRef.current[columnId] ?? 0
        if (count > prev) {
          const container = scrollRefs.current[columnId]
          if (container) {
            container.scrollTop = container.scrollHeight
          }
        }
      }
    }

    prevCardCountByColumnRef.current = byColumn
  }, [retro?.cards])

  const {
    previousCarriedItems,
    pendingCarriedDiscussItemId,
    pendingCarriedDoneItemId,
    newCarriedItemComments,
    setNewCarriedItemComments,
    createCarriedItemCommentMutation,
    markCarriedItemDiscussingMutation,
    markCarriedItemDoneMutation,
    carryItemForwardMutation,
  } = useCarriedForward({
    retroId,
    retroStatus: retro?.status,
    usesConvexRealtime,
    currentUser,
    markConvexBoardSnapshotFloor,
    invalidateRetroDetail,
    invalidatePreviousCarried,
  })

  const retroTemplateId = retro?.templateId ?? ''
  const hasEmbeddedColumns = (retro?.template.columns.length ?? 0) > 0
  const shouldLoadTemplateColumns = !!retroTemplateId && !hasEmbeddedColumns

  const { data: fallbackTemplate, isFetching: isTemplateFetching } = useQuery({
    queryKey: ['retro-template', retroTemplateId],
    queryFn: () =>
      api.get<Template>(RETROS_ENDPOINTS.TEMPLATE_BY_ID(retroTemplateId)),
    enabled: shouldLoadTemplateColumns,
    staleTime: 60_000,
  })

  const retroCardsForSync = retro?.cards ?? []

  useEffect(() => {
    if (retroCardsForSync.length === 0) return

    setLocalPendingCards((prev) => {
      const next: typeof prev = {}
      for (const [columnId, pending] of Object.entries(prev)) {
        next[columnId] = pending.filter((localCard) => {
          const synced = retroCardsForSync.some(
            (serverCard) =>
              serverCard.columnId === columnId &&
              serverCard.content.trim() === localCard.content.trim(),
          )
          return !synced
        })
      }
      return next
    })
  }, [retroCardsForSync])

  const toggleCardSelection = useCallback((cardId: string) => {
    setSelectedCardIds((prev) => ({ ...prev, [cardId]: !prev[cardId] }))
  }, [])

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Retrospective Not Found</h1>
        <p className="text-muted-foreground">
          This retrospective does not exist or you do not have access.
        </p>
        <Button onClick={() => navigate({ to: '/retros' })}>
          Back to Retrospectives
        </Button>
      </div>
    )
  }

  if (isLoading || !retro) {
    return (
      <div className="flex flex-col space-y-4 h-[calc(100vh-4rem)]">
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="grid flex-1 gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const canControl = Boolean(
    retro.isCreator || retro.isTeamLead || retro.isSystemAdmin,
  )
  // Phase transitions (open lobby, start, grouping, voting, discussion) are
  // creator/team-lead only on the server — system-admins are NOT permitted
  // (unlike complete/delete, which the server does allow admins to do). Gate
  // those buttons on this narrower flag so an admin never sees a control that
  // would 403, which otherwise flashes the board open before the rejection.
  const canControlPhases = Boolean(retro.isCreator || retro.isTeamLead)
  // Ending (completing) and deleting a retro is permitted for the creator,
  // team-lead, org-admin, and system-admin — a strictly broader set than the
  // phase-transition/discussion controls (creator/team-lead only). Mirrors the
  // server's completeRetro/deleteRetro permission checks.
  const canComplete = Boolean(
    retro.isCreator ||
    retro.isTeamLead ||
    retro.isOrgAdmin ||
    retro.isSystemAdmin,
  )
  const retroStatus = retro.status
  const currentDiscussionCardId = retro.currentDiscussionCardId ?? null
  const retroName = retro.name || 'Untitled Retrospective'
  const participants = Array.from(
    new Map(retro.participants.map((p) => [p.userId, p])).values(),
  )
  const teamDisplayName = retro.team.name
  const templateDisplayName = retro.template.name
  const participantCount = participants.length
  const templateColumns =
    retro.template.columns.length > 0
      ? retro.template.columns
      : (fallbackTemplate?.columns ?? [])
  const retroCards = retro.cards
  const isAnonymous = retro.isAnonymous
  const voteType = retro.voteType
  const timerDuration = retro.timerDuration
  const maxVotesPerUser = retro.maxVotesPerUser
  const userVoteCount = retro.userVoteCount
  const showBoard =
    retroStatus !== 'waiting' &&
    retroStatus !== 'discussing' &&
    retroStatus !== 'completed'

  return (
    <TooltipProvider>
      {usesConvexRealtime ? (
        <RetroConvexSync
          retroId={retroId}
          minAcceptedUpdatedAt={minAcceptedBoardUpdatedAt}
        />
      ) : null}
      <div className="flex flex-col space-y-3 sm:space-y-4">
        <RealtimeStatusBanner active={usesConvexRealtime} />
        <RetroHeader
          retroName={retroName}
          retroStatus={retroStatus}
          teamDisplayName={teamDisplayName}
          templateDisplayName={templateDisplayName}
          isAnonymous={isAnonymous}
          voteType={voteType}
          maxVotesPerUser={maxVotesPerUser}
          participants={participants}
          participantCount={participantCount}
          timerDuration={timerDuration}
          isTimerActive={isTimerActive}
          timeRemaining={timeRemaining}
          isLobbyTimerActive={isLobbyTimerActive}
          lobbyTimeRemaining={lobbyTimeRemaining}
          canComplete={canComplete}
          canControlPhases={canControlPhases}
          usesConvexRealtime={usesConvexRealtime}
          readyCount={readyCount}
          startLobbyMutation={startLobbyMutation}
          startRetroMutation={startRetroMutation}
          moveToVotingMutation={moveToVotingMutation}
          moveToGroupingMutation={moveToGroupingMutation}
          moveToDiscussionMutation={moveToDiscussionMutation}
          completeRetroMutation={completeRetroMutation}
          onDeleteClick={() => setDeleteRetroConfirmOpen(true)}
        />

        <DeleteRetroDialog
          open={deleteRetroConfirmOpen}
          onOpenChange={setDeleteRetroConfirmOpen}
          retroName={retroName}
          deleteRetroMutation={deleteRetroMutation}
        />

        {/* Timer Progress */}
        {retroStatus === 'active' && timerDuration && isTimerActive && (
          <div className="px-1">
            <Progress
              value={((timerDuration - timeRemaining) / timerDuration) * 100}
              className="h-1.5 bg-muted/50"
            />
          </div>
        )}

        <PhaseAlerts
          retroStatus={retroStatus}
          userVoteCount={userVoteCount}
          maxVotesPerUser={maxVotesPerUser}
          templateColumnCount={templateColumns.length}
          isTemplateFetching={isTemplateFetching}
        />

        {/* Lobby View - shown when retro is in waiting status */}
        {retroStatus === 'waiting' && (
          <RetroLobbyView
            participants={participants}
            canControl={canControl}
            isLobbyTimerActive={isLobbyTimerActive}
            lobbyTimeRemaining={lobbyTimeRemaining}
          />
        )}

        {/* Active phase action bar: typing indicator + ready button */}
        {retroStatus === 'active' && (
          <ReadyBar
            usesConvexRealtime={usesConvexRealtime}
            typingUsers={typingUsers}
            myReady={myReady}
            readyAnimating={readyAnimating}
            onReadyAnimationEnd={() => setReadyAnimating(false)}
            onToggleReady={toggleReady}
          />
        )}

        {/* Column Grid */}
        {showBoard && (
          <Suspense fallback={<RetroBoardSkeleton />}>
            <RetroBoard
              retroStatus={retroStatus}
              templateColumns={templateColumns}
              cards={retroCards}
              currentDiscussionCardId={currentDiscussionCardId}
              userVoteCount={userVoteCount}
              maxVotesPerUser={maxVotesPerUser}
              selectedCardIds={selectedCardIds}
              onToggleCardSelection={toggleCardSelection}
              localPendingCards={localPendingCards}
              newCardContent={newCardContent}
              onNewCardContentChange={setNewCardContent}
              scrollRefs={scrollRefs}
              createCardMutation={createCardMutation}
              deleteCardMutation={deleteCardMutation}
              mergeCardsMutation={mergeCardsMutation}
              unmergeCardMutation={unmergeCardMutation}
              voteMutation={voteMutation}
              removeVoteMutation={removeVoteMutation}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
            />
          </Suspense>
        )}

        {/* Discussion phase — full split-view replaces the card grid */}
        {retroStatus === 'discussing' && (
          <RetroDiscussionView
            retro={retro}
            previousCarriedItems={previousCarriedItems}
            canControl={canControlPhases}
            retroId={retroId}
            discussCardMutation={discussCardMutation}
            markDiscussedMutation={markDiscussedMutation}
            createCommentMutation={createCommentMutation}
            deleteCommentMutation={deleteCommentMutation}
            markCarriedItemDiscussingMutation={
              markCarriedItemDiscussingMutation
            }
            markCarriedItemDoneMutation={markCarriedItemDoneMutation}
            carryItemForwardMutation={carryItemForwardMutation}
            createCarriedItemCommentMutation={createCarriedItemCommentMutation}
            pendingCarriedDiscussItemId={pendingCarriedDiscussItemId}
            pendingCarriedDoneItemId={pendingCarriedDoneItemId}
            newCarriedItemComments={newCarriedItemComments}
            onNewCarriedItemCommentsChange={setNewCarriedItemComments}
          />
        )}

        {/* Retro Report — shown after retro is completed */}
        {retroStatus === 'completed' && (
          <RetroReport
            retro={retro}
            previousCarriedItems={previousCarriedItems}
          />
        )}
      </div>

      {/* Floating music player — facilitators only, during active phases */}
      {retroStatus !== 'draft' && canControl && <MusicPlayer />}
    </TooltipProvider>
  )
}
