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

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If there's already an open window/tab for our app, focus it and navigate
        for (const client of windowClients) {
          if ('focus' in client) {
            client.focus()
            if ('navigate' in client) {
              return client.navigate(url)
            }
            return
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      }),
  )
})
