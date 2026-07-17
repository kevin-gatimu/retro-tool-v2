import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConvexAuth, useQuery as useConvexQuery } from 'convex/react'
import { convexApi } from '@/lib/convex-api'

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
  convexApi.liveRetros.listRecentRetroProjections

export function RetroListConvexSync() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useConvexAuth()
  const lastSnapshotRef = useRef<string | null>(null)
  const projections = useConvexQuery(
    recentRetroProjectionQuery,
    isAuthenticated ? {} : 'skip',
  ) as RecentRetroProjection[] | undefined

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
