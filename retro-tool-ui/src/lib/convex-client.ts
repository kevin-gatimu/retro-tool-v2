import { ConvexReactClient } from 'convex/react'
import { env } from '@/env'
import { usesConvexForAnything } from '@/lib/realtime-config'

let convexClient: ConvexReactClient | null = null

export function getConvexClient() {
  // Only create the client (which opens a WebSocket) when a feature actually
  // uses Convex. Otherwise a stale/unreachable VITE_CONVEX_URL would retry
  // forever and spam the console — e.g. local dev with no Convex container.
  if (!env.VITE_CONVEX_URL || !usesConvexForAnything()) {
    return null
  }

  if (!convexClient) {
    convexClient = new ConvexReactClient(env.VITE_CONVEX_URL)
  }

  return convexClient
}
