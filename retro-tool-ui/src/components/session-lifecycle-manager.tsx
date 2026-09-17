import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { env } from '@/env'
import { clearClientAuthState, signOutWithCleanup } from '@/lib/auth-client'
import {
  clearSessionActivity,
  getSessionActivityState,
  getSessionActivityStorageKey,
  isSessionLifecycleMessage,
  publishSessionLifecycleMessage,
  readSessionActivity,
  SESSION_LIFECYCLE_CHANNEL,
  SESSION_LIFECYCLE_STORAGE_KEY,
  SESSION_UNAUTHORIZED_EVENT,
  writeSessionActivity,
} from '@/lib/session-lifecycle'
import type {
  SessionActivity,
  SessionLifecycleMessage,
} from '@/lib/session-lifecycle'

const ACTIVITY_WRITE_THROTTLE_MS = 15_000
const EXPIRY_CHECK_INTERVAL_MS = 5_000
const SERVER_SIGN_OUT_GRACE_MS = 3_000
const WARNING_TOAST_ID = 'session-expiry-warning'
const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'touchstart',
  'scroll',
] as const

export function SessionLifecycleManager({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient()
  const idleTimeoutMs = env.VITE_AUTH_IDLE_TIMEOUT_MINUTES * 60_000
  const warningDurationMs = Math.min(
    env.VITE_AUTH_IDLE_WARNING_MINUTES * 60_000,
    idleTimeoutMs,
  )
  const initialActivity = readSessionActivity(sessionId) ?? Date.now()
  const lastActivityRef = useRef(initialActivity)
  const lastPersistedActivityRef = useRef(0)
  const logoutStartedRef = useRef(false)
  const warningVisibleRef = useRef(false)
  const channelRef = useRef<BroadcastChannel | null>(null)

  const finishLocalLogout = useCallback(() => {
    toast.dismiss(WARNING_TOAST_ID)
    clearSessionActivity(sessionId)
    clearClientAuthState(queryClient)
    const redirect = encodeURIComponent(
      window.location.pathname + window.location.search,
    )
    window.location.replace(
      `/auth/sign-in?status=session-expired&redirect=${redirect}`,
    )
  }, [queryClient, sessionId])

  const expireSession = useCallback(
    async (broadcast = true) => {
      if (logoutStartedRef.current) return
      logoutStartedRef.current = true

      const message: SessionLifecycleMessage = {
        type: 'logout',
        sessionId,
        issuedAt: Date.now(),
      }
      if (broadcast) {
        channelRef.current?.postMessage(message)
        publishSessionLifecycleMessage(message)
      }

      try {
        const serverSignOut = signOutWithCleanup(queryClient).catch(
          () => undefined,
        )
        await Promise.race([
          serverSignOut,
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, SERVER_SIGN_OUT_GRACE_MS)
          }),
        ])
      } finally {
        finishLocalLogout()
      }
    },
    [finishLocalLogout, queryClient, sessionId],
  )

  const recordActivity = useCallback(
    (at = Date.now(), broadcast = true) => {
      if (logoutStartedRef.current) return

      lastActivityRef.current = at
      if (warningVisibleRef.current) {
        warningVisibleRef.current = false
        toast.dismiss(WARNING_TOAST_ID)
      }

      if (at - lastPersistedActivityRef.current < ACTIVITY_WRITE_THROTTLE_MS) {
        return
      }

      lastPersistedActivityRef.current = at
      const activity: SessionActivity = { sessionId, lastActivityAt: at }
      writeSessionActivity(activity)
      if (broadcast)
        channelRef.current?.postMessage({ type: 'activity', ...activity })
    },
    [sessionId],
  )

  const checkExpiry = useCallback(() => {
    if (logoutStartedRef.current) return

    const state = getSessionActivityState(
      lastActivityRef.current,
      Date.now(),
      idleTimeoutMs,
      warningDurationMs,
    )

    if (state === 'expired') {
      void expireSession()
      return
    }

    if (state === 'warning' && !warningVisibleRef.current) {
      warningVisibleRef.current = true
      toast.warning('Your session will expire soon', {
        id: WARNING_TOAST_ID,
        description: 'Interact with the app to remain signed in.',
        duration: warningDurationMs,
      })
    }
  }, [expireSession, idleTimeoutMs, warningDurationMs])

  useEffect(() => {
    logoutStartedRef.current = false
    warningVisibleRef.current = false
    const storedActivity = readSessionActivity(sessionId)
    if (storedActivity === null) {
      recordActivity(Date.now())
    } else {
      lastActivityRef.current = storedActivity
      lastPersistedActivityRef.current = storedActivity
    }

    if ('BroadcastChannel' in window) {
      channelRef.current = new BroadcastChannel(SESSION_LIFECYCLE_CHANNEL)
    }

    const handleActivity = () => recordActivity()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkExpiry()
    }
    const handleUnauthorized = () => void expireSession()
    const handleMessage = (message: unknown) => {
      if (
        !isSessionLifecycleMessage(message) ||
        message.sessionId !== sessionId
      ) {
        return
      }
      if (message.type === 'logout') {
        logoutStartedRef.current = true
        finishLocalLogout()
        return
      }

      if (message.lastActivityAt > lastActivityRef.current) {
        lastActivityRef.current = message.lastActivityAt
        if (warningVisibleRef.current) {
          warningVisibleRef.current = false
          toast.dismiss(WARNING_TOAST_ID)
        }
      }
    }
    const handleBroadcast = (event: MessageEvent<unknown>) =>
      handleMessage(event.data)
    const handleStorage = (event: StorageEvent) => {
      if (!event.newValue) return
      if (
        event.key !== getSessionActivityStorageKey(sessionId) &&
        event.key !== SESSION_LIFECYCLE_STORAGE_KEY
      ) {
        return
      }

      try {
        handleMessage(JSON.parse(event.newValue) as unknown)
      } catch {
        // Ignore malformed storage values from unrelated or older app versions.
      }
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true })
    }
    window.addEventListener('focus', checkExpiry)
    window.addEventListener('pageshow', checkExpiry)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, handleUnauthorized)
    window.addEventListener('storage', handleStorage)
    channelRef.current?.addEventListener('message', handleBroadcast)

    const interval = window.setInterval(checkExpiry, EXPIRY_CHECK_INTERVAL_MS)
    checkExpiry()

    return () => {
      window.clearInterval(interval)
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity)
      }
      window.removeEventListener('focus', checkExpiry)
      window.removeEventListener('pageshow', checkExpiry)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener(SESSION_UNAUTHORIZED_EVENT, handleUnauthorized)
      window.removeEventListener('storage', handleStorage)
      channelRef.current?.removeEventListener('message', handleBroadcast)
      channelRef.current?.close()
      channelRef.current = null
      toast.dismiss(WARNING_TOAST_ID)
    }
  }, [checkExpiry, finishLocalLogout, recordActivity, sessionId])

  return null
}
