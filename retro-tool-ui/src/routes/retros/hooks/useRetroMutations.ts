import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { RETROS_ENDPOINTS } from '@/lib/api-endpoints'
import type { RetroDetail } from '@/common/types/retros'
import type { TRetroStatus } from '@/common/enums/retro.enums'

export function useRetroMutations(retroId: string) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.refetchQueries({ queryKey: ['retro', retroId] })
  }

  const invalidateOnComplete = () => {
    invalidate()
    // Invalidate all stats and report queries so dashboard + reports reflect eventually
    void queryClient.invalidateQueries({ queryKey: ['retros'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    void queryClient.invalidateQueries({ queryKey: ['team-metrics'] })
    void queryClient.invalidateQueries({ queryKey: ['health-score'] })
    void queryClient.invalidateQueries({ queryKey: ['action-analytics'] })
  }

  // Helper to optimistically update status
  const updateStatus = (status: TRetroStatus) => {
    queryClient.setQueryData<RetroDetail>(['retro', retroId], (prev) =>
      prev ? { ...prev, status } : prev,
    )
  }

  const startLobbyMutation = useMutation({
    mutationFn: () =>
      api.post<{ success: boolean; autoStartsAt: string }>(
        RETROS_ENDPOINTS.LOBBY(retroId),
      ),
    onMutate: () => {
      // Instant optimistic update
      updateStatus('waiting')
    },
    onSuccess: () => {
      // Don't refetch - WebSocket retro-changed will handle it
    },
    onError: (error: Error) => {
      // Revert optimistic update
      invalidate()
      toast.error(error.message || 'Failed to start lobby')
    },
  })

  const startRetroMutation = useMutation({
    mutationFn: () => api.post(RETROS_ENDPOINTS.START(retroId)),
    onMutate: () => {
      // Instant optimistic update
      updateStatus('active')
    },
    onSuccess: () => {
      // Don't refetch - WebSocket retro-changed will handle it
    },
    onError: (error: Error) => {
      // Revert optimistic update
      invalidate()
      toast.error(error.message || 'Failed to start retro')
    },
  })

  const moveToVotingMutation = useMutation({
    mutationFn: () => api.post(RETROS_ENDPOINTS.VOTING(retroId)),
    onMutate: () => {
      // Instant optimistic update
      updateStatus('voting')
    },
    onSuccess: () => {
      // Don't refetch - WebSocket retro-changed will handle it
    },
    onError: (error: Error) => {
      // Revert optimistic update
      invalidate()
      toast.error(error.message || 'Failed to move to voting')
    },
  })

  const moveToGroupingMutation = useMutation({
    mutationFn: () => api.post(RETROS_ENDPOINTS.GROUPING(retroId)),
    onMutate: () => {
      // Instant optimistic update
      updateStatus('grouping')
    },
    onSuccess: () => {
      // Don't refetch - WebSocket retro-changed will handle it
    },
    onError: (error: Error) => {
      // Revert optimistic update
      invalidate()
      toast.error(error.message || 'Failed to move to grouping')
    },
  })

  const moveToDiscussionMutation = useMutation({
    mutationFn: () => api.post(RETROS_ENDPOINTS.DISCUSSION(retroId)),
    onMutate: () => {
      // Instant optimistic update
      updateStatus('discussing')
    },
    onSuccess: () => {
      // Don't refetch - WebSocket retro-changed will handle it
    },
    onError: (error: Error) => {
      // Revert optimistic update
      invalidate()
      toast.error(error.message || 'Failed to move to discussion')
    },
  })

  const completeRetroMutation = useMutation({
    mutationFn: () => api.post(RETROS_ENDPOINTS.COMPLETE(retroId)),
    onMutate: () => {
      // Instant optimistic update
      updateStatus('completed')
    },
    onSuccess: () => {
      // Update all related queries
      invalidateOnComplete()
    },
    onError: (error: Error) => {
      // Revert optimistic update
      invalidate()
      toast.error(error.message || 'Failed to complete retro')
    },
  })

  return {
    startLobbyMutation,
    startRetroMutation,
    moveToVotingMutation,
    moveToGroupingMutation,
    moveToDiscussionMutation,
    completeRetroMutation,
  }
}
