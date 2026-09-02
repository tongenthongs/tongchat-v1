const fs = require('fs');
let content = fs.readFileSync('src/components/customer/CustomerChat.tsx', 'utf8');

// Find a good place to insert the SW registration and audio effect.
// Right after: const activeRoomId = getCustomerRoomId();
const insertTarget = '  const activeRoomId = getCustomerRoomId();';

const codeToInsert = `

  // --- SW Registration & Notification Audio ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        // SW registered
      }).catch(err => console.error('SW Error', err));
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const prevChatsLengthRef = useRef(0);
  useEffect(() => {
    if (currentOrderChats.length > prevChatsLengthRef.current && prevChatsLengthRef.current !== 0) {
      const lastMessage = currentOrderChats[currentOrderChats.length - 1];
      if (lastMessage.senderId === 'admin') {
        if (document.hidden) {
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.8;
            audio.play().catch(() => {});
          } catch (e) {}

          if ('Notification' in window && Notification.permission === 'granted') {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('Pesan Baru dari Admin', {
                  body: lastMessage.message || 'Pesan gambar/video/file',
                  icon: '/icon-192x192.png',
                  vibrate: [200, 100, 200]
                });
              });
            } else {
              new Notification('Pesan Baru dari Admin', {
                body: lastMessage.message || 'Pesan gambar/video/file'
              });
            }
          }
        }
      }
    }
    prevChatsLengthRef.current = currentOrderChats.length;
  }, [currentOrderChats]);
  // ---------------------------------------------
`;

if (content.includes(insertTarget)) {
  content = content.replace(insertTarget, insertTarget + codeToInsert);
  fs.writeFileSync('src/components/customer/CustomerChat.tsx', content, 'utf8');
  console.log("Successfully inserted audio and notification logic in CustomerChat.tsx");
} else {
  console.log("Target not found in CustomerChat.tsx");
}
