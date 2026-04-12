import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import { CURRENT_USER_QUERY_KEY } from '@/hooks/useCurrentUser'

export function useSignUp({
  onSuccess,
}: {
  onSuccess: (isFirstUser: boolean) => void
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      email,
      password,
    }: {
      name: string
      email: string
      password: string
    }) => {
      const result = await authClient.signUp.email({ name, email, password })
      if (result.error)
        throw new Error(result.error.message ?? 'Sign up failed')

      // Always attempt bootstrap — backend returns 400 if an admin already exists,
      // which we catch and treat as "not the first user".
      let isFirstUser = false
      try {
        await api.post(USERS_ENDPOINTS.ADMIN_BOOTSTRAP)
        // Invalidate stale user cache so role/status is fresh before navigating.
        await queryClient.invalidateQueries({
          queryKey: CURRENT_USER_QUERY_KEY,
        })
        isFirstUser = true
      } catch {
        // Admin already exists — normal pending sign-up.
      }

      return { isFirstUser }
    },
    onSuccess: ({ isFirstUser }) => onSuccess(isFirstUser),
  })
}
