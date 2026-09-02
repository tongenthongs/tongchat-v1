import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { playNotificationSound } from "../../services/orderNotificationDispatcher";

export const useChatSpamGuard = (chatId: string) => {
  const [isMuted, setIsMuted] = useState(false);
  const [muteRemainingSeconds, setMuteRemainingSeconds] = useState(0);
  
  // Buffer timestamp 60 detik terakhir (Client-Side Sliding Window)
  const messageTimestampsRef = useRef<number[]>([]);

  // 1. Cek Status Mute dari DB / LocalStorage
  useEffect(() => {
    if (!chatId) return;

    const chatDocRef = doc(db, "chats", chatId);
    const unsub = onSnapshot(chatDocRef, (chatSnap) => {
      if (chatSnap.exists()) {
        const data = chatSnap.data();
        const mutedUntil = data?.isMutedUntil;
        if (mutedUntil) {
          const targetMillis = typeof mutedUntil === 'number' 
            ? mutedUntil 
            : (mutedUntil.toMillis ? mutedUntil.toMillis() : (mutedUntil.seconds ? mutedUntil.seconds * 1000 : new Date(mutedUntil).getTime()));
          const remaining = Math.ceil((targetMillis - Date.now()) / 1000);
          if (remaining > 0) {
            setIsMuted(true);
            setMuteRemainingSeconds(Math.floor(remaining));
          } else {
            setIsMuted(false);
            setMuteRemainingSeconds(0);
          }
        } else {
          setIsMuted(false);
          setMuteRemainingSeconds(0);
        }
      }
    }, (err) => {
      console.warn("Spam guard snapshot warning:", err);
    });

    return () => unsub();
  }, [chatId]);

  // 2. Countdown Timer Mute
  useEffect(() => {
    if (!isMuted || muteRemainingSeconds <= 0) {
      if (isMuted && muteRemainingSeconds <= 0) setIsMuted(false);
      return;
    }

    const timer = setInterval(() => {
      setMuteRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsMuted(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isMuted, muteRemainingSeconds]);

  // 3. Validator Spam Sebelum Pesan Dikirim (> 10 Pesan dalam < 60 Detik)
  const validateSpamAndRecord = async (): Promise<boolean> => {
    if (isMuted) return false;

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // Filter hanya timestamp dalam 60 detik terakhir
    messageTimestampsRef.current = [
      ...messageTimestampsRef.current.filter((ts) => ts > oneMinuteAgo),
      now
    ];

    // Jika melebihi 10 chat dalam rentang 1 menit
    if (messageTimestampsRef.current.length > 10) {
      const muteDurationMs = 15 * 60 * 1000; // 15 Menit
      const mutedUntilTimestamp = now + muteDurationMs;

      setIsMuted(true);
      setMuteRemainingSeconds(15 * 60);

      // Kunci status mute di database & kirim peringatan otomatis
      try {
        await updateDoc(doc(db, "chats", chatId), {
          isMutedUntil: mutedUntilTimestamp,
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "chats", chatId, "messages"), {
          text: "⛔ *SISTEM ANTI-SPAM*: Kamu mengirim lebih dari 10 pesan dalam 1 menit. Fitur chat dibatasi (mute) selama 15 menit.",
          sender: "admin",
          senderRole: "RESMI",
          isSystemNotice: true,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Gagal set spam mute:", err);
      }

      return false; // Blokir pengiriman pesan saat ini
    }

    return true; // Lolos verifikasi
  };

  return {
    isMuted,
    muteRemainingSeconds,
    validateSpamAndRecord
  };
};

export const useCustomerRealtimeNotificationListener = () => {
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (!user) return;

      // Dengarkan koleksi notifikasi darurat user
      const q = query(
        collection(db, "user_notifications"),
        where("userId", "==", user.uid),
        where("isRead", "==", false)
      );

      unsubscribeUser = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            
            // Mainkan Suara & Getar
            playNotificationSound();

            // Munculkan notifikasi pop-up native browser jika izin aktif
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(data.title || "Notifikasi Entong Store", {
                  body: data.message || "Ada pembaruan status pesanan!",
                  icon: "/favicon.ico"
                });
              } catch (e) {
                navigator.serviceWorker?.ready.then((reg) => {
                  reg.showNotification(data.title || "Notifikasi Entong Store", {
                    body: data.message || "Ada pembaruan status pesanan!",
                    icon: "/favicon.ico"
                  });
                }).catch(() => {});
              }
            }
          }
        });
      }, (err) => {
        console.warn("user_notifications listener error:", err);
      });
    });

    return () => {
      if (unsubscribeUser) unsubscribeUser();
      unsubscribeAuth();
    };
  }, []);
};

export default function CustomerChatBox() {
  useCustomerRealtimeNotificationListener();
  return null;
}
