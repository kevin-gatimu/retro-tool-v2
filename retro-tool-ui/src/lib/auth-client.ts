import { createAuthClient } from 'better-auth/react'
import { env } from '#/env'

// Storage key for bearer token fallback (used when cookies are blocked in private windows)
const BEARER_TOKEN_KEY = 'retro_tool_bearer_token'

/**
 * Check if cookies are likely blocked (private/incognito window scenarios)
 * Returns true if we should use bearer token fallback
 */
export function shouldUseBearerToken(): boolean {
  const token = sessionStorage.getItem(BEARER_TOKEN_KEY)
  return !!token
}

/**
 * Store bearer token for fallback auth (used when cookies are blocked)
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
  fetchOptions: {
    credentials: 'include',
    onSuccess: (ctx) => {
      // Capture bearer token from sign-in response for fallback
      const authToken = ctx.response.headers.get('set-auth-token')
      if (authToken) {
        // Store token - we'll decide whether to use it after checking cookies
        storeBearerToken(authToken)
      }
    },
    // Use bearer token if cookies are blocked
    auth: shouldUseBearerToken()
      ? {
          type: 'Bearer',
          token: () => getBearerToken() || '',
        }
      : undefined,
  },
})

/**
 * Enhanced sign-out that clears bearer token
 */
export async function signOutWithCleanup(): Promise<void> {
  clearBearerToken()
  await authClient.signOut()
}
