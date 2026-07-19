import { useEffect, useRef } from 'react'
import { useConvexAuth, useQuery as useConvexQuery } from 'convex/react'
import { convexApi } from '@/lib/convex-api'
import { usesConvexForIcebreakers } from '@/lib/realtime-config'

const getSessionProjectionQueryRef =
  convexApi.liveIcebreakers.getSessionProjection

type ProjectionRow = { sessionId: string } | null

/**
 * Kicks the viewer out of a running icebreaker the moment it's deleted.
 *
 * Ending or finishing a session hard-deletes it (icebreakers are never
 * persisted), which removes its Convex projection. Every participant subscribes
 * here; once the projection has been seen to exist and then goes `null`, we
 * fire `onGone` exactly once so remote users leave cleanly instead of being
 * stranded on a dead session (the REST board subscription simply stops
 * updating and would otherwise never signal the deletion).
 */
export function useIcebreakerSessionGone(
  sessionId: string,
  onGone: () => void,
): void {
  const usesConvexRealtime = usesConvexForIcebreakers()
  const { isAuthenticated } = useConvexAuth()
  const convexReady = usesConvexRealtime && isAuthenticated

  const projection = useConvexQuery(
    getSessionProjectionQueryRef,
    convexReady ? { sessionId } : 'skip',
    // Safe: makeFunctionReference string refs are untyped against their return;
    // ProjectionRow matches getSessionProjection's server schema (we only read
    // presence/absence here).
  ) as ProjectionRow | undefined

  // Only treat null as "deleted" after we've confirmed the session existed —
  // otherwise a still-loading (undefined) or never-projected session would
  // eject the viewer immediately.
  const sawSessionRef = useRef(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (!convexReady) return
    if (projection) {
      sawSessionRef.current = true
      return
    }
    // projection === null (loaded, absent) after having seen it → deleted.
    if (projection === null && sawSessionRef.current && !firedRef.current) {
      firedRef.current = true
      onGone()
    }
  }, [convexReady, projection, onGone])
}
