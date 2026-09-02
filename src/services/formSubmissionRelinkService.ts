import { 
  doc, 
  updateDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  serverTimestamp,
  addDoc,
  increment
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export interface SubmitFormPayload {
  chatId: string;
  orderId: string; // Document ID atau ID order
  formType: "GIFT" | "JOKI";
  username: string;
  gamepass?: string;
  password?: string;
  uangTerakhir?: string;
}

export const submitFormAndRelinkOrder = async ({
  chatId,
  orderId,
  formType,
  username,
  gamepass,
  password,
  uangTerakhir
}: SubmitFormPayload) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Customer belum login ke akun web. Silakan login terlebih dahulu.");
  }

  const currentUserId = currentUser.uid;
  const orderRef = doc(db, "orders", orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error("Orderan tidak ditemukan di database.");
  }

  const orderData = orderSnap.data();
  const batch = writeBatch(db);

  // =========================================================================
  // 1. UPDATE DETAIL FORM & KUNCI STATUS KE "BOOKING"
  // =========================================================================
  const cleanUsername = username.trim().replace(/^@/, '');
  const orderUpdatePayload: Record<string, any> = {
    userId: currentUserId,
    robloxUsername: cleanUsername,
    roblox_username: cleanUsername,
    formDataSubmitted: true,
    status: "Booking",
    orderStatus: "Booking",
    statusCode: "BOOKING",
    formSubmittedAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (formType === "GIFT") {
    orderUpdatePayload.gamepassInfo = gamepass || "-";
    orderUpdatePayload.itemGift = gamepass || orderData.itemGift || orderData.packageName || "-";
  } else {
    orderUpdatePayload.accountPassword = password || "-";
    orderUpdatePayload.password = password || "-";
    orderUpdatePayload.uangTerakhir = uangTerakhir || "-";
  }

  batch.update(orderRef, orderUpdatePayload);

  // =========================================================================
  // 2. CEK & HAPUS AKUN INPUT WA LAMA (JIKA ADA DOKUMEN USER SHADOW TERPISAH)
  // =========================================================================
  const previousUserId = orderData.userId;
  const customerWhatsapp = orderData.customerWhatsapp || orderData.whatsapp;

  // Jika order sebelumnya memiliki userId berbeda atau berupa shadow user dari WA
  if (previousUserId && previousUserId !== currentUserId) {
    const oldUserRef = doc(db, "users", previousUserId);
    const oldUserSnap = await getDoc(oldUserRef);

    if (oldUserSnap.exists()) {
      const oldUserData = oldUserSnap.data();
      const oldCoins = Number(oldUserData.tongCoins || oldUserData.balance || 0);

      // Pindahkan sisa koin jika ada
      if (oldCoins > 0) {
        const currentUserRef = doc(db, "users", currentUserId);
        batch.update(currentUserRef, {
          tongCoins: increment(oldCoins),
          balance: increment(oldCoins)
        });
      }

      // Hapus akun lama yang dibuat dari input WA
      batch.delete(oldUserRef);
      console.log(`🗑️ Dokumen user WA lama (${previousUserId}) berhasil dihapus dari database.`);
    }
  }

  // Cari dokumen shadow user lain dengan nomor WA sama yang bukan akun saat ini
  if (customerWhatsapp && customerWhatsapp !== "-") {
    try {
      const shadowQuery = query(
        collection(db, "users"), 
        where("whatsapp", "==", customerWhatsapp)
      );
      const shadowSnap = await getDocs(shadowQuery);

      shadowSnap.docs.forEach((uDoc) => {
        if (uDoc.id !== currentUserId) {
          batch.delete(uDoc.ref);
          console.log(`🗑️ Dokumen shadow user WA (${uDoc.id}) dibersihkan.`);
        }
      });
    } catch (e) {
      console.warn("Notice: Shadow user query skipped/handled:", e);
    }
  }

  // Eksekusi Batch Update & Delete Secara Atomik
  await batch.commit();

  // =========================================================================
  // 3. KIRIM FORM KE CHAT & BALAS PESAN OTOMATIS
  // =========================================================================
  let customerFormSummary = "";
  const displayOrderId = orderData.orderId || orderId.slice(0, 8);
  if (formType === "GIFT") {
    customerFormSummary = `[FORM GAMEPASS - TERVERIFIKASI]\nUsername: ${cleanUsername}\nGamepass: ${gamepass || "-"}\nID Order: #${displayOrderId}`;
  } else {
    customerFormSummary = `[FORM JOKI - TERVERIFIKASI]\nUsername: ${cleanUsername}\nPassword: ${password || "-"}\nUang Terakhir: ${uangTerakhir || "-"}\nID Order: #${displayOrderId}`;
  }

  // A. Kirim form bubble pelanggan
  await addDoc(collection(db, "chats", chatId, "messages"), {
    text: customerFormSummary,
    message: customerFormSummary,
    sender: "customer",
    senderRole: "PELANGGAN",
    sender_role: "CUSTOMER",
    createdAt: serverTimestamp(),
    createdAtMillis: Date.now()
  });

  // B. Balas pesan konfirmasi otomatis
  const botReplyText = `Okey kak pesanannya udah masuk yaa. \nMohon ditunggu sampai admin bales kakakku <3`;

  await addDoc(collection(db, "chats", chatId, "messages"), {
    text: botReplyText,
    message: botReplyText,
    sender: "admin",
    senderRole: "RESMI",
    sender_role: "ADMIN",
    senderName: "Bot Bantuan Entong Store",
    isAutoConfirmation: true,
    isOfficialBot: true,
    createdAt: serverTimestamp(),
    createdAtMillis: Date.now()
  });

  // C. Update metadata room chat
  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: botReplyText,
    last_message: botReplyText,
    lastMessageAt: serverTimestamp(),
    orderBadge: "BOOKING",
    unreadCount: 1,
    updatedAt: serverTimestamp()
  });

  return { success: true };
};
