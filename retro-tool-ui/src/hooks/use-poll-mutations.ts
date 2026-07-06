import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { POLLS_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  CreatePollInput,
  PollView,
  UpdatePollInput,
} from '@/common/types/polls'

/**
 * Optimistically apply a vote (or vote change) to a poll so the bars move the
 * instant the user clicks. Reconciled against the server on settle.
 */
function optimisticVote(poll: PollView, optionId: string): PollView {
  const userId = poll.currentUserId
  const existingName =
    poll.options.flatMap((o) => o.voters).find((v) => v.userId === userId)
      ?.name ?? 'You'

  const options = poll.options.map((option) => {
    const wasOwn = option.isOwnVote
    const willBeOwn = option.id === optionId
    if (wasOwn === willBeOwn) return option

    let { voteCount, voters } = option
    if (wasOwn && !willBeOwn) {
      voteCount = Math.max(0, voteCount - 1)
      voters = poll.isAnonymous
        ? voters
        : voters.filter((v) => v.userId !== userId)
    } else if (!wasOwn && willBeOwn) {
      voteCount += 1
      voters =
        poll.isAnonymous || voters.some((v) => v.userId === userId)
          ? voters
          : [...voters, { userId, name: existingName, image: null }]
    }
    return { ...option, isOwnVote: willBeOwn, voteCount, voters }
  })

  return {
    ...poll,
    options,
    totalVotes: poll.hasVoted ? poll.totalVotes : poll.totalVotes + 1,
    hasVoted: true,
  }
}

/** Optimistically remove the current user's vote. */
function optimisticRetract(poll: PollView): PollView {
  if (!poll.hasVoted) return poll
  const userId = poll.currentUserId
  const options = poll.options.map((option) =>
    option.isOwnVote
      ? {
          ...option,
          isOwnVote: false,
          voteCount: Math.max(0, option.voteCount - 1),
          voters: poll.isAnonymous
            ? option.voters
            : option.voters.filter((v) => v.userId !== userId),
        }
      : option,
  )
  return {
    ...poll,
    options,
    totalVotes: Math.max(0, poll.totalVotes - 1),
    hasVoted: false,
  }
}

/**
 * Patches a single poll inside a caller-owned query cache and returns a
 * rollback. Each page provides this because the polls list and the standup
 * room store polls under different shapes.
 */
type PatchPoll = (
  pollId: string,
  updater: (poll: PollView) => PollView,
) => () => void

/**
 * Poll mutations shared by the standalone /polls page and the standup room.
 * `onChanged` lets each caller invalidate/refetch its own query keys.
 * `patchPoll`, when provided, enables optimistic vote/retract updates.
 */
export function usePollMutations(onChanged: () => void, patchPoll?: PatchPoll) {
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

  const updatePollMutation = useMutation({
    mutationFn: ({ pollId, data }: { pollId: string; data: UpdatePollInput }) =>
      api.patch(POLLS_ENDPOINTS.BY_ID(pollId), data),
    onSuccess: () => {
      toast.success('Poll updated')
      onChanged()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to update poll'),
  })

  const voteMutation = useMutation({
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) =>
      api.post(POLLS_ENDPOINTS.VOTE(pollId), { optionId }),
    onMutate: ({ pollId, optionId }) => {
      const rollback = patchPoll?.(pollId, (poll) =>
        optimisticVote(poll, optionId),
      )
      return { rollback }
    },
    onError: (error: Error, _vars, context) => {
      context?.rollback?.()
      toast.error(error.message || 'Failed to vote')
    },
    onSettled: onChanged,
  })

  const retractVoteMutation = useMutation({
    mutationFn: (pollId: string) => api.delete(POLLS_ENDPOINTS.VOTE(pollId)),
    onMutate: (pollId) => {
      const rollback = patchPoll?.(pollId, optimisticRetract)
      return { rollback }
    },
    onError: (error: Error, _vars, context) => {
      context?.rollback?.()
      toast.error(error.message || 'Failed to retract vote')
    },
    onSettled: onChanged,
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
    updatePollMutation,
    voteMutation,
    retractVoteMutation,
    setClosedMutation,
    deletePollMutation,
  }
}
