import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { NOTIFICATIONS_ENDPOINTS } from '@/lib/api-endpoints'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0))).buffer
}

export function usePushNotifications({
  auto = false,
}: { auto?: boolean } = {}) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoAttempted = useRef(false)

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  // Check existing subscription state on mount
  useEffect(() => {
    if (!isSupported) return

    async function checkExisting() {
      try {
        const registration =
          (await navigator.serviceWorker.getRegistration('/sw.js')) ||
          (await navigator.serviceWorker.getRegistration())
        if (registration) {
          const sub = await registration.pushManager.getSubscription()
          if (sub) setIsSubscribed(true)
        }
      } catch (err) {
        console.warn(
          'Failed to check existing push subscription:',
          err instanceof Error ? err.message : err,
        )
      }
    }

    void checkExisting()
  }, [isSupported])

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Browser push notifications are not supported in this browser.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get the VAPID public key from the server
      const { publicKey } = await api.get<{ publicKey: string | null }>(
        NOTIFICATIONS_ENDPOINTS.PUSH_VAPID_KEY,
      )

      if (!publicKey) {
        setError(
          'Browser push notifications are not configured on the server yet.',
        )
        return
      }

      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notification permission denied.')
        return
      }

      // Register service worker if not already
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })
      await navigator.serviceWorker.ready

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const json = subscription.toJSON()
      await api.post(NOTIFICATIONS_ENDPOINTS.PUSH_SUBSCRIBE, {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      })

      setIsSubscribed(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to enable push notifications.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if ('serviceWorker' in navigator) {
        const registration =
          (await navigator.serviceWorker.getRegistration('/sw.js')) ||
          (await navigator.serviceWorker.getRegistration())
        if (registration) {
          const sub = await registration.pushManager.getSubscription()
          if (sub) await sub.unsubscribe()
        }
      }
      await api.delete(NOTIFICATIONS_ENDPOINTS.PUSH_SUBSCRIBE)
      setIsSubscribed(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to disable push notifications.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-subscribe on first authenticated load if not already subscribed
  useEffect(() => {
    if (!auto || !isSupported || isSubscribed || autoAttempted.current) return
    // Don't prompt again if user previously denied
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'denied'
    )
      return

    autoAttempted.current = true
    void subscribe()
  }, [auto, isSupported, isSubscribed, subscribe])

  return { isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe }
}
