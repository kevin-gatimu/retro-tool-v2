import type { PropsWithChildren } from 'react'
import { useCallback } from 'react'
import { ConvexProviderWithAuth } from 'convex/react'
import { authClient, getBearerToken } from './auth-client'
import { getConvexClient } from './convex-client'
import { env } from '@/env'

/**
 * Bridges Better Auth → Convex. Convex's `customJwt` provider verifies the
 * RS256 JWT minted by the NestJS API, so the Convex client must present that
 * token. We fetch it from `GET /api/auth/token` (cookie- or bearer-authed,
 * mirroring the REST client's private-window fallback) and hand it to Convex via
 * the `useAuth` contract `ConvexProviderWithAuth` expects.
 */
function useConvexAuthFromBetterAuth() {
  const { data: session, isPending } = authClient.useSession()

  const fetchAccessToken = useCallback(
    async (_args: { forceRefreshToken: boolean }): Promise<string | null> => {
      try {
        // Attach the bearer whenever present (primary credential); keep the
        // cookie as a fallback during rollout.
        const headers: Record<string, string> = {}
        const bearer = getBearerToken()
        if (bearer) headers.Authorization = `Bearer ${bearer}`
        const res = await fetch(`${env.VITE_API_URL}/api/auth/token`, {
          credentials: 'include',
          headers,
        })
        if (!res.ok) return null
        const body = (await res.json()) as { token?: string }
        return body.token ?? null
      } catch {
        return null
      }
    },
    // The session id is the only input that changes which token we'd receive;
    // re-create the fetcher when the signed-in user changes so Convex re-auths.
    [],
  )

  return {
    isLoading: isPending,
    isAuthenticated: !!session,
    fetchAccessToken,
  }
}

export function RealtimeProviders({ children }: PropsWithChildren) {
  const convexClient = getConvexClient()

  if (!convexClient) {
    return children
  }

  return (
    <ConvexProviderWithAuth
      client={convexClient}
      useAuth={useConvexAuthFromBetterAuth}
    >
      {children}
    </ConvexProviderWithAuth>
  )
}
