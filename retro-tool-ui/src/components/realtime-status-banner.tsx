import { useEffect, useState } from 'react'
import { useConvexAuth } from 'convex/react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Delay before the degraded-mode banner appears, in ms. A normal fast Convex
 * reconnect (or the brief connect → token-ready window on mount) settles well
 * inside this window, so the banner only surfaces when the disconnected state
 * genuinely persists — it must not flicker on every transient blip.
 */
const DEGRADED_BANNER_DELAY_MS = 2_500

/**
 * Inner banner: only mounted when the feature is in Convex realtime mode, which
 * guarantees the Convex client (and thus the `ConvexProviderWithAuth` context)
 * exists — so calling `useConvexAuth()` here is always safe. `isAuthenticated`
 * is false while the socket is connecting or if JWT auth has failed; in either
 * case live updates are not flowing and the board is relying on the slow REST
 * backstop poll, which the user should know about.
 */
function ConvexConnectionBanner() {
  const { isAuthenticated } = useConvexAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      // Reconnected — hide immediately, no debounce, so recovery feels instant.
      setShow(false)
      return
    }
    // Disconnected — only reveal the banner if the state persists past the
    // debounce window, so a quick reconnect never flashes it.
    const timer = setTimeout(() => setShow(true), DEGRADED_BANNER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isAuthenticated])

  if (!show) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 rounded-lg border border-amber-500/30',
        'bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400',
      )}
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      <span>Live updates paused — reconnecting. Changes may be delayed.</span>
    </div>
  )
}

/**
 * Degraded-mode indicator for Convex-backed realtime boards. Shows an
 * unobtrusive "reconnecting" banner when the app is in Convex realtime mode but
 * live updates are not currently flowing (Convex socket down or JWT auth
 * failed). Renders nothing in Socket.IO mode, which has its own connection
 * model, and nothing while Convex is healthy.
 *
 * Pass `active` = whether this feature uses Convex realtime
 * (`usesConvexForRetros()` / `usesConvexForEstimates()`). The Convex-auth hook
 * only runs when `active` is true, so this is safe to render even when no Convex
 * provider is mounted (pure Socket.IO deployments).
 */
export function RealtimeStatusBanner({ active }: { active: boolean }) {
  if (!active) return null
  return <ConvexConnectionBanner />
}
