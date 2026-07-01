import type { RealtimeBackend } from '@retro-tool/contracts'
import { env } from '@/env'

export const estimatesRealtimeBackend: RealtimeBackend =
  env.VITE_ESTIMATES_REALTIME_BACKEND

export const retrosRealtimeBackend: RealtimeBackend =
  env.VITE_RETROS_REALTIME_BACKEND

export const icebreakersRealtimeBackend: RealtimeBackend =
  env.VITE_ICEBREAKERS_REALTIME_BACKEND

export const notificationsRealtimeBackend: RealtimeBackend =
  env.VITE_NOTIFICATIONS_REALTIME_BACKEND

export function isConvexConfigured() {
  return Boolean(env.VITE_CONVEX_URL)
}

export function usesConvexForEstimates() {
  return estimatesRealtimeBackend === 'convex' && isConvexConfigured()
}

export function usesConvexForRetros() {
  return retrosRealtimeBackend === 'convex' && isConvexConfigured()
}

export function usesConvexForIcebreakers() {
  return icebreakersRealtimeBackend === 'convex' && isConvexConfigured()
}

export function usesConvexForNotifications() {
  return notificationsRealtimeBackend === 'convex' && isConvexConfigured()
}

/**
 * True only if at least one feature is configured to use Convex. When every
 * feature is on socket-io we must NOT open a Convex WebSocket — otherwise the
 * client retries a (possibly unreachable) deployment forever and floods the
 * console with ERR_CONNECTION_REFUSED / reconnect logs.
 */
export function usesConvexForAnything() {
  return (
    usesConvexForEstimates() ||
    usesConvexForRetros() ||
    usesConvexForIcebreakers() ||
    usesConvexForNotifications()
  )
}
