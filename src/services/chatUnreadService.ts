import { 
  doc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  writeBatch, 
  getDocs,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";

// 1. Reset status unread chat secara atomik di Firestore
export const clearChatUnread = async (chatId: string) => {
  if (!chatId) return;

  try {
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      unreadCount: 0,
      unread_count: 0,
      unreadByAdmin: false,
      unread_by_admin: false,
      is_read_admin: true,
      isReadByAdmin: true,
      unreadAdminCount: 0,
      adminLastReadAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("Silent error clearing chat unread:", err);
  }
};

// 2. Listener Realtime Total Pesan Belum Dibaca di Semua Device Admin
export const subscribeUnreadBadgeCount = (onCountChange: (count: number) => void) => {
  // Query realtime ke seluruh dokumen chats yang unreadCount > 0
  const q = query(
    collection(db, "chats"),
    where("unreadCount", ">", 0)
  );

  return onSnapshot(q, (snapshot) => {
    onCountChange(snapshot.size);
  }, (err) => {
    console.warn("Unread badge subscription error:", err);
  });
};

// 3. Fitur Tombol "Tandai Dibaca" (Tandai Semua Chat Menjadi 0 Sekaligus)
export const markAllChatsAsRead = async () => {
  try {
    const q = query(collection(db, "chats"), where("unreadCount", ">", 0));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        unreadCount: 0,
        unread_count: 0,
        unreadAdminCount: 0,
        unreadByAdmin: false,
        unread_by_admin: false,
        unreadCountByAdmin: 0,
        adminUnread: 0,
        is_read_admin: true,
        isReadByAdmin: true,
        adminLastReadAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
    console.log(`✅ ${snapshot.size} percakapan berhasil ditandai telah dibaca.`);
  } catch (err) {
    console.error("Gagal menandai semua chat dibaca:", err);
  }
};
