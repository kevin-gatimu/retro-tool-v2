import { Skeleton } from '@/components/ui/skeleton'

type ReportSkeletonVariant = 'me' | 'team' | 'org' | 'system'

interface ReportsSkeletonProps {
  /** which dashboard is loading — controls card count and chart layout */
  variant?: ReportSkeletonVariant
}

/** Switcher pills + title/description + period select — mirrors ReportPageHeader. */
function HeaderSkeleton({ scopePicker }: { scopePicker?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64 rounded-md" />
        {scopePicker ? <Skeleton className="h-9 w-56 rounded-md" /> : null}
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>
      </div>
    </div>
  )
}

function StatCards({ count, columns }: { count: number; columns: string }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${columns}`}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  )
}

function ChartGrid({ count }: { count: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-85 w-full" />
      ))}
    </div>
  )
}

/**
 * Route pending fallback for the reports dashboards. Renders a layout matching
 * the resolved page (stat-card count + chart grid) and keeps the switcher row
 * visible so it doesn't vanish while navigating between report types.
 */
export function ReportsSkeleton({ variant = 'me' }: ReportsSkeletonProps) {
  if (variant === 'team') {
    return (
      <div className="space-y-6">
        <HeaderSkeleton scopePicker />
        <StatCards count={4} columns="lg:grid-cols-4" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-75 w-full" />
          <Skeleton className="h-75 w-full lg:col-span-2" />
        </div>
        <ChartGrid count={4} />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (variant === 'org') {
    return (
      <div className="space-y-6">
        <HeaderSkeleton scopePicker />
        <StatCards count={4} columns="lg:grid-cols-4" />
        <ChartGrid count={2} />
        <Skeleton className="h-75 w-full" />
        <Skeleton className="h-90 w-full" />
        <Skeleton className="h-35 w-full" />
      </div>
    )
  }

  if (variant === 'system') {
    return (
      <div className="space-y-6">
        <HeaderSkeleton />
        <StatCards count={6} columns="lg:grid-cols-6" />
        <ChartGrid count={2} />
        <Skeleton className="h-90 w-full" />
        <Skeleton className="h-90 w-full" />
      </div>
    )
  }

  // 'me' — 3 stat cards + 2×2 chart grid
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <StatCards count={3} columns="lg:grid-cols-3" />
      <ChartGrid count={4} />
    </div>
  )
}
