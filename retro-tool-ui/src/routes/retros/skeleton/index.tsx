import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeletons for the retros route group. Each mirrors its page's
 * structure and is wired via `pendingComponent`.
 */

export function RetrosListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function NewRetroSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
      </div>
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-16 ml-2" />
            {i < 3 && <Skeleton className="h-0.5 w-16 mx-4" />}
          </div>
        ))}
      </div>
      {/* Step Content */}
      <div className="min-h-[400px] space-y-4">
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
                {Array.from({ length: 3 }).map((__, j) => (
                  <Skeleton key={j} className="h-6 w-20 rounded-md" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

/**
 * Fallback for the lazy-loaded retro board (`components/retro-board.tsx`).
 * Mirrors the column grid so the layout doesn't shift while dnd-kit loads.
 */
export function RetroBoardSkeleton() {
  return (
    <div className="grid gap-3 sm:gap-4 pb-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-xl border-2 p-3 sm:p-4 space-y-4 min-h-0 max-h-[28rem] sm:max-h-[32rem] lg:h-[calc(100vh-17rem)] lg:max-h-none"
        >
          {/* Column Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 sm:h-5 w-24" />
                <Skeleton className="h-4 w-8 rounded-full" />
              </div>
              <Skeleton className="h-3 w-32 hidden sm:block" />
            </div>
          </div>

          {/* Cards List */}
          <div className="flex-1 space-y-2 sm:space-y-3 overflow-hidden">
            {Array.from({ length: 4 }).map((__, j) => (
              <div key={j} className="bg-muted/50 rounded-lg p-3 space-y-3">
                <Skeleton className="h-16 w-full" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-12 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function RetroDetailSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col space-y-3 sm:space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-background via-muted/30 to-background rounded-xl p-3 sm:p-4 border">
        <div className="flex items-center gap-2 sm:gap-4">
          <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-md" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 sm:h-8 w-48" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 sm:h-4 w-40" />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
          {/* Settings badges */}
          <div className="hidden sm:flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {/* Timer */}
          <Skeleton className="h-8 w-24 rounded-lg" />
          {/* Action button */}
          <Skeleton className="h-8 sm:h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Columns Grid - Responsive */}
      <div className="grid flex-1 gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-xl border-2 p-3 sm:p-4 space-y-4 min-h-0"
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 sm:h-5 w-24" />
                  <Skeleton className="h-4 w-8 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32 hidden sm:block" />
              </div>
            </div>

            {/* Cards List */}
            <div className="flex-1 space-y-2 sm:space-y-3 overflow-hidden">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="bg-muted/50 rounded-lg p-3 space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-6 w-12 rounded-md" />
                  </div>
                </div>
              ))}
            </div>

            {/* Add Card Input */}
            <div className="border-t pt-3 space-y-2">
              <Skeleton className="h-20 w-full rounded-md" />
              <div className="flex justify-end">
                <Skeleton className="h-7 sm:h-8 w-20 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
