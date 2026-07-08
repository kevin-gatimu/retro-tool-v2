import { Skeleton } from '@/components/ui/skeleton'

/** Loading skeleton for the public landing page (`/`), via `pendingComponent`. */
export function LandingPageSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#050d14' }}>
      {/* Navbar */}
      <div className="h-16 border-b border-white/5 px-6 flex items-center justify-between">
        <Skeleton className="h-7 w-32 bg-white/10" />
        <div className="flex gap-3">
          <Skeleton className="h-8 w-16 bg-white/10" />
          <Skeleton className="h-8 w-20 bg-white/10" />
        </div>
      </div>
      {/* Hero */}
      <div className="flex flex-col items-center gap-6 px-6 pt-24 pb-16 text-center">
        <Skeleton className="h-6 w-48 rounded-full bg-white/10" />
        <Skeleton className="h-12 w-[520px] max-w-full bg-white/10" />
        <Skeleton className="h-12 w-[420px] max-w-full bg-white/10" />
        <Skeleton className="h-5 w-96 max-w-full bg-white/10" />
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-11 w-36 rounded-md bg-white/10" />
          <Skeleton className="h-11 w-32 rounded-md bg-white/10" />
        </div>
        <Skeleton className="mt-8 h-64 w-full max-w-3xl rounded-xl bg-white/5" />
      </div>
      {/* Stats bar */}
      <div className="flex justify-around px-6 py-8 border-y border-white/5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-8 w-24 bg-white/10" />
            <Skeleton className="h-4 w-32 bg-white/10" />
          </div>
        ))}
      </div>
      {/* Features grid */}
      <div className="px-6 py-16 space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-8 w-48 bg-white/10" />
          <Skeleton className="h-5 w-80 bg-white/10" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/5 p-6 space-y-3"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
              <Skeleton className="h-5 w-32 bg-white/10" />
              <Skeleton className="h-4 w-full bg-white/10" />
              <Skeleton className="h-4 w-3/4 bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
