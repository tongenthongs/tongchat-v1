import { doc, getDoc, collection, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

// Helper membunyikan audio notifikasi di tab aktif
export const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.play().catch(() => {});
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([300, 150, 300, 150, 500]);
    }
  } catch (e) {}
};

// Eksekusi PUSH NOTIFIKASI PAKSA saat status diubah ke DIORDER
export const triggerDiorderHighPriorityNotification = async (orderId: string) => {
  try {
    if (!orderId) return;
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return;

    const orderData = orderSnap.data();
    const targetUserId = orderData.userId || orderData.userUid || orderData.customerId;
    const robloxUser = orderData.robloxUsername || orderData.roblox_username || orderData.game_user_id || "Kak";

    // 1. Buat Dokumen Notifikasi di Firestore (Koleksi `user_notifications`)
    if (targetUserId) {
      await addDoc(collection(db, "user_notifications"), {
        userId: targetUserId,
        orderId: orderId,
        type: "ORDER_DIORDER",
        title: "⚡ PESANAN SEDANG DIPROSES!",
        message: `Halo @${robloxUser}, admin sudah siap gift item kamu! Buka menu chat web sekarang untuk join server!`,
        isRead: false,
        priority: "HIGH",
        createdAt: serverTimestamp()
      });
    }

    // 2. Kirim Web Push Notification jika Service Worker Aktif di Client
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        reg.showNotification("⚡ PESANAN KAMU DIORDER!", {
          body: `Halo @${robloxUser}, admin sudah masuk server! Buka chat sekarang untuk join server!`,
          icon: "/favicon.ico",
          tag: `order-${orderId}`,
          renotify: true,
          requireInteraction: true,
          vibrate: [300, 150, 300, 150, 500],
          data: { url: "/chat" }
        } as any);
      }
    }

    // 3. Mainkan Suara & Getar
    playNotificationSound();
    
    console.log(`📢 [PushNotif] Notifikasi darurat DIORDER terkirim ke customer UID: ${targetUserId}`);
  } catch (err) {
    console.error("Gagal mengirim push notification diorder:", err);
  }
};
