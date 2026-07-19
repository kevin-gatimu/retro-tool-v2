import { useEffect } from 'react'
import { useQuery as useTanStackQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ESTIMATES_ENDPOINTS } from '@/lib/api-endpoints'
import type { EstimateSession } from '@/common/types/estimates'
import { usesConvexForEstimates } from '@/lib/realtime-config'

/**
 * Loads a live estimate session: fetches it via TanStack Query, marks the user
 * present on mount and absent on unmount via REST, and relies on the Convex
 * projection subscription for realtime updates. A slow backstop poll covers the
 * one gap the subscription can't: a non-member viewer has no Convex board row
 * and would otherwise never refresh.
 */
export function useEstimateSession(sessionId: string) {
  const usesConvexRealtime = usesConvexForEstimates()

  // Presence: mark online on mount, offline on unmount. The projection-sync
  // fired by each REST write propagates the change to other participants — no
  // socket connection is involved.
  useEffect(() => {
    api.post(ESTIMATES_ENDPOINTS.JOIN(sessionId)).catch(() => {
      // Silently ignore join errors
    })

    return () => {
      api
        .post(ESTIMATES_ENDPOINTS.PARTICIPANT(sessionId), { online: false })
        .catch(() => {
          // Silently ignore leave errors (tab close / navigation away)
        })
    }
  }, [sessionId])

  const query = useTanStackQuery({
    queryKey: ['estimate-session', sessionId],
    queryFn: () =>
      api.get<EstimateSession>(ESTIMATES_ENDPOINTS.BY_ID(sessionId)),
    staleTime: 30_000,
    // Team members get sub-second updates from the Convex board subscription,
    // but a non-member viewer has no Convex board row and would otherwise never
    // refresh — so keep a slow 15s poll as a harmless backstop for them (and a
    // near no-op for members).
    refetchInterval: 15_000,
  })

  return {
    session: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    usesConvexRealtime,
  }
}
