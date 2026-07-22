import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ACTION_ITEMS_ENDPOINTS, RETROS_ENDPOINTS } from '@/lib/api-endpoints'
import { ACTION_ITEM_STATUSES } from '@/common/enums/action-item.enums'
import type { RetroDetail } from '@/common/types/retros'
import type { TRetroStatus } from '@/common/enums/retro.enums'
import type { User } from '@/common/types/users'
import type { CarriedForwardItem } from '../types'

interface UseCarriedForwardOptions {
  retroId: string
  retroStatus: TRetroStatus | undefined
  usesConvexRealtime: boolean
  currentUser: User | null | undefined
  markConvexBoardSnapshotFloor: () => void
  invalidateRetroDetail: () => void
  invalidatePreviousCarried: () => void
}

/**
 * Carried-forward action items from the previous retro (shown in the
 * discussion phase): the query plus the four item mutations
 * (comment / mark-discussing / mark-done / carry-forward-again) and the small
 * pieces of UI state they drive. The route threads these to the discussion view.
 */
export function useCarriedForward({
  retroId,
  retroStatus,
  usesConvexRealtime,
  currentUser,
  markConvexBoardSnapshotFloor,
  invalidateRetroDetail,
  invalidatePreviousCarried,
}: UseCarriedForwardOptions) {
  const queryClient = useQueryClient()

  const [pendingCarriedDiscussItemId, setPendingCarriedDiscussItemId] =
    useState<string | null>(null)
  const [pendingCarriedDoneItemId, setPendingCarriedDoneItemId] = useState<
    string | null
  >(null)
  const [newCarriedItemComments, setNewCarriedItemComments] = useState<
    Partial<Record<string, string>>
  >({})

  const isDiscussingOrCompleted =
    retroStatus === 'discussing' || retroStatus === 'completed'

  const { data: previousCarriedItems = [] } = useQuery({
    queryKey: ['retro-previous-carried', retroId],
    queryFn: () =>
      api.get<CarriedForwardItem[]>(
        RETROS_ENDPOINTS.PREVIOUS_CARRIED_FORWARD(retroId),
      ),
    enabled: isDiscussingOrCompleted,
    staleTime: usesConvexRealtime ? 60_000 : 0,
    refetchInterval:
      !usesConvexRealtime && isDiscussingOrCompleted ? 3000 : false,
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

  return {
    previousCarriedItems,
    pendingCarriedDiscussItemId,
    pendingCarriedDoneItemId,
    newCarriedItemComments,
    setNewCarriedItemComments,
    createCarriedItemCommentMutation,
    markCarriedItemDiscussingMutation,
    markCarriedItemDoneMutation,
    carryItemForwardMutation,
  }
}
