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
    }

    lastSnapshotRef.current = snapshot
  }, [projections, queryClient])

  return null
}
