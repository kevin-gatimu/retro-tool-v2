import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Dispatch, SetStateAction } from 'react'
import { api } from '@/lib/api'
import { RETROS_ENDPOINTS } from '@/lib/api-endpoints'
import type { RetroDetail } from '@/common/types/retros'
import type { TRetroStatus } from '@/common/enums/retro.enums'
import type { User } from '@/common/types/users'
import type { LocalPendingCards } from '../types'

interface UseRetroCardMutationsOptions {
  retroId: string
  /** Latest retro status — read inside merge/unmerge guards. */
  retroStatus: TRetroStatus | undefined
  currentUser: User | null | undefined
  currentUserJobRole: string | null
  setLocalPendingCards: Dispatch<SetStateAction<LocalPendingCards>>
  setNewCardContent: Dispatch<SetStateAction<Partial<Record<string, string>>>>
  setScrollToColumn: Dispatch<SetStateAction<string | null>>
  setSelectedCardIds: Dispatch<SetStateAction<Record<string, boolean>>>
  markConvexBoardSnapshotFloor: () => void
  invalidateRetroDetail: () => void
  /** Called after a successful retro deletion (route wires navigation). */
  onRetroDeleted: () => void
}

/**
 * All card-scoped mutations for the retro board: create, delete, merge,
 * unmerge, vote, discuss, comment, and delete-retro. The route owns the board
 * state and passes the setters in; presentational children receive the
 * returned `{ mutate, isPending }` mutation objects via props.
 */
export function useRetroCardMutations({
  retroId,
  retroStatus,
  currentUser,
  currentUserJobRole,
  setLocalPendingCards,
  setNewCardContent,
  setScrollToColumn,
  setSelectedCardIds,
  markConvexBoardSnapshotFloor,
  invalidateRetroDetail,
  onRetroDeleted,
}: UseRetroCardMutationsOptions) {
  const queryClient = useQueryClient()

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
      if (retroStatus !== 'grouping') {
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
      if (retroStatus !== 'grouping') {
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
      onRetroDeleted()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete retro'),
  })

  return {
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
  }
}
