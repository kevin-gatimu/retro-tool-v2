import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ICEBREAKERS_ENDPOINTS } from '@/lib/api-endpoints'
import type { TIcebreakerPromptDecision } from '@/common/enums/icebreaker.enums'
import { getIcebreakerSocket } from '@/lib/socket'
import { usesConvexForIcebreakers } from '@/lib/realtime-config'

export function useSessionMutations(sessionId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const usesConvexRealtime = usesConvexForIcebreakers()

  const refetchSession = () => {
    void queryClient.refetchQueries({
      queryKey: ['icebreaker-session', sessionId],
    })
  }

  const swipePromptMutation = useMutation({
    mutationFn: (input: {
      decision: TIcebreakerPromptDecision
      sessionPromptId: string
    }) => {
      const httpPromise = api.post(
        ICEBREAKERS_ENDPOINTS.SWIPE(sessionId),
        input,
      )
      if (!usesConvexRealtime) {
        getIcebreakerSocket().emit('swipe-prompt', { sessionId, ...input })
      }
      return httpPromise
    },
    onSuccess: () => {
      refetchSession()
    },
    onError: (error: Error) => {
      refetchSession()
      toast.error(error.message || 'Failed to decide prompt')
    },
  })

  const advancePromptMutation = useMutation({
    mutationFn: () => api.post(ICEBREAKERS_ENDPOINTS.ADVANCE(sessionId)),
    onSuccess: () => {
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
      navigate({ to: '/icebreakers' })
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
