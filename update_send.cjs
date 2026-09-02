const fs = require('fs');
let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

const oldLogic = `          } else {
            // Admin/Owner sent message -> Notify Customer
            if (roomCustomerId) {
              const customerSnap = await getDoc(doc(db, 'users', roomCustomerId));
              if (customerSnap.exists()) {
                const customerData = customerSnap.data();
                if (customerData && customerData.fcmToken) {
                  await triggerPushNotification(
                    customerData.fcmToken,
                    \`Pesan Baru dari Admin Store 💬\`,
                    messageText || (mediaUrl ? '[Gambar/Video]' : 'Ada pesan baru untuk Anda.')
                  );
                }
              }
            }
          }`;

const newLogic = `          } else {
            // Admin/Owner sent message -> Notify Customer
            if (roomCustomerId) {
              // 1. Check if customer is currently active in room
              const roomSnap = await getDoc(doc(db, 'chats', targetRoomId));
              let isCustomerActive = false;
              if (roomSnap.exists()) {
                const rData = roomSnap.data();
                if (rData.activeInRoom === roomCustomerId || rData.isCustomerOnline === true) {
                   isCustomerActive = true;
                }
              }

              if (!isCustomerActive) {
                const customerSnap = await getDoc(doc(db, 'users', roomCustomerId));
                if (customerSnap.exists()) {
                  const customerData = customerSnap.data();
                  const tokens = customerData.fcmTokens || (customerData.fcmToken ? [customerData.fcmToken] : []);
                  if (tokens && tokens.length > 0) {
                    await triggerPushNotification(
                      tokens,
                      \`Entong Store - Pesan Baru dari Admin\`,
                      messageText || (mediaUrl ? '[Gambar/Video]' : 'Ada pesan baru untuk Anda.'),
                      { chatId: targetRoomId, url: \`/chat\` }
                    );
                  }
                }
              }
            }
          }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/context/AppContext.tsx', content);
