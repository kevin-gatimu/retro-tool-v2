import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useQuery as useConvexQuery } from 'convex/react'
import type { FunctionReference } from 'convex/server'

interface RecentRetroProjection {
  retroId: string
  status:
    | 'draft'
    | 'waiting'
    | 'active'
    | 'grouping'
    | 'voting'
    | 'discussing'
    | 'completed'
  updatedAt: string
}

const recentRetroProjectionQuery =
  'liveRetros:listRecentRetroProjections' as unknown as FunctionReference<'query'>

export function RetroListConvexSync() {
  const queryClient = useQueryClient()
  const lastSnapshotRef = useRef<string | null>(null)
  const projections = useConvexQuery(recentRetroProjectionQuery, {}) as
    | RecentRetroProjection[]
    | undefined

  useEffect(() => {
    if (!projections) {
      return
    }

    const snapshot = JSON.stringify(
      projections.map((projection) => [
        projection.retroId,
        projection.status,
        projection.updatedAt,
      ]),
    )

    if (
      lastSnapshotRef.current !== null &&
      lastSnapshotRef.current !== snapshot
    ) {
      void queryClient.invalidateQueries({
        queryKey: ['retros'],
      })
    }

    lastSnapshotRef.current = snapshot
  }, [projections, queryClient])

  return null
}
