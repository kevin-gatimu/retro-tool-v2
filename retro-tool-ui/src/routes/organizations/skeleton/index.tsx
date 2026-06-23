import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeletons for the organizations route group. The list skeleton is
 * rendered from an in-component `isLoading` branch (client `useQuery`); the
 * detail skeleton is wired via `pendingComponent`.
 */

export function OrganizationsListSkeleton() {
  return (
    <div className="container py-8 space-y-6">
      {/* Header with title and New button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>

      {/* Search */}
      <Skeleton className="h-10 w-full max-w-sm" />

      {/* Grid of organization cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
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

export function OrgDetailSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      {/* Back link */}
      <Skeleton className="h-5 w-40" />

      {/* Header with logo, name, and menu */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-10 w-10" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-20 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>

      {/* Teams tab content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-10 w-28" />
        </div>

        {/* Teams grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
