import { ConvexReactClient } from 'convex/react'
import { env } from '@/env'

let convexClient: ConvexReactClient | null = null

export function getConvexClient() {
  if (!env.VITE_CONVEX_URL) {
    return null
  }

  if (!convexClient) {
    convexClient = new ConvexReactClient(env.VITE_CONVEX_URL)
  }

  return convexClient
}
