/* Service Worker — handles browser push notifications */

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Retro Tool', body: event.data.text() }
  }

  const title = payload.title || 'Retro Tool'
  const options = {
    body: payload.body || '',
    icon: '/logo192.png',
    badge: '/favicon.ico',
    data: { url: payload.url || '/' },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // The API sends an absolute URL for this environment's UI; fall back to the
  // SW's own origin for any legacy relative/empty value.
  const target = new URL(event.notification.data?.url || '/', self.location.origin)
  const url = target.href

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Reuse a same-origin tab. Prefer one already on the target URL, else
        // navigate the first same-origin tab to it.
        const sameOrigin = windowClients.filter(
          (client) => new URL(client.url).origin === target.origin,
        )
        const exact = sameOrigin.find((client) => client.url === url)
        if (exact) {
          return exact.focus()
        }
        const reusable = sameOrigin[0]
        if (reusable && 'navigate' in reusable) {
          return reusable.focus().then(() => reusable.navigate(url))
        }
        // No reusable tab for this origin — open a fresh window.
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      }),
  )
})
