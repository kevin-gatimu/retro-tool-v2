import { useMutation } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'

export function useResetPassword({ onSuccess }: { onSuccess: () => void }) {
  return useMutation({
    mutationFn: async ({
      token,
      password,
    }: {
      token: string
      password: string
    }) => {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (error) throw new Error(error.message ?? 'Failed to reset password')
    },
    onSuccess,
  })
}
