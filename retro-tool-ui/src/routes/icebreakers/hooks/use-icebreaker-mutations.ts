import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ICEBREAKERS_ENDPOINTS } from '@/lib/api-endpoints'
import type { CreateIcebreakerSessionInput } from '@/common/types/icebreakers'

/**
 * By default, creating a session navigates straight to its runtime page. Pass
 * `onCreated` (e.g. from the standup room) to keep the user in place and handle
 * the new session id yourself instead.
 */
export function useIcebreakerMutations(options?: {
  onCreated?: (sessionId: string) => void
}) {
  const navigate = useNavigate()

  const createSessionMutation = useMutation({
    mutationFn: (data: CreateIcebreakerSessionInput) =>
      api.post<{ id: string }>(ICEBREAKERS_ENDPOINTS.LIST, data),
    onSuccess: (result) => {
      if (options?.onCreated) {
        options.onCreated(result.id)
        return
      }
      navigate({
        to: '/icebreakers/$sessionId',
        params: { sessionId: result.id },
      })
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to create icebreaker session'),
  })

  return { createSessionMutation }
}
