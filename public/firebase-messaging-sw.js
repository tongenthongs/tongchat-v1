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
  const title = payload.notification?.title || payload.data?.title || "Entong Store";
  const options = {
    body: payload.notification?.body || payload.data?.body || "Ada pesan baru dari admin.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || "chat-update",
    renotify: true,
    data: {
      url: payload.data?.url || "/chat"
    }
  };
  self.registration.showNotification(title, options);
});

// Cache & lifecycle update management
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/chat') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/chat');
      }
    })
  );
});