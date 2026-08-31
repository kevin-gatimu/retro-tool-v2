import { useMutation } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import {
  authClient,
  testCookiesWorking,
  clearBearerToken,
  getBearerToken,
  storeBearerToken,
} from '@/lib/auth-client'
import { isBrowserStorageAvailable } from '@/lib/browser-storage'
import { api } from '@/lib/api'
import { USERS_ENDPOINTS, OTP_ENDPOINTS } from '@/lib/api-endpoints'
import { env } from '#/env'
import { toast } from 'sonner'
import type { User } from '@/common/types/users'

type SignInOutcome = 'pending' | 'rejected' | 'suspended' | 'success'

interface SignInCallbacks {
  onPendingApproval: () => void
  onRejected: () => void
  onSuspended: () => void
  redirect?: string
}

/**
 * After a session is established (by any method), resolve the user's account
 * status. Shared by password and OTP sign-in so both behave identically.
 *
 * The bearer token is the primary credential and is kept regardless of whether
 * cookies work (we no longer discard it), so the app authenticates by header on
 * every subsequent request. The cookie remains as a fallback during rollout.
 */
async function resolveSignInOutcome(): Promise<SignInOutcome> {
  // Wait a tick for the session to settle (cookie set / token captured).
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Storage failures can be caused by browser policy, quotas, or privacy mode;
  // report the observable limitation without guessing which mode is active.
  const cookiesWorking = testCookiesWorking()
  const hasBearerToken = !!getBearerToken()
  if (!cookiesWorking && hasBearerToken) {
    const sessionStorageAvailable = isBrowserStorageAvailable('sessionStorage')
    toast.info(
      sessionStorageAvailable
        ? 'Cookies are unavailable. This session may not persist after closing the window.'
        : 'Browser session storage is unavailable. Sign-in persistence may be limited.',
      { duration: 5000 },
    )
  }

  const user = await api.get<User>(USERS_ENDPOINTS.ME)

  if (
    user.status === 'pending' ||
    user.status === 'rejected' ||
    user.status === 'suspended'
  ) {
    await authClient.signOut()
    clearBearerToken()
    return user.status
  }

  return 'success'
}

function useSignInSuccessHandler({
  onPendingApproval,
  onRejected,
  onSuspended,
  redirect,
}: SignInCallbacks) {
  const navigate = useNavigate()
  const router = useRouter()

  return async (outcome: SignInOutcome) => {
    if (outcome === 'pending') return onPendingApproval()
    if (outcome === 'rejected') return onRejected()
    if (outcome === 'suspended') return onSuspended()
    await router.invalidate()
    if (redirect) {
      window.location.href = redirect
    } else {
      navigate({ to: '/dashboard' })
    }
  }
}

/** Password sign-in. */
export function useSignIn(callbacks: SignInCallbacks) {
  const handleSuccess = useSignInSuccessHandler(callbacks)

  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string
      password: string
    }) => {
      const result = await authClient.signIn.email({ email, password })
      if (result.error)
        throw new Error(result.error.message ?? 'Sign in failed')
      return resolveSignInOutcome()
    },
    onSuccess: handleSuccess,
  })
}

/**
 * Passwordless sign-in with a passkey (WebAuthn). The browser ceremony runs via
 * the client plugin; on success we run the same status/navigation flow as
 * password sign-in. `authClient.signIn.passkey()` establishes the session
 * (cookie + set-auth-token captured by the auth-client onSuccess hook), so we
 * only need to resolve the account-status outcome afterward.
 */
export function useSignInPasskey(callbacks: SignInCallbacks) {
  const handleSuccess = useSignInSuccessHandler(callbacks)

  return useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn.passkey()
      if (result.error)
        throw new Error(result.error.message ?? 'Passkey sign in failed')
      return resolveSignInOutcome()
    },
    onSuccess: handleSuccess,
  })
}

/** Send a passwordless sign-in OTP (server-driven). */
export function useSendSignInOtp() {
  return useMutation({
    mutationFn: async (email: string) => {
      await api.post(OTP_ENDPOINTS.SEND, { email, type: 'sign-in' })
    },
  })
}

/** Passwordless sign-in: verify the OTP, then run the shared status flow. */
export function useSignInOtp(callbacks: SignInCallbacks) {
  const handleSuccess = useSignInSuccessHandler(callbacks)

  return useMutation({
    mutationFn: async ({ email, otp }: { email: string; otp: string }) => {
      // Our /api/otp/sign-in proxies to Better Auth and propagates the session
      // cookie + set-auth-token header. Use a direct fetch so we can capture the
      // bearer token for the private-window fallback (the shared `api` helper
      // discards response headers), then run the shared status resolver.
      const res = await fetch(`${env.VITE_API_URL}${OTP_ENDPOINTS.SIGN_IN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, otp }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string
        }
        throw new Error(body.message || 'Sign in failed')
      }
      const authToken = res.headers.get('set-auth-token')
      if (authToken) storeBearerToken(authToken)
      return resolveSignInOutcome()
    },
    onSuccess: handleSuccess,
  })
}
