import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { SURVEYS_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  CreateSurveyInput,
  RespondSurveyInput,
  UpdateSurveyInput,
} from '@/common/types/surveys'

/**
 * Survey mutations shared by the /surveys list and the survey detail page.
 * `onChanged` lets each caller invalidate/refetch its own query keys.
 */
export function useSurveyMutations(onChanged: () => void) {
  const createSurveyMutation = useMutation({
    mutationFn: (data: CreateSurveyInput) =>
      api.post<{ id: string }>(SURVEYS_ENDPOINTS.LIST, data),
    onSuccess: () => {
      toast.success('Survey created')
      onChanged()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to create survey'),
  })

  const updateSurveyMutation = useMutation({
    mutationFn: ({
      surveyId,
      data,
    }: {
      surveyId: string
      data: UpdateSurveyInput
    }) => api.patch(SURVEYS_ENDPOINTS.BY_ID(surveyId), data),
    onSuccess: () => {
      toast.success('Survey updated')
      onChanged()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to update survey'),
  })

  const respondMutation = useMutation({
    mutationFn: ({
      surveyId,
      answers,
    }: {
      surveyId: string
      /** True when editing an existing response (affects the toast only). */
      isEdit?: boolean
    } & RespondSurveyInput) =>
      api.post(SURVEYS_ENDPOINTS.RESPOND(surveyId), { answers }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.isEdit ? 'Response updated' : 'Response submitted',
      )
      onChanged()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to submit response'),
  })

  const setClosedMutation = useMutation({
    mutationFn: ({
      surveyId,
      isClosed,
    }: {
      surveyId: string
      isClosed: boolean
    }) => api.patch(SURVEYS_ENDPOINTS.CLOSED(surveyId), { isClosed }),
    onSuccess: onChanged,
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to update survey'),
  })

  const deleteSurveyMutation = useMutation({
    mutationFn: (surveyId: string) =>
      api.delete(SURVEYS_ENDPOINTS.BY_ID(surveyId)),
    onSuccess: () => {
      toast.success('Survey deleted')
      onChanged()
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to delete survey'),
  })

  return {
    createSurveyMutation,
    updateSurveyMutation,
    respondMutation,
    setClosedMutation,
    deleteSurveyMutation,
  }
}
