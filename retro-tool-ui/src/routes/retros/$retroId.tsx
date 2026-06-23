import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  EyeOff,
  GitMerge,
  MessageSquare,
  MoreVertical,
  Play,
  Plus,
  RotateCcw,
  ThumbsUp,
  Trash2,
  Users,
  Vote,
} from 'lucide-react'
import React, {
  useEffect,
  useRef,
  useState,
  memo,
  useCallback,
  useMemo,
} from 'react'
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react'
import type { FunctionReference } from 'convex/server'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRetroMutations } from './hooks/useRetroMutations'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { getRetroSocket } from '@/lib/socket'
import { ACTION_ITEMS_ENDPOINTS, RETROS_ENDPOINTS } from '@/lib/api-endpoints'
import type { RetroDetail } from '@/common/types/retros'
import type { TRetroStatus } from '@/common/enums/retro.enums'
import { ACTION_ITEM_STATUSES } from '@/common/enums/action-item.enums'
import type { Template } from '@/common/types/templates'
import { cn } from '@/lib/utils'
import { RetroReport } from '@/components/retro-report'
import { MusicPlayer } from '@/components/music-player'
import { usesConvexForRetros } from '@/lib/realtime-config'
import { RetroConvexSync } from './components/retro-convex-sync'
import { RetroDiscussionView } from './components/retro-discussion-view'
import type { CarriedForwardItem } from './types'

const startTypingMutationRef =
  'liveRetros:startTyping' as unknown as FunctionReference<'mutation'>
const stopTypingMutationRef =
  'liveRetros:stopTyping' as unknown as FunctionReference<'mutation'>
const getTypingUsersQueryRef =
  'liveRetros:getTypingUsers' as unknown as FunctionReference<'query'>
const setReadyStatusMutationRef =
  'liveRetros:setReadyStatus' as unknown as FunctionReference<'mutation'>
const clearAllReadyMutationRef =
  'liveRetros:clearAllReady' as unknown as FunctionReference<'mutation'>
const getReadyStatusQueryRef =
  'liveRetros:getReadyStatus' as unknown as FunctionReference<'query'>

function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

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
  component: RetroDetailPage,
})

function RetroDetailPage() {
  const { retroId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const usesConvexRealtime = usesConvexForRetros()

  const { data: currentUser } = useCurrentUser()

  // ── Convex typing indicator ──────────────────────────────────────────────────
  const startTypingConvex = useConvexMutation(startTypingMutationRef)
  const stopTypingConvex = useConvexMutation(stopTypingMutationRef)
  const rawTypingUsers = useConvexQuery(
    getTypingUsersQueryRef,
    usesConvexRealtime ? { retroId } : 'skip',
  )
  const typingUsers = (rawTypingUsers ?? []).filter(
    (u: { userId: string }) => u.userId !== currentUser?.id,
  )
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  const handleTypingStart = useCallback(() => {
    if (!usesConvexRealtime || !currentUser) return
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    // Only fire mutation on idle → typing transition
    if (!isTypingRef.current) {
      isTypingRef.current = true
      startTypingConvex({
        retroId,
        userId: currentUser.id,
        displayName: currentUser.name,
      })
    }
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false
      typingTimeoutRef.current = null
      stopTypingConvex({ retroId, userId: currentUser.id })
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
      stopTypingConvex({ retroId, userId: currentUser.id })
    }
  }, [usesConvexRealtime, currentUser, retroId, stopTypingConvex])

  // ── Convex ready status ──────────────────────────────────────────────────────
  const setReadyStatusConvex = useConvexMutation(setReadyStatusMutationRef)
  const clearAllReadyConvex = useConvexMutation(clearAllReadyMutationRef)
  const rawReadyStatuses = useConvexQuery(
    getReadyStatusQueryRef,
    usesConvexRealtime ? { retroId } : 'skip',
  )
  const readyStatuses = rawReadyStatuses ?? []
  const myReady = Boolean(
    (readyStatuses as Array<{ userId: string; isReady: boolean }>).find(
      (r) => r.userId === currentUser?.id,
    )?.isReady,
  )
  const readyCount = (readyStatuses as Array<{ isReady: boolean }>).filter(
    (r) => r.isReady,
  ).length

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
    setReadyStatusConvex({
      retroId,
      userId: currentUser.id,
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
    api.post(RETROS_ENDPOINTS.JOIN(retroId)).catch(() => {})
  }, [retroId])

  const {
    data: retro,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['retro', retroId],
    queryFn: () => api.get<RetroDetail>(RETROS_ENDPOINTS.BY_ID(retroId)),
    staleTime: 5_000,
    refetchInterval: usesConvexRealtime ? false : 3_000,
  })

  // Clear typing + ready status when the active phase ends
  const prevRetroStatusRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevRetroStatusRef.current
    if (prev === 'active' && retro?.status !== 'active' && usesConvexRealtime) {
      if (currentUser) {
        stopTypingConvex({ retroId, userId: currentUser.id })
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

  useEffect(() => {
    if (usesConvexRealtime) {
      return
    }

    const socket = getRetroSocket()

    const joinRoom = () => socket.emit('join-retro', { retroId })

    const onRetroChanged = ({
      status,
    }: {
      retroId: string
      status?: TRetroStatus
    }) => {
      if (status) {
        queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
          prev ? { ...prev, status } : prev,
        )
      }
      void queryClient.invalidateQueries({ queryKey: ['retro', retroId] })
      void queryClient.invalidateQueries({
        queryKey: ['retro-previous-carried', retroId],
      })
    }

    const onDiscussionCardChanged = ({
      cardId,
    }: {
      retroId: string
      cardId: string
    }) => {
      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
        prev
          ? {
              ...prev,
              currentDiscussionCardId: cardId,
              currentDiscussionActionItemId: null,
            }
          : prev,
      )
    }

    const onDiscussionActionItemChanged = ({
      actionItemId,
    }: {
      retroId: string
      actionItemId: string
    }) => {
      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
        prev
          ? {
              ...prev,
              currentDiscussionActionItemId: actionItemId,
              currentDiscussionCardId: null,
            }
          : prev,
      )
    }

    socket.on('retro-changed', onRetroChanged)
    socket.on('connect', joinRoom)
    socket.on('discussion-card-changed', onDiscussionCardChanged)
    socket.on('discussion-action-item-changed', onDiscussionActionItemChanged)
    const onCarriedForwardChanged = ({
      retroId: changedRetroId,
      actionItemId,
    }: {
      retroId: string
      actionItemId?: string
    }) => {
      if (actionItemId) {
        queryClient.setQueryData<CarriedForwardItem[]>(
          ['retro-previous-carried', changedRetroId],
          (prev) =>
            Array.isArray(prev)
              ? prev.filter((item) => item.id !== actionItemId)
              : prev,
        )
        // Also prune the currently viewed retro key as a safety net.
        queryClient.setQueryData<CarriedForwardItem[]>(
          ['retro-previous-carried', retroId],
          (prev) =>
            Array.isArray(prev)
              ? prev.filter((item) => item.id !== actionItemId)
              : prev,
        )
      }

      void queryClient.invalidateQueries({
        queryKey: ['retro-previous-carried', changedRetroId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['retro-previous-carried', retroId],
      })
    }
    socket.on('carried-forward-changed', onCarriedForwardChanged)

    if (socket.connected) {
      joinRoom()
    } else {
      socket.connect()
    }

    return () => {
      socket.emit('leave-retro', { retroId })
      socket.off('retro-changed', onRetroChanged)
      socket.off('connect', joinRoom)
      socket.off('discussion-card-changed', onDiscussionCardChanged)
      socket.off(
        'discussion-action-item-changed',
        onDiscussionActionItemChanged,
      )
      socket.off('carried-forward-changed', onCarriedForwardChanged)
    }
  }, [retroId, queryClient, usesConvexRealtime])

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
  const [localPendingCards, setLocalPendingCards] = useState<
    Record<
      string,
      Array<{
        id: string
        content: string
        author: {
          id: string
          name: string | null
          image: string | null
          jobRole: string | null
        } | null
      }>
    >
  >({})
  const [newCarriedItemComments, setNewCarriedItemComments] = useState<
    Partial<Record<string, string>>
  >({})
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

  const createCardMutation = useMutation({
    mutationFn: ({
      columnId,
      content,
    }: {
      columnId: string
      content: string
    }) => api.post(RETROS_ENDPOINTS.CARDS, { retroId, columnId, content }),
    onMutate: ({ columnId, content }) => {
      const trimmedContent = content.trim()
      if (!trimmedContent) {
        return { tempId: '', columnId }
      }

      const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setLocalPendingCards((prev) => ({
        ...prev,
        [columnId]: [
          ...(prev[columnId] ?? []),
          {
            id: tempId,
            content: trimmedContent,
            author: currentUser
              ? {
                  id: currentUser.id,
                  name: currentUser.name,
                  image: currentUser.image ?? null,
                  jobRole: currentUserJobRole,
                }
              : null,
          },
        ],
      }))
      setNewCardContent((prev) => ({ ...prev, [columnId]: '' }))
      setScrollToColumn(columnId)
      return { tempId, columnId }
    },
    onError: (_, __, context) => {
      if (!context?.tempId) return
      setLocalPendingCards((prev) => ({
        ...prev,
        [context.columnId]: (prev[context.columnId] ?? []).filter(
          (card) => card.id !== context.tempId,
        ),
      }))
    },
    onSuccess: () => {
      invalidateRetroDetail()
    },
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

  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) =>
      api.delete(RETROS_ENDPOINTS.CARD_BY_ID(cardId)),
    onSuccess: () => {
      invalidateRetroDetail()
    },
  })

  const mergeCardsMutation = useMutation({
    mutationFn: ({
      cardIds,
      columnId,
    }: {
      cardIds: string[]
      columnId: string
    }) => {
      if (retro?.status !== 'grouping') {
        throw new Error('Cards can only be merged during the grouping phase')
      }
      return api.post<{ success: boolean; id: string }>(
        RETROS_ENDPOINTS.MERGE_CARDS(retroId),
        {
          cardIds,
          columnId,
        },
      )
    },
    onMutate: async ({ cardIds }) => {
      markConvexBoardSnapshotFloor()
      await queryClient.cancelQueries({ queryKey: ['retro', retroId] })
      const previous = queryClient.getQueryData<RetroDetail>(['retro', retroId])

      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) => {
        if (!prev) return prev
        const mergingCards = cardIds
          .map((id) => prev.cards.find((c) => c.id === id))
          .filter((c): c is RetroDetail['cards'][number] => c !== undefined)
        if (mergingCards.length < 2) return prev

        // In drag-and-drop cardIds = [dragged, target]; target absorbs dragged.
        // For checkbox merge the last selected card acts as the target.
        const targetCard = mergingCards[mergingCards.length - 1]
        const sourceIds = new Set(mergingCards.slice(0, -1).map((c) => c.id))

        const allSourceContents = mergingCards.flatMap((c) =>
          c.sourceContents && c.sourceContents.length > 0
            ? c.sourceContents
            : [c.content],
        )

        const allAuthorNames = mergingCards
          .flatMap((c) =>
            c.mergedFromNames && c.mergedFromNames.length > 0
              ? c.mergedFromNames
              : c.author?.name
                ? [c.author.name]
                : [],
          )
          .filter(Boolean)

        const mergedCard: RetroDetail['cards'][number] = {
          ...targetCard,
          sourceContents: allSourceContents,
          mergedFromNames: allAuthorNames,
          mergedCount: mergingCards.reduce(
            (sum, c) =>
              sum + (c.mergedCount && c.mergedCount > 0 ? c.mergedCount : 1),
            0,
          ),
          canUnmerge: true,
          voteCount: mergingCards.reduce(
            (sum, c) => sum + (c.voteCount ?? 0),
            0,
          ),
          hasVoted: mergingCards.some((c) => c.hasVoted),
          comments: mergingCards.flatMap((c) => c.comments),
        }

        return {
          ...prev,
          cards: prev.cards
            .filter((c) => !sourceIds.has(c.id))
            .map((c) => (c.id === targetCard.id ? mergedCard : c)),
        }
      })

      return { previous }
    },
    onSuccess: (data, variables) => {
      // The server deletes all merged cards and creates a brand-new UUID.
      // Immediately replace the optimistic target card's stale ID with the real
      // server ID so rapid back-to-back merges always reference a valid card.
      const optimisticTargetId = variables.cardIds[variables.cardIds.length - 1]
      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === optimisticTargetId ? { ...c, id: data.id } : c,
          ),
        }
      })
      setSelectedCardIds({})
      invalidateRetroDetail()
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['retro', retroId], context.previous)
      }
    },
  })

  const unmergeCardMutation = useMutation({
    mutationFn: (cardId: string) => {
      if (retro?.status !== 'grouping') {
        throw new Error('Cards can only be unmerged during the grouping phase')
      }
      return api.post(RETROS_ENDPOINTS.UNMERGE_CARD(retroId, cardId))
    },
    onMutate: async (cardId: string) => {
      markConvexBoardSnapshotFloor()
      await queryClient.cancelQueries({ queryKey: ['retro', retroId] })
      const previous = queryClient.getQueryData<RetroDetail>(['retro', retroId])

      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) => {
        if (!prev) return prev
        const mergedCard = prev.cards.find((c) => c.id === cardId)
        if (!mergedCard) return prev

        const sourceContents =
          mergedCard.sourceContents && mergedCard.sourceContents.length > 0
            ? mergedCard.sourceContents
            : [mergedCard.content]

        const placeholders: RetroDetail['cards'] = sourceContents.map(
          (content, i) => ({
            id: `__unmerge_${cardId}_${i}`,
            columnId: mergedCard.columnId,
            content,
            sourceContents: [],
            mergedFromNames: [],
            mergedCount: 0,
            canUnmerge: false,
            isDiscussed: false,
            isCarriedForward: false,
            discussedAt: null,
            voteCount: 0,
            hasVoted: false,
            isOwn: mergedCard.isOwn,
            // Use the stored author name from mergedFromNames so the card
            // doesn't flash as anonymous while waiting for the server response.
            author: mergedCard.mergedFromNames?.[i]
              ? {
                  id: '',
                  name: mergedCard.mergedFromNames[i],
                  image: null,
                  jobRole: null,
                }
              : mergedCard.author,
            comments: [],
          }),
        )

        return {
          ...prev,
          cards: prev.cards.flatMap((c) =>
            c.id === cardId ? placeholders : [c],
          ),
        }
      })

      return { previous }
    },
    onSuccess: () => {
      setSelectedCardIds({})
      invalidateRetroDetail()
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['retro', retroId], context.previous)
      }
    },
  })

  const voteMutation = useMutation({
    mutationFn: (cardId: string) =>
      api.post(RETROS_ENDPOINTS.CARD_VOTE(cardId)),
    onMutate: (cardId: string) => {
      // Optimistic update - instantly show vote
      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          userVoteCount: prev.userVoteCount + 1,
          cards: prev.cards.map((card) =>
            card.id === cardId
              ? {
                  ...card,
                  hasVoted: true,
                  voteCount: (card.voteCount ?? 0) + 1,
                }
              : card,
          ),
        }
      })
    },
    onSuccess: () => {
      // Don't refetch - WebSocket retro-changed will handle it
    },
    onError: () => {
      // Revert optimistic update on error
      void queryClient.refetchQueries({ queryKey: ['retro', retroId] })
    },
  })

  const removeVoteMutation = useMutation({
    mutationFn: (cardId: string) =>
      api.delete(RETROS_ENDPOINTS.CARD_VOTE(cardId)),
    onMutate: (cardId: string) => {
      // Optimistic update - instantly remove vote
      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          userVoteCount: Math.max(0, prev.userVoteCount - 1),
          cards: prev.cards.map((card) =>
            card.id === cardId
              ? {
                  ...card,
                  hasVoted: false,
                  voteCount: Math.max(0, (card.voteCount ?? 0) - 1),
                }
              : card,
          ),
        }
      })
    },
    onSuccess: () => {
      // Don't refetch - WebSocket retro-changed will handle it
    },
    onError: () => {
      // Revert optimistic update on error
      void queryClient.refetchQueries({ queryKey: ['retro', retroId] })
    },
  })

  const discussCardMutation = useMutation({
    mutationFn: (cardId: string) =>
      api.post(RETROS_ENDPOINTS.DISCUSS_CARD(retroId, cardId)),
    onMutate: async (cardId: string) => {
      markConvexBoardSnapshotFloor()
      await queryClient.cancelQueries({ queryKey: ['retro', retroId] })
      const previous = queryClient.getQueryData<RetroDetail>(['retro', retroId])

      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
        prev
          ? {
              ...prev,
              currentDiscussionCardId: cardId,
              currentDiscussionActionItemId: null,
            }
          : prev,
      )

      return { previous }
    },
    onSuccess: () => {
      invalidateRetroDetail()
    },
    onError: (e: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['retro', retroId], context.previous)
      }
      toast.error(e.message || 'Failed to set discussion point')
    },
  })

  const markDiscussedMutation = useMutation({
    mutationFn: (cardId: string) =>
      api.post(RETROS_ENDPOINTS.MARK_DISCUSSED(retroId, cardId)),
    onMutate: async (cardId: string) => {
      markConvexBoardSnapshotFloor()
      await queryClient.cancelQueries({ queryKey: ['retro', retroId] })
      const previous = queryClient.getQueryData<RetroDetail>(['retro', retroId])
      const nowIso = new Date().toISOString()

      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
        prev
          ? {
              ...prev,
              currentDiscussionCardId: null,
              cards: prev.cards.map((card) =>
                card.id === cardId
                  ? { ...card, isDiscussed: true, discussedAt: nowIso }
                  : card,
              ),
            }
          : prev,
      )

      return { previous }
    },
    onSuccess: () => {
      invalidateRetroDetail()
    },
    onError: (e: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['retro', retroId], context.previous)
      }
      toast.error(e.message || 'Failed to mark card as discussed')
    },
  })

  const createCommentMutation = useMutation({
    mutationFn: ({ cardId, content }: { cardId: string; content: string }) =>
      api.post<{ id: string; retroId: string }>(
        RETROS_ENDPOINTS.CARD_COMMENTS(cardId),
        {
          content,
        },
      ),
    onMutate: async ({ cardId, content }) => {
      markConvexBoardSnapshotFloor()
      await queryClient.cancelQueries({ queryKey: ['retro', retroId] })
      const previous = queryClient.getQueryData<RetroDetail>(['retro', retroId])
      const trimmed = content.trim()
      if (!trimmed) {
        return { previous, tempId: '', cardId }
      }

      const tempId = `__optimistic_comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const optimisticComment: RetroDetail['cards'][number]['comments'][number] =
        {
          id: tempId,
          content: trimmed,
          isOwn: true,
          createdAt: new Date().toISOString(),
          author: currentUser
            ? {
                id: currentUser.id,
                name: currentUser.name,
                image: currentUser.image ?? null,
              }
            : null,
        }

      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
        prev
          ? {
              ...prev,
              cards: prev.cards.map((card) =>
                card.id === cardId
                  ? { ...card, comments: [...card.comments, optimisticComment] }
                  : card,
              ),
            }
          : prev,
      )

      return { previous, tempId, cardId }
    },
    onSuccess: (result, _vars, context) => {
      if (context.tempId) {
        queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
          prev
            ? {
                ...prev,
                cards: prev.cards.map((card) =>
                  card.id === context.cardId
                    ? {
                        ...card,
                        comments: card.comments.map((comment) =>
                          comment.id === context.tempId
                            ? { ...comment, id: result.id }
                            : comment,
                        ),
                      }
                    : card,
                ),
              }
            : prev,
        )
      }
      invalidateRetroDetail()
    },
    onError: (e: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['retro', retroId], context.previous)
      }
      toast.error(e.message || 'Failed to add comment')
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) =>
      api.delete(RETROS_ENDPOINTS.COMMENT_BY_ID(commentId)),
    onMutate: async (commentId: string) => {
      markConvexBoardSnapshotFloor()
      await queryClient.cancelQueries({ queryKey: ['retro', retroId] })
      const previous = queryClient.getQueryData<RetroDetail>(['retro', retroId])

      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
        prev
          ? {
              ...prev,
              cards: prev.cards.map((card) => ({
                ...card,
                comments: card.comments.filter(
                  (comment) => comment.id !== commentId,
                ),
              })),
            }
          : prev,
      )

      return { previous }
    },
    onSuccess: () => {
      invalidateRetroDetail()
    },
    onError: (e: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['retro', retroId], context.previous)
      }
      toast.error(e.message || 'Failed to delete comment')
    },
  })

  const deleteRetroMutation = useMutation({
    mutationFn: () => api.delete(RETROS_ENDPOINTS.BY_ID(retroId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['retros'] })
      toast.success('Retrospective deleted')
      void navigate({ to: '/retros' })
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete retro'),
  })

  // Carried-forward items from the previous retro (shown in discussion phase)
  const [pendingCarriedDiscussItemId, setPendingCarriedDiscussItemId] =
    useState<string | null>(null)
  const [pendingCarriedDoneItemId, setPendingCarriedDoneItemId] = useState<
    string | null
  >(null)

  const { data: previousCarriedItems = [] } = useQuery({
    queryKey: ['retro-previous-carried', retroId],
    queryFn: () =>
      api.get<CarriedForwardItem[]>(
        RETROS_ENDPOINTS.PREVIOUS_CARRIED_FORWARD(retroId),
      ),
    enabled: retro?.status === 'discussing' || retro?.status === 'completed',
    staleTime: usesConvexRealtime ? 60_000 : 0,
    refetchInterval:
      !usesConvexRealtime &&
      (retro?.status === 'discussing' || retro?.status === 'completed')
        ? 3000
        : false,
    refetchIntervalInBackground: !usesConvexRealtime,
  })

  const createCarriedItemCommentMutation = useMutation({
    mutationFn: ({
      actionItemId,
      content,
    }: {
      actionItemId: string
      content: string
    }) =>
      api.post<{ id: string }>(ACTION_ITEMS_ENDPOINTS.COMMENTS(actionItemId), {
        content,
      }),
    onMutate: async ({ actionItemId, content }) => {
      markConvexBoardSnapshotFloor()
      await queryClient.cancelQueries({
        queryKey: ['retro-previous-carried', retroId],
      })
      const previous = queryClient.getQueryData<CarriedForwardItem[]>([
        'retro-previous-carried',
        retroId,
      ])
      const trimmed = content.trim()
      if (!trimmed) return { previous, tempId: '', actionItemId }

      const tempId = `__optimistic_carried_comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const optimisticComment: NonNullable<
        CarriedForwardItem['comments']
      >[number] = {
        id: tempId,
        content: trimmed,
        isOwn: true,
        createdAt: new Date().toISOString(),
        author: currentUser
          ? {
              id: currentUser.id,
              name: currentUser.name,
              image: currentUser.image ?? null,
            }
          : null,
      }

      queryClient.setQueryData<CarriedForwardItem[]>(
        ['retro-previous-carried', retroId],
        (prev) =>
          Array.isArray(prev)
            ? prev.map((item) =>
                item.id === actionItemId
                  ? {
                      ...item,
                      comments: [...(item.comments ?? []), optimisticComment],
                    }
                  : item,
              )
            : prev,
      )

      return { previous, tempId, actionItemId }
    },
    onSuccess: (result, variables, context) => {
      if (context.tempId) {
        queryClient.setQueryData<CarriedForwardItem[]>(
          ['retro-previous-carried', retroId],
          (prev) =>
            Array.isArray(prev)
              ? prev.map((item) =>
                  item.id === variables.actionItemId
                    ? {
                        ...item,
                        comments: (item.comments ?? []).map((c) =>
                          c.id === context.tempId ? { ...c, id: result.id } : c,
                        ),
                      }
                    : item,
                )
              : prev,
        )
      }
      setNewCarriedItemComments((prev) => ({
        ...prev,
        [variables.actionItemId]: '',
      }))
      invalidatePreviousCarried()
    },
    onError: (e: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['retro-previous-carried', retroId],
          context.previous,
        )
      }
      toast.error(e.message || 'Failed to add comment')
    },
  })

  const markCarriedItemDiscussingMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.post(RETROS_ENDPOINTS.DISCUSS_ACTION_ITEM(retroId, itemId)),
    onMutate: (itemId: string) => {
      setPendingCarriedDiscussItemId(itemId)
    },
    onSuccess: (_result, itemId) => {
      queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
        prev
          ? {
              ...prev,
              currentDiscussionActionItemId: itemId,
              currentDiscussionCardId: null,
            }
          : prev,
      )
      invalidateRetroDetail()
    },
    onSettled: () => {
      setPendingCarriedDiscussItemId(null)
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to mark as discussing'),
  })

  const markCarriedItemDoneMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.patch(ACTION_ITEMS_ENDPOINTS.BY_ID(itemId), {
        status: ACTION_ITEM_STATUSES.Completed,
      }),
    onMutate: (itemId: string) => {
      setPendingCarriedDoneItemId(itemId)
    },
    onSuccess: (_result, itemId) => {
      toast.success('Marked as done')

      // Find the next undone carried item before removing the current one
      const carriedItems =
        queryClient.getQueryData<CarriedForwardItem[]>([
          'retro-previous-carried',
          retroId,
        ]) ?? []
      const currentIdx = carriedItems.findIndex((i) => i.id === itemId)
      const nextItem =
        carriedItems
          .slice(currentIdx + 1)
          .find((i) => i.status !== 'completed') ??
        carriedItems
          .slice(0, currentIdx)
          .find((i) => i.status !== 'completed' && i.id !== itemId)

      queryClient.setQueryData<CarriedForwardItem[]>(
        ['retro-previous-carried', retroId],
        (prev) =>
          Array.isArray(prev)
            ? prev.filter((item) => item.id !== itemId)
            : prev,
      )

      if (nextItem) {
        // Optimistically advance to the next item immediately — prevents flicker
        // while the discuss API call is in-flight
        queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
          prev
            ? {
                ...prev,
                currentDiscussionActionItemId: nextItem.id,
                currentDiscussionCardId: null,
              }
            : prev,
        )
        markCarriedItemDiscussingMutation.mutate(nextItem.id)
      } else {
        queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
          prev ? { ...prev, currentDiscussionActionItemId: null } : prev,
        )
      }

      invalidatePreviousCarried()
    },
    onSettled: () => {
      setPendingCarriedDoneItemId(null)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to mark as done'),
  })

  const carryItemForwardMutation = useMutation({
    mutationFn: (item: { id: string; title: string }) =>
      Promise.all([
        // Mark old item as completed so it doesn't re-appear
        api.patch(ACTION_ITEMS_ENDPOINTS.BY_ID(item.id), {
          status: ACTION_ITEM_STATUSES.Completed,
        }),
        // Create a new action item on the current retro
        api.post(RETROS_ENDPOINTS.ACTION_ITEMS(retroId), {
          title: item.title,
          description: 'Carried forward from previous retro',
          isCarriedForward: true,
        }),
      ]),
    onSuccess: () => {
      toast.success('Item carried forward to this retro')
      invalidatePreviousCarried()
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to carry forward item'),
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

  // DnD sensors — require 8px movement before drag starts so clicks still register
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingCardId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingCardId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeData = active.data.current as { columnId: string }
    const overData = over.data.current as { columnId: string }

    // Prevent cross-column merging
    if (activeData.columnId !== overData.columnId) {
      toast.warning('Cards can only be merged within the same column')
      return
    }

    mergeCardsMutation.mutate({
      cardIds: [active.id as string, over.id as string],
      columnId: activeData.columnId,
    })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Preserve card positions during grouping so the merged card doesn't jump
  // when the Convex snapshot arrives with a brand-new server-side card ID.
  const stableCardOrderRef = useRef<string[]>([])
  const isGroupingPhase = retro?.status === 'grouping'

  const stableRetroCards = useMemo(() => {
    const allCards = retro?.cards ?? []
    if (!isGroupingPhase) {
      stableCardOrderRef.current = []
      return allCards
    }

    const prevOrder = stableCardOrderRef.current
    if (prevOrder.length === 0) {
      stableCardOrderRef.current = allCards.map((c) => c.id)
      return allCards
    }

    const incomingMap = new Map(allCards.map((c) => [c.id, c]))
    const prevSet = new Set(prevOrder)
    const newCards = allCards.filter((c) => !prevSet.has(c.id))

    const result: RetroDetail['cards'] = []
    let newCardsInserted = false

    for (const id of prevOrder) {
      if (incomingMap.has(id)) {
        result.push(incomingMap.get(id)!)
      } else if (!newCardsInserted && newCards.length > 0) {
        // Card was removed (merged); slot in the replacement card(s) here
        for (const card of newCards) result.push(card)
        newCardsInserted = true
      }
    }

    if (!newCardsInserted) {
      for (const card of newCards) result.push(card)
    }

    stableCardOrderRef.current = result.map((c) => c.id)
    return result
  }, [retro?.cards, isGroupingPhase])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'secondary'
      case 'completed':
        return 'outline'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Not Started'
      case 'active':
        return 'Adding Cards'
      case 'voting':
        return 'Voting'
      case 'grouping':
        return 'Grouping'
      case 'discussing':
        return 'Discussing'
      case 'completed':
        return 'Completed'
      default:
        return status
    }
  }

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
  const isGrouping = retroStatus === 'grouping'

  const toggleCardSelection = useCallback((cardId: string) => {
    setSelectedCardIds((prev) => ({ ...prev, [cardId]: !prev[cardId] }))
  }, [])

  const getColumnCards = useCallback(
    (columnId: string) => {
      const cards = stableRetroCards.filter((c) => c.columnId === columnId)
      if (retroStatus === 'grouping' || retroStatus === 'voting') return cards
      // active phase: oldest first so newest cards appear at the bottom (chat-like)
      if (retroStatus === 'active') return [...cards].reverse()
      return [...cards].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
    },
    [stableRetroCards, retroStatus],
  )

  const handleVoteClick = useCallback(
    (cardId: string, hasVoted: boolean) => {
      if (hasVoted) {
        removeVoteMutation.mutate(cardId)
        return
      }

      if (userVoteCount >= maxVotesPerUser) {
        toast.warning(
          `You have used all ${maxVotesPerUser} votes. Remove a vote to change your selection.`,
        )
        return
      }

      voteMutation.mutate(cardId)
    },
    [userVoteCount, maxVotesPerUser, voteMutation, removeVoteMutation],
  )

  return (
    <TooltipProvider>
      {usesConvexRealtime ? (
        <RetroConvexSync
          retroId={retroId}
          minAcceptedUpdatedAt={minAcceptedBoardUpdatedAt}
        />
      ) : null}
      <div className="flex flex-col space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-linear-to-r from-background via-muted/30 to-background rounded-xl p-3 sm:p-4 border border-border/50">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="hover:bg-background/80 h-8 w-8 sm:h-10 sm:w-10 shrink-0"
            >
              <Link to="/retros" search={{ page: 1, limit: 6 }}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">
                  {retroName}
                </h1>
                <Badge
                  variant={getStatusColor(retroStatus)}
                  className="shadow-sm text-[10px] sm:text-xs shrink-0"
                >
                  {getStatusLabel(retroStatus)}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                {teamDisplayName} • {templateDisplayName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end sm:justify-start">
            {/* Settings badges */}
            <div className="hidden sm:flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant="outline"
                    className="gap-1.5 py-1 px-2 sm:px-2.5 bg-background/50 text-[10px] sm:text-xs"
                  >
                    {isAnonymous ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    <span className="hidden lg:inline">
                      {isAnonymous ? 'Anonymous' : 'Named'}
                    </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {isAnonymous
                    ? 'Card authors are hidden'
                    : 'Card authors are visible'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant="outline"
                    className="gap-1.5 py-1 px-2 sm:px-2.5 bg-background/50 text-[10px] sm:text-xs"
                  >
                    <Vote className="h-3 w-3" />
                    <span className="hidden lg:inline">
                      {voteType === 'multi'
                        ? `${maxVotesPerUser} votes`
                        : '1 vote'}
                    </span>
                    <span className="lg:hidden">{maxVotesPerUser}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {voteType === 'multi'
                    ? `Each person can vote ${maxVotesPerUser} times`
                    : 'Each person can vote once'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center -space-x-2 cursor-default">
                    {participants.slice(0, 5).map((p) => (
                      <Avatar
                        key={p.userId}
                        className="h-7 w-7 border-2 border-background ring-1 ring-border"
                      >
                        <AvatarImage src={p.user?.image ?? undefined} />
                        <AvatarFallback className="text-[10px] font-semibold bg-muted">
                          {getInitials(p.user?.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {participants.length > 5 && (
                      <div className="h-7 w-7 rounded-full bg-muted border-2 border-background ring-1 ring-border flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                        +{participants.length - 5}
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium mb-1">
                    {participantCount} participant(s)
                  </p>
                  <ul className="text-xs space-y-0.5">
                    {participants.map((p) => (
                      <li key={p.userId}>{p.user?.name ?? 'Unknown'}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Timer display */}
            {retroStatus === 'active' && timerDuration && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-background/50 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 border border-border/50">
                <Clock
                  className={cn(
                    'h-3 w-3 sm:h-4 sm:w-4',
                    isTimerActive
                      ? 'text-primary animate-pulse'
                      : 'text-muted-foreground',
                  )}
                />
                {isTimerActive ? (
                  <span className="font-mono text-sm sm:text-lg font-bold tabular-nums">
                    {formatTime(timeRemaining)}
                  </span>
                ) : (
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Timer ended
                  </span>
                )}
              </div>
            )}

            {/* Lobby auto-start countdown */}
            {retroStatus === 'waiting' && isLobbyTimerActive && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 border border-amber-200 dark:border-amber-800/50">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                <span className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                  Auto-starts in{' '}
                  <span className="font-mono font-bold tabular-nums">
                    {formatTime(lobbyTimeRemaining)}
                  </span>
                </span>
              </div>
            )}

            {/* Phase controls */}
            {canControl && (
              <div className="flex items-center gap-2">
                {retroStatus === 'draft' && (
                  <>
                    <Button
                      onClick={() => startLobbyMutation.mutate()}
                      disabled={startLobbyMutation.isPending}
                      className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                      size="sm"
                    >
                      <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      Open Lobby
                    </Button>
                    <Button
                      onClick={() => startRetroMutation.mutate()}
                      disabled={startRetroMutation.isPending}
                      variant="outline"
                      className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                      size="sm"
                    >
                      <Play className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      Start Now
                    </Button>
                  </>
                )}
                {retroStatus === 'waiting' && (
                  <Button
                    onClick={() => startRetroMutation.mutate()}
                    disabled={startRetroMutation.isPending}
                    className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                    size="sm"
                  >
                    <Play className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Start Early
                  </Button>
                )}
                {retroStatus === 'active' && (
                  <div className="flex items-center gap-2">
                    {usesConvexRealtime && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[11px] h-7 px-2"
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {readyCount}/{participantCount} ready
                      </Badge>
                    )}
                    <Button
                      onClick={() => moveToGroupingMutation.mutate()}
                      disabled={moveToGroupingMutation.isPending}
                      className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                      size="sm"
                    >
                      <GitMerge className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Move to </span>Grouping
                    </Button>
                  </div>
                )}
                {retroStatus === 'grouping' && (
                  <Button
                    onClick={() => moveToVotingMutation.mutate()}
                    disabled={moveToVotingMutation.isPending}
                    className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                    size="sm"
                  >
                    <Vote className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Move to </span>Voting
                  </Button>
                )}
                {retroStatus === 'voting' && (
                  <Button
                    onClick={() => moveToDiscussionMutation.mutate()}
                    disabled={moveToDiscussionMutation.isPending}
                    className="shadow-sm h-8 sm:h-9 text-xs sm:text-sm"
                    size="sm"
                  >
                    <MessageSquare className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Move to </span>Discuss
                  </Button>
                )}
                {retroStatus === 'discussing' && (
                  <Button
                    onClick={() => completeRetroMutation.mutate()}
                    disabled={completeRetroMutation.isPending}
                    variant="default"
                    className="shadow-sm bg-green-600 hover:bg-green-700 h-8 sm:h-9 text-xs sm:text-sm"
                    size="sm"
                  >
                    <CheckCircle className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Complete
                  </Button>
                )}
              </div>
            )}
            {/* Delete retro — available to creators and team leads */}
            {canControl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteRetroConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Delete Retro Confirmation */}
        <AlertDialog
          open={deleteRetroConfirmOpen}
          onOpenChange={setDeleteRetroConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Retrospective?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &ldquo;{retroName}&rdquo; and all
                its cards, votes, and action items. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => deleteRetroMutation.mutate()}
              >
                {deleteRetroMutation.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Timer Progress */}
        {retroStatus === 'active' && timerDuration && isTimerActive && (
          <div className="px-1">
            <Progress
              value={((timerDuration - timeRemaining) / timerDuration) * 100}
              className="h-1.5 bg-muted/50"
            />
          </div>
        )}

        {/* Phase alerts */}
        {retroStatus === 'voting' && (
          <Alert className="border-primary/20 bg-primary/5 py-2.5">
            <Vote className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center gap-1.5 flex-wrap text-sm">
              <span className="font-semibold text-primary">Voting Phase</span>
              <span className="text-muted-foreground">·</span>
              <span>
                You have used{' '}
                <span className="font-bold text-primary">{userVoteCount}</span>{' '}
                of{' '}
                <span className="font-bold text-primary">
                  {maxVotesPerUser}
                </span>{' '}
                votes
              </span>
              <span className="text-muted-foreground">·</span>
              <span>Click 👍 on cards to vote</span>
            </AlertDescription>
          </Alert>
        )}

        {retroStatus === 'grouping' && (
          <Alert className="border-primary/20 bg-primary/5">
            <GitMerge className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Grouping Phase</AlertTitle>
            <AlertDescription>
              Merge cards that describe similar topics before voting begins.
            </AlertDescription>
          </Alert>
        )}

        {templateColumns.length === 0 && (
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertTitle>
              {isTemplateFetching
                ? 'Loading template columns...'
                : 'Template columns unavailable'}
            </AlertTitle>
            <AlertDescription>
              {isTemplateFetching
                ? 'Preparing your board. This usually takes a moment.'
                : 'This retrospective loaded without column definitions. Please refresh, or verify the template still exists.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Lobby View - shown when retro is in waiting status */}
        {retroStatus === 'waiting' && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="max-w-md w-full text-center space-y-8">
              <div className="space-y-2">
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center border-2 border-amber-200 dark:border-amber-800/50">
                  <Users className="h-8 w-8 text-amber-600 dark:text-amber-400 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold">Gathering Participants</h2>
                <p className="text-muted-foreground">
                  The lobby is open! Wait for your team to join before the retro
                  begins.
                </p>
              </div>

              {/* Countdown timer */}
              {isLobbyTimerActive && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-6">
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                    Auto-starting in
                  </p>
                  <p className="text-4xl font-mono font-bold tabular-nums text-amber-800 dark:text-amber-200">
                    {formatTime(lobbyTimeRemaining)}
                  </p>
                </div>
              )}

              {/* Participants list */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Participants ({participants.length})
                </p>
                {participants.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5"
                      >
                        {p.user?.image ? (
                          <img
                            src={p.user.image}
                            alt={p.user.name ?? 'User'}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        )}
                        <span className="text-sm">
                          {p.user?.name ?? 'Participant'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No one has joined yet
                  </p>
                )}
              </div>

              {/* Non-creator message */}
              {!canControl && (
                <p className="text-sm text-muted-foreground">
                  Waiting for the facilitator to start the retro...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Active phase action bar: typing indicator + ready button */}
        {retroStatus === 'active' && (
          <div className="flex items-center justify-between gap-3 px-1">
            {/* Typing indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-h-5">
              {usesConvexRealtime && typingUsers.length > 0 && (
                <>
                  <div className="flex gap-1">
                    <span className="h-3 w-3 rounded-sm animate-ambulance-left inline-block" />
                    <span className="h-3 w-3 rounded-sm animate-ambulance-right inline-block" />
                  </div>
                  <span>
                    {typingUsers.length === 1
                      ? `${(typingUsers[0] as { displayName: string }).displayName} is typing…`
                      : `${typingUsers.length} people are typing…`}
                  </span>
                </>
              )}
            </div>

            {/* Ready button */}
            {usesConvexRealtime && (
              <Button
                variant={myReady ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'gap-1.5 h-7 text-xs transition-all',
                  myReady
                    ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                    : '',
                  readyAnimating ? 'animate-ready-pulse' : '',
                )}
                onAnimationEnd={() => setReadyAnimating(false)}
                onClick={toggleReady}
              >
                {myReady ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                {myReady ? 'Ready!' : 'Ready?'}
              </Button>
            )}
          </div>
        )}

        {/* Column Grid */}
        {retroStatus !== 'waiting' &&
          retroStatus !== 'discussing' &&
          retroStatus !== 'completed' && (
            <DndContext
              sensors={dndSensors}
              onDragStart={isGrouping ? handleDragStart : undefined}
              onDragEnd={isGrouping ? handleDragEnd : undefined}
            >
              <div
                className={cn(
                  'grid gap-3 sm:gap-4 pb-2',
                  'grid-cols-1',
                  templateColumns.length >= 2 && 'sm:grid-cols-2',
                  templateColumns.length >= 3 && 'lg:grid-cols-3',
                  templateColumns.length >= 4 && 'xl:grid-cols-4',
                )}
              >
                {templateColumns.map((column, index) => {
                  const cards = getColumnCards(column.id)
                  const selectedCardsInColumn = cards.filter(
                    (card) => selectedCardIds[card.id],
                  )
                  // Filter out pending cards already confirmed by the server to prevent
                  // the brief duplicate while the cleanup effect hasn't run yet
                  const pendingCards = (
                    localPendingCards[column.id] ?? []
                  ).filter(
                    (p) =>
                      !cards.some(
                        (sc) => sc.content.trim() === p.content.trim(),
                      ),
                  )
                  const totalCards = cards.length + pendingCards.length
                  const canShowPendingCards =
                    retroStatus === 'active' || retroStatus === 'voting'

                  const gradients = [
                    'from-rose-500/10 via-pink-500/5 to-transparent',
                    'from-violet-500/10 via-purple-500/5 to-transparent',
                    'from-amber-500/10 via-orange-500/5 to-transparent',
                    'from-emerald-500/10 via-green-500/5 to-transparent',
                    'from-sky-500/10 via-blue-500/5 to-transparent',
                    'from-fuchsia-500/10 via-pink-500/5 to-transparent',
                  ]
                  const borderColors = [
                    'border-rose-500/20',
                    'border-violet-500/20',
                    'border-amber-500/20',
                    'border-emerald-500/20',
                    'border-sky-500/20',
                    'border-fuchsia-500/20',
                  ]
                  const gradient = gradients[index % gradients.length]
                  const borderColor = borderColors[index % borderColors.length]

                  return (
                    <div
                      key={column.id}
                      className={cn(
                        'flex min-w-0 flex-col rounded-xl border-2 bg-linear-to-b shadow-sm overflow-hidden',
                        'max-h-[28rem] sm:max-h-[32rem] lg:h-[calc(100vh-17rem)] lg:max-h-none',
                        borderColor,
                        gradient,
                      )}
                    >
                      {/* Column Header */}
                      <div className="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-background/80 text-xl sm:text-2xl shadow-sm backdrop-blur-sm shrink-0">
                          {column.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <h3 className="font-semibold text-sm sm:text-base truncate">
                              {column.name}
                            </h3>
                            <Badge
                              variant="secondary"
                              className="text-[10px] sm:text-xs shrink-0 bg-background/60 backdrop-blur-sm"
                            >
                              {totalCards}
                            </Badge>
                          </div>
                          {isGrouping && selectedCardsInColumn.length >= 1 && (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 text-xs font-semibold bg-amber-400 text-amber-950 hover:bg-amber-300 border border-amber-300 shadow-sm"
                              onClick={() =>
                                mergeCardsMutation.mutate({
                                  cardIds: selectedCardsInColumn.map(
                                    (card) => card.id,
                                  ),
                                  columnId: column.id,
                                })
                              }
                              disabled={
                                selectedCardsInColumn.length < 2 ||
                                mergeCardsMutation.isPending
                              }
                            >
                              <GitMerge className="mr-1 h-3 w-3" />
                              Merge ({selectedCardsInColumn.length})
                            </Button>
                          )}
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1 hidden sm:block">
                            {isGrouping
                              ? 'Drag cards onto each other to merge, or check to select'
                              : column.prompt}
                          </p>
                        </div>
                      </div>

                      {/* Cards List */}
                      <div
                        ref={(el) => {
                          scrollRefs.current[column.id] = el
                        }}
                        className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-3"
                      >
                        <div className="space-y-2 sm:space-y-3 py-3">
                          {cards.length === 0 && pendingCards.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                              <div className="text-3xl sm:text-4xl mb-2 opacity-50">
                                {column.emoji}
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {retroStatus === 'active'
                                  ? 'No cards yet. Add your thoughts!'
                                  : retroStatus === 'voting'
                                    ? 'No cards are available to vote on yet.'
                                    : 'No cards are available in this column yet.'}
                              </p>
                            </div>
                          )}
                          {cards.map((card) => {
                            const isCurrentDiscussion =
                              currentDiscussionCardId === card.id
                            const isDiscussed = card.isDiscussed
                            return (
                              <DraggableCard
                                key={card.id}
                                id={card.id}
                                columnId={card.columnId}
                                enabled={isGrouping}
                                className={cn(
                                  'group relative transition-all duration-200 bg-background rounded-lg overflow-hidden',
                                  'before:absolute before:inset-0 before:bg-linear-to-r before:from-primary/5 before:to-transparent before:opacity-0 before:transition-opacity hover:before:opacity-100',
                                  'shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]',
                                  isGrouping &&
                                    selectedCardIds[card.id] &&
                                    'ring-2 ring-primary/60',
                                  isGrouping && 'cursor-pointer',
                                  card.hasVoted &&
                                    'ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]',
                                  isCurrentDiscussion &&
                                    'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]',
                                  isDiscussed && 'opacity-60',
                                )}
                                onClick={
                                  isGrouping
                                    ? (e) => {
                                        // Don't fire if the user clicked a button, input, or link
                                        if (
                                          (e.target as HTMLElement).closest(
                                            'button, input, a',
                                          )
                                        )
                                          return
                                        toggleCardSelection(card.id)
                                      }
                                    : undefined
                                }
                              >
                                {isGrouping && (
                                  <label className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px]">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(
                                        selectedCardIds[card.id],
                                      )}
                                      onChange={() =>
                                        toggleCardSelection(card.id)
                                      }
                                      className="h-3 w-3"
                                    />
                                    Select
                                  </label>
                                )}
                                <div className="relative px-3 py-2.5">
                                  {card.sourceContents &&
                                  card.sourceContents.length > 1 ? (
                                    <ul className="text-sm leading-relaxed list-disc list-inside space-y-1">
                                      {card.sourceContents.map(
                                        (content, idx) => (
                                          <li
                                            key={idx}
                                            className="whitespace-pre-wrap"
                                          >
                                            {content}
                                          </li>
                                        ),
                                      )}
                                    </ul>
                                  ) : (
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                      {card.content}
                                    </p>
                                  )}
                                </div>
                                <div className="relative flex items-center justify-between px-3 py-1.5 bg-linear-to-r from-muted/40 to-muted/20">
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    {card.canUnmerge ? (
                                      <div className="flex items-center gap-2">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary cursor-default select-none">
                                              <GitMerge className="h-3 w-3" />
                                              {card.mergedCount ??
                                                card.mergedFromNames?.length ??
                                                2}{' '}
                                              cards merged
                                            </span>
                                          </TooltipTrigger>
                                          {(card.mergedFromNames?.length ?? 0) >
                                            0 && (
                                            <TooltipContent side="top">
                                              <p className="text-xs font-medium mb-0.5">
                                                Merged from:
                                              </p>
                                              <ul className="text-xs space-y-0.5">
                                                {card.mergedFromNames!.map(
                                                  (name, i) => (
                                                    <li key={i}>{name}</li>
                                                  ),
                                                )}
                                              </ul>
                                            </TooltipContent>
                                          )}
                                        </Tooltip>
                                        {isGrouping && (
                                          <Button
                                            variant="default"
                                            size="sm"
                                            className="h-6 gap-1 px-2 text-[10px] font-semibold bg-rose-500 text-white hover:bg-rose-400 border border-rose-400 shadow-sm"
                                            onClick={() =>
                                              unmergeCardMutation.mutate(
                                                card.id,
                                              )
                                            }
                                            disabled={
                                              unmergeCardMutation.isPending
                                            }
                                          >
                                            <RotateCcw className="h-3 w-3" />
                                            Unmerge
                                          </Button>
                                        )}
                                      </div>
                                    ) : card.author ? (
                                      <>
                                        <Avatar className="h-4 w-4 ring-1 ring-border">
                                          <AvatarImage
                                            src={card.author.image ?? undefined}
                                          />
                                          <AvatarFallback className="text-[8px]">
                                            {card.author.name?.charAt(0) ?? '?'}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-[11px]">
                                          {card.author.name}
                                        </span>
                                        {card.author.jobRole && (
                                          <Badge
                                            className={`text-[10px] h-5 ${
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
                                              }[card.author.jobRole]
                                            }`}
                                          >
                                            {card.author.jobRole}
                                          </Badge>
                                        )}
                                      </>
                                    ) : (
                                      <span className="italic text-muted-foreground/70 text-[11px]">
                                        Anonymous
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-0.5">
                                    {/* Vote button (only in voting phase) */}
                                    {retroStatus === 'voting' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant={
                                              card.hasVoted
                                                ? 'default'
                                                : 'ghost'
                                            }
                                            size="sm"
                                            className={cn(
                                              'h-6 gap-1 px-2 text-xs transition-all',
                                              card.hasVoted && 'shadow-sm',
                                            )}
                                            onClick={() =>
                                              handleVoteClick(
                                                card.id,
                                                Boolean(card.hasVoted),
                                              )
                                            }
                                            disabled={
                                              voteMutation.isPending ||
                                              removeVoteMutation.isPending
                                            }
                                          >
                                            <ThumbsUp className="h-3 w-3" />
                                            {(card.voteCount ?? 0) > 0 && (
                                              <span className="font-semibold">
                                                {card.voteCount}
                                              </span>
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {card.hasVoted
                                            ? 'Remove vote'
                                            : 'Vote for this'}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}

                                    {/* Discussed badge */}
                                    {isDiscussed && (
                                      <Badge className="h-5 gap-1 text-[10px] bg-green-500/10 text-green-600 border-green-300 dark:border-green-800">
                                        <CheckCircle2 className="h-2.5 w-2.5" />
                                        Discussed
                                      </Badge>
                                    )}

                                    {/* Delete button (only for own cards in active phase) */}
                                    {retroStatus === 'active' && card.isOwn && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                          >
                                            <MoreVertical className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() =>
                                              deleteCardMutation.mutate(card.id)
                                            }
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </div>
                              </DraggableCard>
                            )
                          })}
                          {canShowPendingCards &&
                            pendingCards.map((card) => (
                              <div
                                key={card.id}
                                className="relative bg-background rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)] opacity-70"
                              >
                                <div className="px-3 py-2.5">
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {card.content}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between px-3 py-1.5 bg-linear-to-r from-muted/40 to-muted/20">
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    {card.author ? (
                                      <>
                                        <Avatar className="h-4 w-4 ring-1 ring-border">
                                          <AvatarImage
                                            src={card.author.image ?? undefined}
                                          />
                                          <AvatarFallback className="text-[8px]">
                                            {card.author.name?.charAt(0) ?? '?'}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-[11px]">
                                          {card.author.name}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="italic text-muted-foreground/70 text-[11px]">
                                        Anonymous
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Add Card Input (only in active phase) */}
                      {retroStatus === 'active' && (
                        <div className="shrink-0 border-t border-border/50 p-2 sm:p-4 bg-background/50 backdrop-blur-sm rounded-b-xl">
                          <Textarea
                            placeholder={`Share your "${column.name.toLowerCase()}"...`}
                            value={newCardContent[column.id] ?? ''}
                            onChange={(e) => {
                              setNewCardContent((prev) => ({
                                ...prev,
                                [column.id]: e.target.value,
                              }))
                              handleTypingStart()
                            }}
                            onBlur={handleTypingStop}
                            className="min-h-15 sm:min-h-20 resize-none border-border/50 bg-background/80 focus-visible:ring-primary/50 transition-all text-sm"
                            onKeyDown={(e) => {
                              const content = (
                                newCardContent[column.id] ?? ''
                              ).trim()
                              if (e.key === 'Enter' && !e.shiftKey && content) {
                                e.preventDefault()
                                handleTypingStop()
                                createCardMutation.mutate({
                                  columnId: column.id,
                                  content,
                                })
                              }
                            }}
                          />
                          <div className="flex items-center justify-between mt-2 sm:mt-3">
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:block">
                              Press Enter to submit
                            </p>
                            <Button
                              size="sm"
                              disabled={
                                !(newCardContent[column.id] ?? '').trim() ||
                                createCardMutation.isPending
                              }
                              onClick={() => {
                                const content = (
                                  newCardContent[column.id] ?? ''
                                ).trim()
                                if (content) {
                                  handleTypingStop()
                                  createCardMutation.mutate({
                                    columnId: column.id,
                                    content,
                                  })
                                }
                              }}
                              className="shadow-sm h-7 sm:h-8 text-xs sm:text-sm w-full sm:w-auto"
                            >
                              <Plus className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4" />
                              Add
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <DragOverlay>
                {draggingCardId && (
                  <div className="rounded-lg bg-background border-2 border-primary shadow-xl px-3 py-2.5 opacity-90 text-sm font-medium text-muted-foreground rotate-2">
                    {retroCards
                      .find((c) => c.id === draggingCardId)
                      ?.content.slice(0, 60) ?? 'Card'}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}

        {/* Discussion phase — full split-view replaces the card grid */}
        {retroStatus === 'discussing' && (
          <RetroDiscussionView
            retro={retro}
            previousCarriedItems={previousCarriedItems}
            canControl={canControl}
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

// ─── DraggableCard ────────────────────────────────────────────────────────────
// Wraps a card with dnd-kit draggable + droppable during the grouping phase.
const DraggableCard = memo(function DraggableCardComponent({
  id,
  columnId,
  enabled,
  className,
  children,
  onClick,
}: {
  id: string
  columnId: string
  enabled: boolean
  className?: string
  children: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({ id, data: { columnId }, disabled: !enabled })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    data: { columnId },
    disabled: !enabled,
  })

  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el)
    setDropRef(el)
  }

  return (
    <div
      ref={setRef}
      {...(enabled ? listeners : {})}
      {...(enabled ? attributes : {})}
      className={cn(
        className,
        isDragging && 'opacity-40',
        isOver && enabled && 'ring-2 ring-blue-400 ring-offset-1',
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
})
