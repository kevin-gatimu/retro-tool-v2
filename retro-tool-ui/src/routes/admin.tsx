import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Shield } from 'lucide-react'
import { useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { isSystemAdmin } from '@/lib/rbac'
import { AdminNav } from './admin/helpers'
import { Skeleton } from '@/components/ui/skeleton'

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
        <>
          {/* Skeleton nav — same height/layout as the real AdminNav */}
          <div className="flex flex-wrap items-center gap-1 border-b pb-2 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-md" />
            ))}
          </div>
          {/* Generic content skeleton */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border rounded-lg px-3 py-2.5">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-6 w-6 rounded-md" />
                    </div>
                    <Skeleton className="h-7 w-12" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="border rounded-lg p-6 space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="border rounded-lg p-6 space-y-3">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-40" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton
                      key={i}
                      className="h-8 w-8 rounded-full shrink-0"
                    />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
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
