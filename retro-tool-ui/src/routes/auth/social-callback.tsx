import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import { signOutWithCleanup } from '@/lib/auth-client'
import { CURRENT_USER_QUERY_KEY } from '@/hooks/useCurrentUser'
import type { User } from '@/common/types/users'

export const Route = createFileRoute('/auth/social-callback')({
  component: SocialCallbackPage,
})

function SocialCallbackPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    async function checkApproval() {
      try {
        const user = await api.get<User>(USERS_ENDPOINTS.ME)

        // Attempt bootstrap — succeeds only if no admin exists yet (first user).
        // On success this user is now super-admin + approved; go straight to dashboard.
        try {
          await api.post(USERS_ENDPOINTS.ADMIN_BOOTSTRAP)
          // Invalidate stale user cache so role/status is fresh before navigating.
          await queryClient.invalidateQueries({
            queryKey: CURRENT_USER_QUERY_KEY,
          })
          navigate({ to: '/dashboard' })
          return
        } catch {
          // Admin already exists — fall through to normal status check.
        }

        if (user.status === 'pending') {
          await signOutWithCleanup()
          navigate({ to: '/auth/sign-in', search: { status: 'pending' } })
          return
        }

        if (user.status === 'rejected') {
          await signOutWithCleanup()
          navigate({ to: '/auth/sign-in', search: { status: 'rejected' } })
          return
        }

        navigate({ to: '/dashboard' })
      } catch {
        navigate({ to: '/auth/sign-in' })
      }
    }

    checkApproval()
  }, [navigate])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <Sparkles className="h-8 w-8 text-emerald-400 animate-spin" />
      <p className="text-gray-400 text-sm">Verifying your account...</p>
    </div>
  )
}
