import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Shield } from 'lucide-react'
import { useEffect } from 'react'
import { AdminDashboardSkeleton } from '@/components/skeletons'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { isSystemAdmin } from '@/lib/rbac'
import { AdminNav } from './admin/helpers'

export const Route = createFileRoute('/admin')({
  pendingComponent: AdminDashboardSkeleton,
  component: AdminLayout,
})

function AdminLayout() {
  const navigate = useNavigate()
  const { data: user, isLoading } = useCurrentUser()

  useEffect(() => {
    if (!isLoading && user !== undefined) {
      if (!user) {
        navigate({ to: '/auth/sign-in' })
      } else if (!isSystemAdmin(user.role)) {
        navigate({ to: '/dashboard' })
      }
    }
  }, [user, isLoading, navigate])

  if (isLoading || !user || !isSystemAdmin(user.role)) {
    return <AdminDashboardSkeleton />
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-primary p-2">
          <Shield className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Manage users, retro templates, organizations, and organization
            setup.
          </p>
        </div>
      </div>

      <AdminNav />

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
