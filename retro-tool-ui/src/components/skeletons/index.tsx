import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shared, generic skeleton primitives reused across multiple routes.
 *
 * Page-specific skeletons live next to their route, in a `skeleton/` folder
 * (route groups) or a `*.skeleton.tsx` sibling (single-file routes). Only keep
 * truly generic, multi-consumer building blocks here.
 */

/** Generic auth/detail placeholder: avatar + title + a single content block. */
export function DetailPageSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  )
}

/** Generic responsive grid of card placeholders. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
    </div>
  )
}

/** Generic vertical list of row placeholders. */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

/** Generic table placeholder with configurable rows/columns. */
export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="border rounded-lg">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b bg-muted/50">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border-b last:border-0"
        >
          {Array.from({ length: columns }).map((__, j) => (
            <Skeleton key={j} className="h-4 w-24" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Full-screen dark legal page placeholder (terms / privacy). */
export function LegalPageSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#0d1117' }}>
      {/* Sticky header */}
      <div className="h-14 border-b border-white/5 px-6 flex items-center justify-between">
        <Skeleton className="h-5 w-24 bg-white/10" />
        <Skeleton className="h-7 w-28 bg-white/10" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-16 bg-white/10" />
          <Skeleton className="h-4 w-20 bg-white/10" />
        </div>
      </div>
      {/* Title block */}
      <div className="px-6 py-12 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-6 w-24 rounded-full bg-white/10" />
        <Skeleton className="h-10 w-80 bg-white/10" />
        <Skeleton className="h-4 w-48 bg-white/10" />
        <Skeleton className="h-5 w-96 bg-white/10" />
      </div>
      {/* Two-column layout */}
      <div className="px-6 pb-16 max-w-4xl mx-auto grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Sidebar ToC */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg bg-white/5" />
          ))}
        </div>
        {/* Main content */}
        <div className="space-y-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-7 w-56 bg-white/10" />
              <Skeleton className="h-4 w-full bg-white/10" />
              <Skeleton className="h-4 w-full bg-white/10" />
              <Skeleton className="h-4 w-3/4 bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
