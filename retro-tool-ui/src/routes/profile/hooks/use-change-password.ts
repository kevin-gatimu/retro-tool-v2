import { useMutation } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'

export function useChangePassword({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void
  onError?: (message: string) => void
} = {}) {
  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string
      newPassword: string
    }) => {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
      })
      if (result.error) {
        throw new Error(result.error.message || 'Failed to change password')
      }
    },
    onSuccess,
    onError: (err) => {
      onError?.(err.message || 'Failed to change password')
    },
  })
}
