import { useMutation } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'

export function useSignUp({
  onSuccess,
}: {
  onSuccess: (isFirstUser: boolean) => void
}) {
  return useMutation({
    mutationFn: async ({
      name,
      email,
      password,
      adminExists,
    }: {
      name: string
      email: string
      password: string
      adminExists: boolean
    }) => {
      const result = await authClient.signUp.email({ name, email, password })
      if (result.error)
        throw new Error(result.error.message ?? 'Sign up failed')

      let isFirstUser = false
      if (!adminExists) {
        try {
          await api.post(USERS_ENDPOINTS.ADMIN_BOOTSTRAP)
          isFirstUser = true
        } catch {
          // ignore if admin already exists
        }
      }

      return { isFirstUser }
    },
    onSuccess: ({ isFirstUser }) => onSuccess(isFirstUser),
  })
}
