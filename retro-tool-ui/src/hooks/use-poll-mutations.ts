import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { POLLS_ENDPOINTS } from '@/lib/api-endpoints'
import type { CreatePollInput } from '@/common/types/polls'

/**
 * Poll mutations shared by the standalone /polls page and the standup room.
 * `onChanged` lets each caller invalidate/refetch its own query keys.
 */
export function usePollMutations(onChanged: () => void) {
  const createPollMutation = useMutation({
    mutationFn: (data: CreatePollInput) =>
      api.post<{ id: string }>(POLLS_ENDPOINTS.LIST, data),
    onSuccess: () => {
      toast.success('Poll created')
      onChanged()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to create poll'),
  })

  const voteMutation = useMutation({
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) =>
      api.post(POLLS_ENDPOINTS.VOTE(pollId), { optionId }),
    onSuccess: onChanged,
    onError: (error: Error) => toast.error(error.message || 'Failed to vote'),
  })

  const retractVoteMutation = useMutation({
    mutationFn: (pollId: string) => api.delete(POLLS_ENDPOINTS.VOTE(pollId)),
    onSuccess: onChanged,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to retract vote'),
  })

  const setClosedMutation = useMutation({
    mutationFn: ({ pollId, isClosed }: { pollId: string; isClosed: boolean }) =>
      api.patch(POLLS_ENDPOINTS.CLOSED(pollId), { isClosed }),
    onSuccess: onChanged,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to update poll'),
  })

  const deletePollMutation = useMutation({
    mutationFn: (pollId: string) => api.delete(POLLS_ENDPOINTS.BY_ID(pollId)),
    onSuccess: () => {
      toast.success('Poll deleted')
      onChanged()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to delete poll'),
  })

  return {
    createPollMutation,
    voteMutation,
    retractVoteMutation,
    setClosedMutation,
    deletePollMutation,
  }
}
