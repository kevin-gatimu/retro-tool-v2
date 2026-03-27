import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'

import { api } from '@/lib/api'
import { USERS_ENDPOINTS } from '@/lib/api-endpoints'
import { signOutWithCleanup } from '@/lib/auth-client'
import type { User } from '@/common/types/users'

export const Route = createFileRoute('/auth/social-callback')({
  component: SocialCallbackPage,
})

function SocialCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    async function checkApproval() {
      try {
        const user = await api.get<User>(USERS_ENDPOINTS.ME)

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
