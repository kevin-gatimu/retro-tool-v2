import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { OTP_ENDPOINTS } from '@/lib/api-endpoints'

/** Completes a password reset using the emailed OTP (server-driven). */
export function useResetPassword({ onSuccess }: { onSuccess: () => void }) {
  return useMutation({
    mutationFn: async ({
      email,
      otp,
      password,
    }: {
      email: string
      otp: string
      password: string
    }) => {
      await api.post(OTP_ENDPOINTS.RESET_PASSWORD, { email, otp, password })
    },
    onSuccess,
  })
}

/** Resends the password-reset OTP. */
export function useResendResetOtp() {
  return useMutation({
    mutationFn: async (email: string) => {
      await api.post(OTP_ENDPOINTS.RESET_PASSWORD_SEND, { email })
    },
  })
}
