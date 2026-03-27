import type { RealtimeBackend } from '@retro-tool/contracts'
import { env } from '@/env'

export const estimatesRealtimeBackend: RealtimeBackend =
  env.VITE_ESTIMATES_REALTIME_BACKEND

export const retrosRealtimeBackend: RealtimeBackend =
  env.VITE_RETROS_REALTIME_BACKEND

export function isConvexConfigured() {
  return Boolean(env.VITE_CONVEX_URL)
}

export function usesConvexForEstimates() {
  return estimatesRealtimeBackend === 'convex' && isConvexConfigured()
}

export function usesConvexForRetros() {
  return retrosRealtimeBackend === 'convex' && isConvexConfigured()
}
