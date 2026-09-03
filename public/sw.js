/* eslint-disable no-restricted-globals */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Terima Push Event dari Server / Cloud Messaging
self.addEventListener('push', (event) => {
  let data = {
    title: "⚡ PESANAN KAMU SEDANG DI-GIFT!",
    body: "Admin sudah masuk server! Segera buka web untuk join server sekarang!",
    url: "/chat",
    tag: "order-status-update"
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  const options = {
    body: data.body,
    icon: data.icon || "/logo192.png",
    badge: data.badge || "/logo192.png",
    image: data.image || undefined,
    tag: data.tag || "entong-store-notif",
    renotify: Boolean(data.renotify),
    requireInteraction: data.requireInteraction !== false,
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : [200, 100, 200, 100, 400],
    timestamp: Date.now(),
    silent: false,
    data: {
      url: targetUrl,
      tag: data.tag || "entong-store-notif"
    },
    actions: Array.isArray(data.actions) ? data.actions : [
      { action: 'open', title: 'Buka Chat' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 2. Klik Notifikasi Langsung Buka/Fokus ke Halaman Chat
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
