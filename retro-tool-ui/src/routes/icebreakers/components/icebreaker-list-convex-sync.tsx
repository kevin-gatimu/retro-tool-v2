import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConvexAuth, useQuery as useConvexQuery } from 'convex/react'
import type { FunctionReference } from 'convex/server'

interface ActiveIcebreakerProjection {
  sessionId: string
  status: 'waiting' | 'curating' | 'presenting'
  updatedAt: string
}

const activeIcebreakerProjectionQuery =
  'liveIcebreakers:listActiveSessionProjections' as unknown as FunctionReference<'query'>

export function IcebreakerListConvexSync() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useConvexAuth()
  const lastSnapshotRef = useRef<string | null>(null)
  const projections = useConvexQuery(
    activeIcebreakerProjectionQuery,
    isAuthenticated ? {} : 'skip',
  ) as ActiveIcebreakerProjection[] | undefined

  useEffect(() => {
    if (!projections) {
      return
    }

    const snapshot = JSON.stringify(
      projections.map((projection) => [
        projection.sessionId,
        projection.status,
        projection.updatedAt,
      ]),
    )

    if (
      lastSnapshotRef.current !== null &&
      lastSnapshotRef.current !== snapshot
    ) {
      void queryClient.invalidateQueries({
        queryKey: ['active-icebreaker-sessions'],
      })
      void queryClient.invalidateQueries({ queryKey: ['icebreaker-history'] })
    } else if (lastSnapshotRef.current === null) {
      // First snapshot after (re)mount: the cached ongoing list may already be
      // stale (e.g. a session was ended on the detail page or by another
      // user), so reconcile against the cache instead of skipping.
      const cached = queryClient.getQueryData<{ id: string }[]>([
        'active-icebreaker-sessions',
      ])
      if (cached) {
        const cachedIds = cached
          .map((s) => s.id)
          .sort()
          .join(',')
        const liveIds = projections
          .map((p) => p.sessionId)
          .sort()
          .join(',')
        if (cachedIds !== liveIds) {
          void queryClient.invalidateQueries({
            queryKey: ['active-icebreaker-sessions'],
          })
          void queryClient.invalidateQueries({
            queryKey: ['icebreaker-history'],
          })
        }
      }
    }

    lastSnapshotRef.current = snapshot
  }, [projections, queryClient])

  return null
}
