import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { STANDUPS_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  CreateStandupInput,
  StandupDetail,
  SubmitStandupInput,
  UpdateStandupInput,
} from '@/common/types/standups'

export function useStandupMutations() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const createStandupMutation = useMutation({
    mutationFn: (data: CreateStandupInput) =>
      api.post<{ id: string }>(STANDUPS_ENDPOINTS.LIST, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['standups'] })
      navigate({
        to: '/standups/$standupId',
        params: { standupId: result.id },
      })
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to create standup'),
  })

  return { createStandupMutation }
}

export function useStandupEntryMutations(standupId: string, date: string) {
  const queryClient = useQueryClient()

  const refetchEntry = () => {
    void queryClient.refetchQueries({
      queryKey: ['standup-entry', standupId, date],
    })
  }

  const submitMutation = useMutation({
    mutationFn: (data: SubmitStandupInput) =>
      api.put<{ submissionId: string; entryId: string }>(
        STANDUPS_ENDPOINTS.SUBMISSION(standupId, date),
        data,
      ),
    onSuccess: () => {
      toast.success('Update submitted')
      refetchEntry()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to submit update'),
  })

  const deleteSubmissionMutation = useMutation({
    mutationFn: () =>
      api.delete<{ entryId: string }>(
        STANDUPS_ENDPOINTS.SUBMISSION(standupId, date),
      ),
    onSuccess: () => {
      toast.success('Your update was deleted')
      refetchEntry()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to delete update'),
  })

  const addCommentMutation = useMutation({
    mutationFn: ({
      submissionId,
      content,
    }: {
      submissionId: string
      content: string
    }) => api.post(STANDUPS_ENDPOINTS.COMMENTS(submissionId), { content }),
    onSuccess: refetchEntry,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to add comment'),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) =>
      api.delete(STANDUPS_ENDPOINTS.COMMENT_BY_ID(commentId)),
    onSuccess: refetchEntry,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to delete comment'),
  })

  const addReactionMutation = useMutation({
    mutationFn: ({
      submissionId,
      emoji,
    }: {
      submissionId: string
      emoji: string
    }) => api.post(STANDUPS_ENDPOINTS.REACTIONS(submissionId), { emoji }),
    onSuccess: refetchEntry,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to add reaction'),
  })

  const removeReactionMutation = useMutation({
    mutationFn: ({
      submissionId,
      emoji,
    }: {
      submissionId: string
      emoji: string
    }) => api.delete(STANDUPS_ENDPOINTS.REACTION_BY_EMOJI(submissionId, emoji)),
    onSuccess: refetchEntry,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to remove reaction'),
  })

  const updateStandupMutation = useMutation({
    mutationFn: (data: UpdateStandupInput) =>
      api.patch<{ id: string }>(STANDUPS_ENDPOINTS.BY_ID(standupId), data),
    onSuccess: () => {
      toast.success('Standup updated')
      void queryClient.invalidateQueries({ queryKey: ['standups'] })
      refetchEntry()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to update standup'),
  })

  const skipDayMutation = useMutation({
    mutationFn: (skip: boolean) =>
      skip
        ? api.post(STANDUPS_ENDPOINTS.SKIP_DAY(standupId, date))
        : api.delete(STANDUPS_ENDPOINTS.SKIP_DAY(standupId, date)),
    onSuccess: (_data, skip) => {
      toast.success(skip ? 'Day skipped' : 'Day restored')
      void queryClient.invalidateQueries({ queryKey: ['standups'] })
      void queryClient.invalidateQueries({ queryKey: ['standup-activity'] })
      refetchEntry()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to update skipped day'),
  })

  const deleteStandupMutation = useMutation({
    mutationFn: () => api.delete(STANDUPS_ENDPOINTS.BY_ID(standupId)),
    onSuccess: () => {
      toast.success('Standup deleted')
      void queryClient.invalidateQueries({ queryKey: ['standups'] })
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to delete standup'),
  })

  return {
    submitMutation,
    deleteSubmissionMutation,
    addCommentMutation,
    deleteCommentMutation,
    addReactionMutation,
    removeReactionMutation,
    updateStandupMutation,
    skipDayMutation,
    deleteStandupMutation,
  }
}

/**
 * Skip/unskip mutation that targets an arbitrary date (not bound to a single
 * viewed day), for the multi-day skip manager. Optimistically patches the
 * `['standup', standupId]` cache the calendar reads from so the toggle shows
 * instantly, then reconciles to authoritative server state via invalidation in
 * onSettled (no snapshot rollback, to avoid clobbering a concurrent toggle).
 */
export function useStandupSkipMutations(standupId: string) {
  const queryClient = useQueryClient()

  const setSkipMutation = useMutation({
    mutationFn: ({ date, skip }: { date: string; skip: boolean }) =>
      skip
        ? api.post(STANDUPS_ENDPOINTS.SKIP_DAY(standupId, date))
        : api.delete(STANDUPS_ENDPOINTS.SKIP_DAY(standupId, date)),
    onMutate: ({ date, skip }) => {
      // Optimistically patch just this one day into the standup detail the skip
      // manager reads from, so the calendar toggles instantly. We intentionally
      // patch a single-day delta (not a whole-snapshot) and do NOT snapshot-roll
      // back on error — onSettled reconciles to authoritative server state via
      // invalidation, which avoids clobbering a concurrent toggle of another day.
      const key = ['standup', standupId]
      queryClient.setQueryData<StandupDetail>(key, (previous) => {
        if (!previous) return previous
        const skippedDays = skip
          ? [...new Set([...previous.skippedDays, date])]
          : previous.skippedDays.filter((d) => d !== date)
        return { ...previous, skippedDays }
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update skipped day')
    },
    onSettled: (_data, _err, { date }) => {
      void queryClient.invalidateQueries({ queryKey: ['standups'] })
      void queryClient.invalidateQueries({ queryKey: ['standup-activity'] })
      // The skip manager reads its skipped-day list from ['standup', standupId];
      // refetch it so an open calendar reflects the toggle without a reload.
      void queryClient.invalidateQueries({
        queryKey: ['standup', standupId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['standup-entry', standupId, date],
      })
    },
  })

  return { setSkipMutation }
}
