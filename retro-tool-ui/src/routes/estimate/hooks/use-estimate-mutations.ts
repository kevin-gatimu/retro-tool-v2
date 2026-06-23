import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ESTIMATES_ENDPOINTS } from '@/lib/api-endpoints'
import type { CreateSessionInput } from '@/common/types/estimates'

export function useEstimateMutations() {
  const navigate = useNavigate()

  const createSessionMutation = useMutation({
    mutationFn: (data: CreateSessionInput) =>
      api.post<{ id: string }>(ESTIMATES_ENDPOINTS.LIST, data),
    onSuccess: (result) => {
      navigate({ to: '/estimate/$sessionId', params: { sessionId: result.id } })
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to create estimate session'),
  })

  return { createSessionMutation }
}
