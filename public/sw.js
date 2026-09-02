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

  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: data.tag || "entong-store-notif",
    renotify: true,
    requireInteraction: true, // Notif tetap nangkring di layar HP sampai diklik
    vibrate: [200, 100, 200, 100, 400], // Getar ganda di HP
    data: {
      url: data.url || "/"
    }
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
