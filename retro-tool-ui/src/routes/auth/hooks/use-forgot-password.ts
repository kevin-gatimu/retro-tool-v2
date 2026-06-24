import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { OTP_ENDPOINTS } from '@/lib/api-endpoints'

/**
 * Sends a password-reset OTP via our server-driven endpoint. On success the
 * caller routes the user to the reset-password screen carrying the email, where
 * they enter the code + a new password.
 */
export function useForgotPassword({
  onSuccess,
}: {
  onSuccess: (email: string) => void
}) {
  return useMutation({
    mutationFn: async (email: string) => {
      await api.post(OTP_ENDPOINTS.RESET_PASSWORD_SEND, { email })
      return email
    },
    onSuccess,
  })
}
