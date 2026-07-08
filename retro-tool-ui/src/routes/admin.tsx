import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Shield } from 'lucide-react'
import { useEffect } from 'react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isSystemAdmin } from '@/lib/rbac'
import { AdminNav } from './admin/helpers'
import { AdminShellSkeleton } from './admin/skeleton'

export const Route = createFileRoute('/admin')({
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

  // Always render the full shell so the header/nav never flash in/out.
  // While auth is loading or pending redirect, show a skeleton in the content area only.
  const showSkeleton = isLoading || !user || !isSystemAdmin(user.role)

  return (
    <div className="container mx-auto py-6">
      {/* Header — always visible */}
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

      {showSkeleton ? (
        <AdminShellSkeleton />
      ) : (
        <>
          <AdminNav />
          <main>
            <Outlet />
          </main>
        </>
      )}
    </div>
  )
}
