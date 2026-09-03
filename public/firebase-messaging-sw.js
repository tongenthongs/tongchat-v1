importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDmCGJvGPPh6SfpnW-S9xo-rkATNPpA1wY",
  authDomain: "gen-lang-client-0399652335.firebaseapp.com",
  projectId: "gen-lang-client-0399652335",
  messagingSenderId: "1090742753810",
  appId: "1:1090742753810:web:15f5933a6e6bb1d2a456cb",
  storageBucket: "gen-lang-client-0399652335.firebasestorage.app"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || payload.data?.title || "Entong Store";
  const body = (payload.notification && payload.notification.body) || payload.data?.body || "Ada pesan baru dari admin.";
  const targetUrl = payload.data?.url || "/chat";
  const options = {
    body,
    icon: payload.data?.icon || "/logo192.png",
    badge: payload.data?.badge || "/logo192.png",
    image: payload.data?.image || undefined,
    vibrate: [200, 100, 200, 100, 400],
    tag: payload.data?.tag || "chat-update",
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    silent: false,
    data: {
      url: targetUrl,
      tag: payload.data?.tag || "chat-update",
      chatId: payload.data?.chatId || null
    },
    actions: [
      { action: 'open', title: 'Buka Chat' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };
  self.registration.showNotification(title, options);
});

// Click handler with smooth URL deep-link
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetUrl = event.notification.data?.url || '/chat';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = client.url || '';
        if ((clientUrl.includes(targetUrl) || (targetUrl.includes('/chat') && clientUrl.includes('/chat'))) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});

// Service worker lifecycle for fast activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});