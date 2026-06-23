import { useMutation } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'

export function useForgotPassword({
  onSuccess,
}: {
  onSuccess: (message: string) => void
}) {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error)
        throw new Error(error.message ?? 'Failed to request password reset')
      return (
        data.message ||
        'If this email exists in our system, check your email for the reset link'
      )
    },
    onSuccess,
  })
}
