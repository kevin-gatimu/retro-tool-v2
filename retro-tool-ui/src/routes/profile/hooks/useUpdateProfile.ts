import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import { CURRENT_USER_QUERY_KEY } from '@/hooks/useCurrentUser'

export function useUpdateProfile({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void
  onError?: (message: string) => void
} = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      await api.patch(USERS_ENDPOINTS.ME, { name })
      await authClient.updateUser({ name })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: CURRENT_USER_QUERY_KEY,
          type: 'active',
        }),
        queryClient.refetchQueries({
          queryKey: ['sidebar-user'],
          type: 'active',
        }),
      ])
      onSuccess?.()
    },
    onError: (err) => {
      onError?.(err.message || 'Failed to update profile')
    },
  })
}
