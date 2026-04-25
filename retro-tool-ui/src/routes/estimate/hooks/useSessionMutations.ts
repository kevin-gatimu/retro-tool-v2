import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ESTIMATES_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  EstimateRoundInput,
  EstimateSession,
} from '@/common/types/estimates'
import { getEstimateSocket } from '@/lib/socket'
import { usesConvexForEstimates } from '@/lib/realtime-config'

export function useSessionMutations(sessionId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const usesConvexRealtime = usesConvexForEstimates()

  const refetchSession = () => {
    void queryClient.refetchQueries({
      queryKey: ['estimate-session', sessionId],
    })
  }

  const invalidate = () => {
    if (usesConvexRealtime) {
      return
    }
    refetchSession()
  }

  const castVoteMutation = useMutation({
    mutationFn: async (points: string) => {
      // Hybrid approach: HTTP for persistence + WebSocket for instant broadcast
      const httpPromise = api.post(ESTIMATES_ENDPOINTS.VOTES(sessionId), {
        points,
      })
      // Emit via WebSocket only when Socket.IO is still the active realtime backend.
      if (!usesConvexRealtime) {
        getEstimateSocket().emit('cast-vote', { sessionId, points })
      }
      // Wait for HTTP to ensure persistence
      return httpPromise
    },
    onMutate: (points: string) => {
      // Broad optimistic update: reflect the vote in both userVote and the votes
      // array so the Participants panel reacts immediately and survives a stale
      // Convex snapshot that only clears userVote but not the derived votes list.
      queryClient.setQueryData<EstimateSession>(
        ['estimate-session', sessionId],
        (prev) => {
          if (!prev) return prev
          const participant = prev.participants.find(
            (p) => p.userId === prev.currentUserId,
          )
          const optimisticVote = {
            id: 'optimistic-vote',
            voterId: prev.currentUserId,
            userId: prev.currentUserId,
            points,
            value: points,
            user: {
              id: prev.currentUserId,
              name: participant?.user.name ?? '',
              jobRole: participant?.user.jobRole ?? null,
            },
          }
          const existingIdx = prev.votes.findIndex(
            (v) => v.voterId === prev.currentUserId,
          )
          const newVotes =
            existingIdx >= 0
              ? prev.votes.map((v, i) =>
                  i === existingIdx ? optimisticVote : v,
                )
              : [...prev.votes, optimisticVote]
          return { ...prev, userVote: points, votes: newVotes }
        },
      )
    },
    onSuccess: () => {
      // Don't refetch - WebSocket session-changed will handle it
      // HTTP guarantees persistence, WebSocket gives instant broadcast
    },
    onError: (error: Error) => {
      // Revert optimistic update on error
      refetchSession()
      toast.error(error.message || 'Failed to cast vote')
    },
  })

  const removeVoteMutation = useMutation({
    mutationFn: () => api.delete(ESTIMATES_ENDPOINTS.VOTES(sessionId)),
    onMutate: () => {
      queryClient.setQueryData<EstimateSession>(
        ['estimate-session', sessionId],
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            userVote: null,
            votes: prev.votes.filter((v) => v.voterId !== prev.currentUserId),
          }
        },
      )
    },
    onSuccess: () => {
      // Don't refetch - WebSocket session-changed will handle it
    },
    onError: (error: Error) => {
      // Revert optimistic update on error
      refetchSession()
      toast.error(error.message || 'Failed to remove vote')
    },
  })

  const revealVotesMutation = useMutation({
    mutationFn: () => api.post(ESTIMATES_ENDPOINTS.REVEAL(sessionId)),
    onSuccess: () => {
      invalidate()
      toast.success('Votes revealed')
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to reveal votes'),
  })

  const startRoundMutation = useMutation({
    mutationFn: (payload: EstimateRoundInput) =>
      api.post(ESTIMATES_ENDPOINTS.START_ROUND(sessionId), payload),
    onSuccess: () => {
      refetchSession()
      toast.success('New round started')
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to start round'),
  })

  const startTimerMutation = useMutation({
    mutationFn: (seconds: number) =>
      api.post(ESTIMATES_ENDPOINTS.TIMER(sessionId), { duration: seconds }),
    onMutate: (seconds: number) => {
      // Optimistic update so the creator sees the countdown start immediately
      queryClient.setQueryData<EstimateSession>(
        ['estimate-session', sessionId],
        (prev) =>
          prev
            ? {
                ...prev,
                timerDuration: seconds,
                timerEndsAt: new Date(Date.now() + seconds * 1000),
              }
            : prev,
      )
    },
    onSuccess: (_, seconds) => {
      // Always refetch to get the accurate server-side timerEndsAt (bypasses Convex lag)
      refetchSession()
      toast.success(`Timer started — ${seconds / 60} min`)
    },
    onError: (error: Error) => {
      refetchSession()
      toast.error(error.message || 'Failed to start timer')
    },
  })

  const endSessionMutation = useMutation({
    mutationFn: () => api.delete(ESTIMATES_ENDPOINTS.BY_ID(sessionId)),
    onSuccess: () => {
      toast.success('Session ended')
      navigate({ to: '/estimate' })
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to end session'),
  })

  const setConsensusMutation = useMutation({
    mutationFn: (agreedPoints: string) =>
      api.patch(ESTIMATES_ENDPOINTS.CONSENSUS(sessionId), { agreedPoints }),
    onSuccess: () => {
      refetchSession()
      toast.success('Consensus saved')
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to save consensus'),
  })

  const revoteMutation = useMutation({
    mutationFn: () => api.post(ESTIMATES_ENDPOINTS.REVOTE(sessionId)),
    onSuccess: () => {
      refetchSession()
      toast.success('Revote started')
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to start revote'),
  })

  return {
    castVoteMutation,
    removeVoteMutation,
    revealVotesMutation,
    startRoundMutation,
    startTimerMutation,
    endSessionMutation,
    setConsensusMutation,
    revoteMutation,
  }
}
