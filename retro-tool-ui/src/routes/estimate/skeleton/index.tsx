import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

/**
 * Loading skeletons for the estimate route group. Each mirrors its page's
 * structure. The list skeleton is rendered from an in-component `isLoading`
 * branch (client-fetched via useSessionList); the others via `pendingComponent`
 * / in-component branch.
 */

export function NewEstimateSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-16 ml-2" />
            {i < 3 && <Skeleton className="h-0.5 w-16 mx-4" />}
          </div>
        ))}
      </div>
      <div className="min-h-100 space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-96" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((__, j) => (
                  <Skeleton key={j} className="h-6 w-10 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

/** List page (`/estimate`): header + space pills + toolbar + grouped card grid. */
export function EstimateListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header: title + Start Estimating button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-9 w-48" />
          </div>
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Space switcher pills */}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      {/* View config toolbar + search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
        <Skeleton className="h-8 w-56 rounded-md" />
      </div>

      {/* Grouped card grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-1/2" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Active session detail (`/estimate/$sessionId`): header, story card, point cards, participants. */
export function EstimateSessionDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header: back button + title/subtitle on the left, status on the right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      {/* Current Story card */}
      <Card>
        <CardHeader className="py-3 px-3">
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>

      {/* Select your estimate — heading + point cards */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="flex flex-wrap items-end gap-3 sm:gap-4">
          {Array.from({ length: 13 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-16 w-12 sm:h-20 sm:w-14 rounded-lg"
            />
          ))}
        </div>
      </div>

      {/* Participants & Votes card */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
