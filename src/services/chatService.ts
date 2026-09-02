import { collection, query, orderBy, onSnapshot, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

/**
 * Normalisasi timestamp Firebase Timestamp, Date, number, atau string
 * Mencegah sorting error jika timestamp null atau berformat string
 */
export const normalizeChatTimestamp = (timestamp: any): number => {
  if (!timestamp) return 0;
  if (typeof timestamp === 'number') return timestamp;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (timestamp?.toMillis && typeof timestamp.toMillis === 'function') {
    return timestamp.toMillis();
  }
  if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().getTime();
  }
  if (timestamp?.seconds) {
    return timestamp.seconds * 1000 + (timestamp.nanoseconds ? timestamp.nanoseconds / 1000000 : 0);
  }
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

/**
 * Format string waktu yang aman untuk obrolan chat
 */
export const formatSafeChatTime = (timestamp: any): string => {
  if (!timestamp) return "Baru saja";
  try {
    const ms = normalizeChatTimestamp(timestamp);
    if (ms <= 0) return "Baru saja";
    const date = new Date(ms);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return "Baru saja";
  }
};

/**
 * Listener Daftar Percakapan Lengkap (Mendukung hingga 1.000+ chat tanpa terpotong)
 * Menggunakan fallback aman jika terdapat missing index atau timestamp null
 */
export const subscribeToAllChats = (
  onUpdate: (chats: any[]) => void,
  onError?: (error: any) => void
) => {
  const chatsRef = collection(db, "chats");
  
  // Naikkan limit agar 791+ chat terambil semua tanpa terpotong
  const q = query(
    chatsRef,
    orderBy("updatedAt", "desc"),
    limit(2000)
  );

  const processDocs = (docs: any[]) => {
    return docs.map((docSnap) => {
      const data = docSnap.data({ serverTimestamps: 'estimate' }) || {};
      const t = data.updatedAt || data.lastMessageTime || data.createdAt;
      
      return {
        id: docSnap.id,
        chatId: docSnap.id,
        ...data,
        normalizedTimestamp: normalizeChatTimestamp(t),
        lastMessageTimeFormatted: formatSafeChatTime(t)
      };
    }).sort((a, b) => b.normalizedTimestamp - a.normalizedTimestamp);
  };

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const chatList = processDocs(snapshot.docs);
      onUpdate(chatList);
    },
    (err) => {
      console.warn("Primary orderBy updatedAt failed, switching to unordered stream fallback:", err);
      // Fallback query tanpa orderBy untuk menangani missing composite index
      const fallbackQuery = query(chatsRef, limit(2000));
      return onSnapshot(
        fallbackQuery,
        (fallbackSnapshot) => {
          const chatList = processDocs(fallbackSnapshot.docs);
          onUpdate(chatList);
        },
        (fallbackErr) => {
          console.error("Gagal load seluruh list chat:", fallbackErr);
          if (onError) onError(fallbackErr);
        }
      );
    }
  );
};
