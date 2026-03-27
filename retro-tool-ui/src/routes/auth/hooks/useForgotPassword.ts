import { useMutation } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'

export function useForgotPassword({ onSuccess }: { onSuccess: () => void }) {
  return useMutation({
    mutationFn: (email: string) =>
      // @ts-expect-error - forgetPassword exists in better-auth but may not be typed depending on config
      authClient.forgetPassword({
        email,
        redirectTo: '/auth/reset-password',
      }),
    onSuccess,
  })
}
