import { useMutation } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'

export function useResetPassword({ onSuccess }: { onSuccess: () => void }) {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authClient.resetPassword({ newPassword: password, token }),
    onSuccess,
  })
}
