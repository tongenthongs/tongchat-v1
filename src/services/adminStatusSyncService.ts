import { 
  doc, 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { executeSetOrderHangus } from "./orderHangusService";

export const syncOrderStatusEverywhere = async (chatData: any, newStatus: string) => {
  if (!chatData || !chatData.id) return;

  const statusUpper = newStatus.toUpperCase();
  const chatId = chatData.id;

  // 1. Jika Status HANGUS -> Jalankan Service Khusus Hangus (No Refund + Warning Message)
  if (statusUpper === "HANGUS") {
    const isJoki = String(chatData.packageName || chatData.lastOrderedItem || chatData.package_name || "").toLowerCase().includes("joki");
    await executeSetOrderHangus({
      orderId: chatData.orderId || chatData.id,
      chatId: chatId,
      orderType: isJoki ? "JOKI" : "GIFT"
    });
    return;
  }

  try {
    const batch = writeBatch(db);

    // 2. Update Dokumen Room Chat (chats/{chatId})
    const chatRef = doc(db, "chats", chatId);
    batch.update(chatRef, {
      orderBadge: statusUpper,
      status: statusUpper,
      orderStatus: statusUpper,
      statusCode: statusUpper,
      updatedAt: serverTimestamp()
    });

    // 3. Cari & Update Dokumen Pesanan Terkait di Koleksi `orders`
    let targetOrderDocRef: any = null;

    if (chatData.orderId) {
      targetOrderDocRef = doc(db, "orders", chatData.orderId);
    } else {
      // Lookup berdasarkan robloxUsername yang aktif
      const cleanUser = String(chatData.robloxUsername || chatData.username || "").replace(/^@+/, '').trim().toLowerCase();
      if (cleanUser) {
        const ordersQuery = query(collection(db, "orders"), where("robloxUsername", "==", cleanUser));
        const snap = await getDocs(ordersQuery);
        if (!snap.empty) {
          targetOrderDocRef = snap.docs[0].ref;
        }
      }
    }

    if (targetOrderDocRef) {
      batch.update(targetOrderDocRef, {
        status: statusUpper,
        orderStatus: statusUpper,
        statusCode: statusUpper,
        isCompleted: statusUpper === "SELESAI",
        updatedAt: serverTimestamp()
      });
    }

    // Eksekusi penulisan ganda serentak
    await batch.commit();
    console.log(`✅ [StatusSync] Status berhasil disinkronkan ke '${statusUpper}' di koleksi Chats & Orders.`);
  } catch (error) {
    console.error("Gagal sinkronisasi status pesanan:", error);
    throw error;
  }
};
