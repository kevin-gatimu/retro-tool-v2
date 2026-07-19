import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ICEBREAKERS_ENDPOINTS } from '@/lib/api-endpoints'
import type { TIcebreakerPromptDecision } from '@/common/enums/icebreaker.enums'

/**
 * `onEnded` fires after the session is ended so the caller can leave the
 * runtime — standalone navigates to the list, the standup modal just closes.
 */
export function useSessionMutations(
  sessionId: string,
  options?: { onEnded?: () => void },
) {
  const queryClient = useQueryClient()

  const refetchSession = () => {
    void queryClient.refetchQueries({
      queryKey: ['icebreaker-session', sessionId],
    })
  }

  // The list page caches the active sessions (staleTime 30s), so any mutation
  // that ends/finishes a session must invalidate that key or it keeps showing
  // as active until a hard reload. Icebreakers are ephemeral — there is no
  // history list to invalidate.
  const invalidateSessionLists = () => {
    void queryClient.invalidateQueries({
      queryKey: ['active-icebreaker-sessions'],
    })
  }

  const swipePromptMutation = useMutation({
    mutationFn: (input: {
      decision: TIcebreakerPromptDecision
      sessionPromptId: string
    }) => api.post(ICEBREAKERS_ENDPOINTS.SWIPE(sessionId), input),
    onSuccess: () => {
      refetchSession()
    },
    onError: (error: Error) => {
      refetchSession()
      toast.error(error.message || 'Failed to decide prompt')
    },
  })

  const advancePromptMutation = useMutation({
    mutationFn: () =>
      api.post<{ ended: boolean }>(ICEBREAKERS_ENDPOINTS.ADVANCE(sessionId)),
    onSuccess: (result) => {
      invalidateSessionLists()
      // "Finish" (advance past the last prompt) deletes the session — leave the
      // runtime instead of refetching a now-missing session (which would 404).
      if (result.ended) {
        toast.success('Icebreaker finished')
        options?.onEnded?.()
        return
      }
      refetchSession()
    },
    onError: (error: Error) => {
      refetchSession()
      toast.error(error.message || 'Failed to advance')
    },
  })

  const endSessionMutation = useMutation({
    mutationFn: () => api.delete(ICEBREAKERS_ENDPOINTS.BY_ID(sessionId)),
    onSuccess: () => {
      toast.success('Icebreaker ended')
      invalidateSessionLists()
      void queryClient.invalidateQueries({
        queryKey: ['icebreaker-session', sessionId],
      })
      options?.onEnded?.()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to end session'),
  })

  return {
    swipePromptMutation,
    advancePromptMutation,
    endSessionMutation,
  }
}
