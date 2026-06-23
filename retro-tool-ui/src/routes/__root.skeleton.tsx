import { Skeleton } from '@/components/ui/skeleton'

/** App-shell skeleton (sidebar + header + content) shown while the root resolves. */
export function AppSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="w-[--sidebar-width] bg-card border-r border-border p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
          <Skeleton className="h-8 w-8" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </header>
        <main className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </main>
      </div>
    </div>
  )
}
