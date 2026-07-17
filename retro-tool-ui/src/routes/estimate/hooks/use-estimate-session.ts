import { useEffect } from 'react'
import {
  useQuery as useTanStackQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { ESTIMATES_ENDPOINTS } from '@/lib/api-endpoints'
import type { EstimateSession } from '@/common/types/estimates'
import { getEstimateSocket } from '@/lib/socket'
import { usesConvexForEstimates } from '@/lib/realtime-config'

/**
 * Loads a live estimate session: fetches it via TanStack Query, joins the
 * session room on mount, and (when Socket.IO is the active realtime backend)
 * refetches on `session-changed` and navigates away on `session-ended`.
 */
export function useEstimateSession(sessionId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const usesConvexRealtime = usesConvexForEstimates()

  // Join session on mount
  useEffect(() => {
    api.post(ESTIMATES_ENDPOINTS.JOIN(sessionId)).catch(() => {
      // Silently ignore join errors
    })
  }, [sessionId])

  const query = useTanStackQuery({
    queryKey: ['estimate-session', sessionId],
    queryFn: () =>
      api.get<EstimateSession>(ESTIMATES_ENDPOINTS.BY_ID(sessionId)),
    staleTime: 30_000,
    // Fallback sync in case a websocket room event is missed.
    refetchInterval: usesConvexRealtime ? false : 5_000,
  })

  useEffect(() => {
    if (usesConvexRealtime) {
      return
    }

    const socket = getEstimateSocket()

    const joinRoom = () => socket.emit('join-session', { sessionId })

    const onSessionChanged = () => {
      void queryClient.refetchQueries({
        queryKey: ['estimate-session', sessionId],
      })
    }

    const onSessionEnded = () => {
      navigate({ to: '/estimate' })
    }

    socket.on('session-changed', onSessionChanged)
    socket.on('session-ended', onSessionEnded)
    socket.on('connect', joinRoom)

    if (socket.connected) {
      joinRoom()
    } else {
      socket.connect()
    }

    return () => {
      socket.emit('leave-session', { sessionId })
      socket.off('session-changed', onSessionChanged)
      socket.off('session-ended', onSessionEnded)
      socket.off('connect', joinRoom)
    }
  }, [sessionId, queryClient, navigate, usesConvexRealtime])

  return {
    session: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    usesConvexRealtime,
  }
}
