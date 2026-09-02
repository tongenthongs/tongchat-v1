import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  serverTimestamp,
  setDoc,
  getDoc,
  limit
} from "firebase/firestore";
import { db } from "../lib/firebase";

/**
 * 1. Ambil teks template Quick Reply dinamis dari Firestore (quick_replies atau quickReplies)
 */
export const getDynamicQuickReply = async (shortcut: string): Promise<string> => {
  try {
    const cleanShortcut = shortcut.startsWith('/') ? shortcut.toLowerCase() : `/${shortcut.toLowerCase()}`;
    
    // Cari di koleksi quickReplies (koleksi standar Entong Store)
    const snapQR = await getDocs(collection(db, "quickReplies"));
    if (!snapQR.empty) {
      const match = snapQR.docs.find(d => {
        const s = (d.data().shortcut || '').toLowerCase().trim();
        return s === cleanShortcut || s === cleanShortcut.replace(/^\//, '');
      });
      if (match) {
        const data = match.data();
        return data.message || data.pesan || data.content || "";
      }
    }

    // Fallback cari di koleksi quick_replies jika ada
    const snapAlt = await getDocs(collection(db, "quick_replies"));
    if (!snapAlt.empty) {
      const match = snapAlt.docs.find(d => {
        const s = (d.data().shortcut || '').toLowerCase().trim();
        return s === cleanShortcut || s === cleanShortcut.replace(/^\//, '');
      });
      if (match) {
        const data = match.data();
        return data.message || data.pesan || data.content || "";
      }
    }

    return "";
  } catch (err) {
    console.warn("Gagal mengambil dynamic quick reply:", err);
    return "";
  }
};

/**
 * 2. Dispatcher pesan otomatis ke room chat customer
 */
export const dispatchAutoChatMessage = async ({
  robloxUsername,
  customerWhatsapp,
  customerName,
  messageText,
  orderBadge,
  orderId
}: {
  robloxUsername: string;
  customerWhatsapp?: string;
  customerName?: string;
  messageText: string;
  orderBadge: string;
  orderId?: string;
}) => {
  if (!messageText) return;

  const cleanUser = (robloxUsername || '').toLowerCase().trim().replace(/^@/, '');
  const cleanPhone = (customerWhatsapp || '').replace(/[^0-9]/g, '');

  try {
    // 1. Cari room chat yang sudah ada terkait customer ini
    let targetChatDocId = "";
    const chatsRef = collection(db, "chats");

    if (orderId) {
      const snapOrder = await getDocs(query(chatsRef, where("order_id", "==", orderId), limit(1)));
      if (!snapOrder.empty) targetChatDocId = snapOrder.docs[0].id;
    }

    if (!targetChatDocId && cleanUser) {
      const snapUser = await getDocs(query(chatsRef, where("robloxUsername", "==", cleanUser), limit(1)));
      if (!snapUser.empty) targetChatDocId = snapUser.docs[0].id;
    }

    if (!targetChatDocId && cleanPhone) {
      const snapPhone = await getDocs(query(chatsRef, where("customerWhatsapp", "==", cleanPhone), limit(1)));
      if (!snapPhone.empty) targetChatDocId = snapPhone.docs[0].id;
    }

    // Default chat Doc ID jika belum ditemukan
    if (!targetChatDocId) {
      targetChatDocId = cleanUser ? `chat_${cleanUser}` : (cleanPhone ? `chat_${cleanPhone}` : `chat_${orderId || Date.now()}`);
    }

    const chatRef = doc(db, "chats", targetChatDocId);

    // Pastikan dokumen room chat terinisialisasi / terupdate
    await setDoc(chatRef, {
      customerName: customerName || cleanUser || "Customer",
      robloxUsername: cleanUser || "",
      customerWhatsapp: cleanPhone || customerWhatsapp || "-",
      lastMessage: messageText,
      lastMessageAt: serverTimestamp(),
      orderBadge: orderBadge.toUpperCase(),
      roleBadge: "RESMI",
      unreadCount: 0,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Tambahkan bubble chat ke subkoleksi messages
    await addDoc(collection(db, "chats", targetChatDocId, "messages"), {
      text: messageText,
      sender: "admin",
      senderRole: "RESMI",
      senderId: "admin_bot",
      isOfficialBot: true,
      created: new Date().toISOString(),
      createdAt: serverTimestamp(),
      localTimestamp: Date.now()
    });

    console.log(`🤖 [AutoBot] Pesan otomatis berhasil dikirim ke room ${targetChatDocId} (${orderBadge})`);
  } catch (err) {
    console.error("Gagal mengirim auto chat message:", err);
  }
};

/**
 * 3. Handler perubahan status order dengan trigger auto-message bot
 */
export const handleUpdateOrderStatusWithAutoBot = async (
  order: any, 
  newStatus: "Booking" | "Diorder" | "Proses" | "Selesai" | "Hangus" | "Dibatalkan" | string
) => {
  if (!order) return;
  const orderDocId = order.firestore_id || order.id_order || order.id || order.orderId;
  const orderRef = doc(db, "orders", orderDocId);
  
  const statusNormalized = newStatus.trim();
  const isSelesai = statusNormalized.toLowerCase() === "selesai" || statusNormalized.toUpperCase() === "SELESAI";
  const isDiorder = statusNormalized.toLowerCase() === "diorder" || statusNormalized.toUpperCase() === "DIORDER";
  const isHangus = statusNormalized.toLowerCase() === "hangus" || statusNormalized.toLowerCase() === "dibatalkan";

  // 1. Update Status Dokumen Order di Firestore
  await updateDoc(orderRef, {
    status: statusNormalized,
    orderStatus: statusNormalized,
    statusCode: statusNormalized.toUpperCase(),
    isCompleted: isSelesai,
    isHangus: isHangus,
    ...(isSelesai ? { completedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp()
  });

  const rawCat = (order.category || order.service_type || order.type || order.productType || '').toLowerCase().trim();
  const isGiftExplicit = order.isGift === true || rawCat === 'gift' || rawCat.includes('gift') || Boolean(order.itemGift) || Boolean(order.giftItemName);
  const isJokiExplicit = order.isJoko === true || order.isJoki === true || rawCat === 'joko' || rawCat === 'joki' || rawCat.includes('joki');
  const isGift = isGiftExplicit && !isJokiExplicit;

  const robloxUser = order.robloxUsername || order.roblox_username || order.game_user_id || order.customer_name || order.customerName || "";
  const custWa = order.customerWhatsapp || order.customer_phone || order.whatsapp || order.phone || "";
  const custName = order.customerName || order.customer_name || order.name || robloxUser;
  const displayOrderId = order.orderId || order.id_order || order.id || orderDocId;

  // 2. OTOMASI TRIGGER 1: GIFT IN-GAME DIUBAH KE "Diorder" -> KIRIM DYNAMIC /linkgp
  if (isGift && isDiorder) {
    let linkGpMessage = await getDynamicQuickReply("/linkgp");
    
    // Fallback jika template belum dibuat di quickReplies
    if (!linkGpMessage) {
      linkGpMessage = `Join ke private server *Drag Drive Simulator* mimin kaak 😊 🔗 Silakan cek menu chat untuk link server aktif.`;
    }

    await dispatchAutoChatMessage({
      robloxUsername: robloxUser,
      customerWhatsapp: custWa,
      customerName: custName,
      messageText: linkGpMessage,
      orderBadge: "DIORDER",
      orderId: displayOrderId
    });
  }

  // 3. OTOMASI TRIGGER 2: SEMUA STATUS ORDERAN DIUBAH KE "Selesai" -> KIRIM PESAN TERIMAKASIH
  if (isSelesai) {
    const completionMessage = `✅ *Pesanan Selesai*

Terimakasih sudah order di Entong Store. 
Mimin tunggu orderan berikutnya yaaa..

Follow juga Saluran WA Entong biar dapet info terbaru seputar Update, Promo, Bahkan GP Gratis!
https://whatsapp.com/channel/0029VbDg513Lo4hZCxMAgP3r`;

    await dispatchAutoChatMessage({
      robloxUsername: robloxUser,
      customerWhatsapp: custWa,
      customerName: custName,
      messageText: completionMessage,
      orderBadge: "SELESAI",
      orderId: displayOrderId
    });
  }
};
