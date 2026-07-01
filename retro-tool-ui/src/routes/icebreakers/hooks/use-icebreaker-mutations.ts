import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ICEBREAKERS_ENDPOINTS } from '@/lib/api-endpoints'
import type { CreateIcebreakerSessionInput } from '@/common/types/icebreakers'

export function useIcebreakerMutations() {
  const navigate = useNavigate()

  const createSessionMutation = useMutation({
    mutationFn: (data: CreateIcebreakerSessionInput) =>
      api.post<{ id: string }>(ICEBREAKERS_ENDPOINTS.LIST, data),
    onSuccess: (result) => {
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
