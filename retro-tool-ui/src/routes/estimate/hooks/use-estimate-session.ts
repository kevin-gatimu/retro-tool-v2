import { useEffect, useMemo } from 'react'
import { useQuery as useTanStackQuery } from '@tanstack/react-query'
import {
  useConvexAuth,
  useMutation as useConvexMutation,
  useQuery as useConvexQuery,
} from 'convex/react'
import { api } from '@/lib/api'
import { ESTIMATES_ENDPOINTS } from '@/lib/api-endpoints'
import type { EstimateSession } from '@/common/types/estimates'
import type { PresenceRow } from '../types'
import { convexApi } from '@/lib/convex-api'
import { useCurrentUser } from '@/hooks/use-current-user'
import { usesConvexForEstimates } from '@/lib/realtime-config'

const setPresenceMutationRef = convexApi.liveEstimates.setPresence
const getSessionPresenceQueryRef = convexApi.liveEstimates.getSessionPresence

/**
 * Loads a live estimate session: fetches it via TanStack Query and relies on the
 * Convex projection subscription for realtime board updates. A slow backstop
 * poll covers the one gap the subscription can't: a non-member viewer has no
 * Convex board row and would otherwise never refresh.
 *
 * Online presence takes a DIRECT Convex path (mirroring retro ready-status)
 * instead of riding the coalesced projection-outbox → board fan-out, which made
 * join/leave lag and flap. On mount we still POST `/join` once to ensure the
 * Postgres participant *roster* row exists (it carries identity: avatar, name,
 * jobRole, and anchors votes), but the live ONLINE indicator comes from the
 * `setPresence`/`getSessionPresence` Convex pair — so it updates instantly.
 */
export function useEstimateSession(sessionId: string) {
  const usesConvexRealtime = usesConvexForEstimates()
  const { isAuthenticated } = useConvexAuth()
  const { data: currentUser } = useCurrentUser()
  const convexReady = usesConvexRealtime && isAuthenticated

  const setPresence = useConvexMutation(setPresenceMutationRef)

  // Roster: ensure the Postgres participant row exists so this user shows up in
  // the participant list (with avatar/jobRole) for everyone. One-time on mount —
  // no leave call here; offline is now a direct Convex presence signal below.
  useEffect(() => {
    api.post(ESTIMATES_ENDPOINTS.JOIN(sessionId)).catch(() => {
      // Silently ignore join errors
    })
  }, [sessionId])

  // Direct Convex presence: online on mount, offline on unmount. Gated on Convex
  // auth + a loaded currentUser (needed for displayName). userId is derived
  // server-side from the JWT; only displayName is sent.
  useEffect(() => {
    if (!convexReady || !currentUser) return

    void setPresence({
      sessionId,
      displayName: currentUser.name,
      online: true,
    })

    return () => {
      // Cleanup is synchronous, so the offline write is fire-and-forget.
      void setPresence({
        sessionId,
        displayName: currentUser.name,
        online: false,
      })
    }
  }, [convexReady, currentUser, sessionId, setPresence])

  // Live online state — subscribed independently of the board snapshot so
  // join/leave reflects immediately.
  // Cast is safe: getSessionPresence returns { userId, displayName, online }[]
  // per its server schema; useConvexQuery is untyped against string refs.
  const rawPresence = useConvexQuery(
    getSessionPresenceQueryRef,
    convexReady ? { sessionId } : 'skip',
  ) as PresenceRow[] | undefined

  // Set of userIds currently online per Convex. `null` until the subscription
  // first resolves, so callers can fall back to the board snapshot's `isOnline`
  // and avoid an empty-list flash on first paint.
  const onlineUserIds = useMemo(() => {
    if (!rawPresence) return null
    return new Set(
      rawPresence.filter((row) => row.online).map((row) => row.userId),
    )
  }, [rawPresence])

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
    onlineUserIds,
  }
}
