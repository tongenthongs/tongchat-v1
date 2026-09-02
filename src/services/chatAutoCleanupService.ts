import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  deleteDoc, 
  doc, 
  Timestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";

// Helper rekursif untuk menghapus seluruh dokumen pesan di subkoleksi
const deleteChatSubcollections = async (chatId: string) => {
  try {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messagesSnap = await getDocs(messagesRef);

    if (!messagesSnap.empty) {
      const batch = writeBatch(db);
      messagesSnap.docs.forEach((msgDoc) => {
        batch.delete(msgDoc.ref);
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn(`Gagal hapus subkoleksi pesan untuk chat ${chatId}:`, err);
  }
};

/**
 * DUAL-TIER AUTO-CLEANUP RETENTION ENGINE:
 * Tier 1: Chat tidak aktif > 4 hari (lastMessageAt < 4 hari yang lalu)
 * Tier 2: Chat pesanan SELESAI / HANGUS yang sudah berumur > 14 hari
 */
export const executeAutoPurgeInactiveChats = async () => {
  try {
    const now = new Date();

    // 1. Tier 1: Batas 4 Hari untuk Chat yang Tidak Ada Log/Chatting Lagi
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const fourDaysTimestamp = Timestamp.fromDate(fourDaysAgo);

    // Kueri chat dengan aktivitas terakhir > 4 hari lalu
    const inactiveChatsQuery = query(
      collection(db, "chats"),
      where("lastMessageAt", "<", fourDaysTimestamp)
    );

    const inactiveSnapshot = await getDocs(inactiveChatsQuery);
    let deletedCount = 0;

    if (!inactiveSnapshot.empty) {
      for (const chatDoc of inactiveSnapshot.docs) {
        const chatId = chatDoc.id;
        await deleteChatSubcollections(chatId);
        await deleteDoc(doc(db, "chats", chatId));
        deletedCount++;
      }
      console.log(`✅ [Auto-Purge Tier 1] Berhasil menghapus ${deletedCount} chat tidak aktif (> 4 hari).`);
    }

    // 2. Tier 2: Batas 14 Hari untuk Chat yang Selesai atau Hangus
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const fourteenDaysTimestamp = Timestamp.fromDate(fourDaysAgo);

    let completedDeletedCount = 0;
    try {
      const completedChatsQuery = query(
        collection(db, "chats"),
        where("orderStatus", "in", ["SELESAI", "HANGUS", "CANCEL"]),
        where("lastMessageAt", "<", fourteenDaysTimestamp)
      );

      const completedSnapshot = await getDocs(completedChatsQuery);
      if (!completedSnapshot.empty) {
        for (const chatDoc of completedSnapshot.docs) {
          const chatId = chatDoc.id;
          await deleteChatSubcollections(chatId);
          await deleteDoc(doc(db, "chats", chatId));
          completedDeletedCount++;
        }
        console.log(`✅ [Auto-Purge Tier 2] Berhasil menghapus ${completedDeletedCount} chat selesai/hangus (> 14 hari).`);
      }
    } catch (tier2Err) {
      console.warn("Notice Tier 2 cleanup query:", tier2Err);
    }

    const totalPurged = deletedCount + completedDeletedCount;
    if (totalPurged === 0) {
      console.log("🧹 Database bersih. Tidak ada chat kedaluwarsa yang perlu dihapus.");
    }

    return { totalDeleted: totalPurged };
  } catch (error) {
    console.error("Gagal menjalankan auto-purge chat:", error);
    return { error };
  }
};
