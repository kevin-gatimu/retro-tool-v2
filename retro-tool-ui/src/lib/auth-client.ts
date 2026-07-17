import { createAuthClient } from 'better-auth/react'
import { passkeyClient } from '@better-auth/passkey/client'
import { jwtClient, multiSessionClient } from 'better-auth/client/plugins'
import { env } from '#/env'

// Storage key for the session bearer token. The bearer is the primary API
// credential; the cookie is kept as a fallback during the cookie→bearer rollout.
const BEARER_TOKEN_KEY = 'retro_tool_bearer_token'

/**
 * Store the session bearer token (captured from the `set-auth-token` header).
 */
export function storeBearerToken(token: string): void {
  sessionStorage.setItem(BEARER_TOKEN_KEY, token)
}

/**
 * Get stored bearer token
 */
export function getBearerToken(): string | null {
  return sessionStorage.getItem(BEARER_TOKEN_KEY)
}

/**
 * Clear stored bearer token (call on sign-out)
 */
export function clearBearerToken(): void {
  sessionStorage.removeItem(BEARER_TOKEN_KEY)
}

/**
 * Test if cookies are working after sign-in
 * Returns false if cookies appear to be blocked
 */
export function testCookiesWorking(): boolean {
  // Check if any better-auth cookies exist
  const cookies = document.cookie
  return cookies.includes('better-auth') || cookies.includes('session')
}

/**
 * Reliably detect private/incognito window by attempting a localStorage write.
 * Private windows in all major browsers block or quota-limit localStorage,
 * which causes the write to throw or silently fail.
 */
export async function detectPrivateWindow(): Promise<boolean> {
  try {
    const testKey = '__retro_private_test__'
    localStorage.setItem(testKey, '1')
    localStorage.removeItem(testKey)
    return false // localStorage works — not a private window
  } catch {
    return true // localStorage blocked — private/incognito window
  }
}

export const authClient = createAuthClient({
  baseURL: env.VITE_API_URL + '/api/auth',
  // Passkey (WebAuthn) support: exposes authClient.signIn.passkey() and
  // authClient.passkey.{addPasskey,listUserPasskeys,updatePasskey,deletePasskey}.
  // jwtClient adds authClient.token() — used to fetch the RS256 JWT that
  // authenticates the Convex client (see realtime-providers.tsx).
  // multiSessionClient types authClient.multiSession.{listDeviceSessions,setActive}
  // (server has multiSession() enabled) — consumed by account-switcher.tsx.
  plugins: [passkeyClient(), jwtClient(), multiSessionClient()],
  fetchOptions: {
    // Cookie kept as a fallback during the cookie→bearer rollout; the bearer
    // (below) is the primary credential when present.
    credentials: 'include',
    onSuccess: (ctx) => {
      // Capture the session bearer token from any auth response that sets it.
      const authToken = ctx.response.headers.get('set-auth-token')
      if (authToken) {
        storeBearerToken(authToken)
      }
    },
    // Always attach the bearer dynamically — the token getter is evaluated per
    // request (not once at module load), so it picks up the token captured on
    // sign-in. Better Auth omits the header when the token is empty.
    auth: {
      type: 'Bearer',
      token: () => getBearerToken() ?? '',
    },
  },
})

/**
 * Enhanced sign-out that clears bearer token
 */
export async function signOutWithCleanup(): Promise<void> {
  clearBearerToken()
  await authClient.signOut()
}
