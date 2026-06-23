import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeletons for the admin route group. Each mirrors the structure of
 * its page so the layout doesn't shift when real content loads. Colocated with
 * the routes that use them (imported via `pendingComponent` or an in-component
 * `isLoading` branch).
 */

/** Content-area skeleton for the admin shell (`admin.tsx`) while auth resolves. */
export function AdminShellSkeleton() {
  return (
    <>
      {/* Skeleton nav — same height/layout as the real AdminNav */}
      <div className="flex flex-wrap items-center gap-1 border-b pb-2 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>
      {/* Generic content skeleton (matches the dashboard, the default child) */}
      <AdminDashboardSkeleton />
    </>
  )
}

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats Grid - 6 compact cards, 2-col mobile, 3-col md+ */}
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

      {/* Quick Actions & Recent Activity - 2 columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-4 w-40" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminUsersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* Filter row: search + membership filter pills */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      {/* Users Table */}
      <div className="border rounded-lg">
        {/* Table header */}
        <div className="flex items-center gap-4 p-4 border-b bg-muted/50">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b last:border-0"
          >
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrganizationsListSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      {/* Header with title and button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>

      {/* Grid of organization cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            {/* Header with logo and role badge */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            {/* Member count */}
            <div className="flex items-center gap-2 pt-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminTemplatesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      {/* Table card */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ConvexAdminSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6" />
        <div className="space-y-1">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
      {/* Content cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrgSetupSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="hidden sm:block h-4 w-16" />
            {i < 5 && <Skeleton className="h-px w-4" />}
          </div>
        ))}
      </div>
      {/* Form card */}
      <div className="border rounded-lg p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

export function AdminTeamRolesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="border rounded-lg divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
