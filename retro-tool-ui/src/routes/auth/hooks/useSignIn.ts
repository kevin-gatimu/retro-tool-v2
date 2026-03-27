import { useMutation } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import {
  authClient,
  testCookiesWorking,
  clearBearerToken,
  getBearerToken,
  detectPrivateWindow,
} from '@/lib/auth-client'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import { toast } from 'sonner'
import type { User } from '@/common/types/users'

export function useSignIn({
  onPendingApproval,
  onRejected,
  onSuspended,
  redirect,
}: {
  onPendingApproval: () => void
  onRejected: () => void
  onSuspended: () => void
  redirect?: string
}) {
  const navigate = useNavigate()
  const router = useRouter()

  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string
      password: string
    }) => {
      const result = await authClient.signIn.email({ email, password })
      if (result.error)
        throw new Error(result.error.message ?? 'Sign in failed')

      // Check if cookies are working after sign-in
      // Wait a tick for cookies to be set
      await new Promise((resolve) => setTimeout(resolve, 100))

      const cookiesWorking = testCookiesWorking()
      const hasBearerToken = !!getBearerToken()

      if (!cookiesWorking && hasBearerToken) {
        // Private window detected - using bearer token fallback
        // Only show toast if we can confirm this is actually a private/incognito window
        const isPrivateWindow = await detectPrivateWindow()
        if (isPrivateWindow) {
          toast.info(
            'Private browsing detected. Session will not persist after closing this window.',
            { duration: 5000 },
          )
        }
      } else if (cookiesWorking) {
        // Cookies work, no need for bearer token fallback
        clearBearerToken()
      }

      const user = await api.get<User>(USERS_ENDPOINTS.ME)

      if (user.status === 'pending') {
        await authClient.signOut()
        clearBearerToken()
        return { outcome: 'pending' } as const
      }

      if (user.status === 'rejected') {
        await authClient.signOut()
        clearBearerToken()
        return { outcome: 'rejected' } as const
      }

      if (user.status === 'suspended') {
        await authClient.signOut()
        clearBearerToken()
        return { outcome: 'suspended' } as const
      }

      return { outcome: 'success' } as const
    },
    onSuccess: async (data) => {
      if (data.outcome === 'pending') {
        onPendingApproval()
        return
      }
      if (data.outcome === 'rejected') {
        onRejected()
        return
      }
      if (data.outcome === 'suspended') {
        onSuspended()
        return
      }
      await router.invalidate()
      if (redirect) {
        window.location.href = redirect
      } else {
        navigate({ to: '/dashboard' })
      }
    },
  })
}
