import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, ShieldAlert } from 'lucide-react';

import { useApp } from '../../context/AppContext';
import { db, messaging } from '../../lib/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';

export const WebPushNotificationBanner: React.FC = () => {
  const { currentUser } = useApp();
  const [showBanner, setShowBanner] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    setPermissionStatus(Notification.permission);

    // Tampilkan banner jika permission masih 'default' dan belum pernah di-dismiss session ini
    const dismissed = sessionStorage.getItem('push_banner_dismissed');
    if (Notification.permission === 'default' && !dismissed) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleRequestPermission = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      alert('Browser Anda tidak mendukung Web Push Notifications atau Service Worker.');
      return;
    }
    try {
      // 1. Register Service Worker first for background pushes
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await navigator.serviceWorker.ready;

      // 2. Request permission using Explicit User Gesture
      const result = await Notification.requestPermission();
      setPermissionStatus(result);
      setShowBanner(false);

      try {
        sessionStorage.setItem('push_banner_dismissed', 'true');
      } catch (e) {}

      if (result === 'granted') {
        // 3. Get FCM Token
        if (messaging && currentUser?.uid) {
          try {
            // NOTE: In production, you'd want to configure a proper VAPID key via env vars.
            // Using a standard public VAPID key for Firebase (if available), or default push manager.
            const currentToken = await getToken(messaging, { 
              serviceWorkerRegistration: registration,
              vapidKey: (import.meta as any).env.VITE_VAPID_PUBLIC_KEY || undefined 
            });

            if (currentToken) {
              const userRef = doc(db, 'users', currentUser.uid);
              await updateDoc(userRef, {
                fcmTokens: arrayUnion(currentToken),
                notificationEnabled: true,
                lastTokenUpdate: serverTimestamp()
              });
              
              new Notification('Entong Store 🚀', {
                body: 'Notifikasi berhasil diaktifkan! Pembaruan pesanan dan chat akan langsung masuk ke HP kamu.',
                icon: '/favicon.ico'
              });
            } else {
               console.warn("FCM token could not be generated.");
            }
          } catch (tokenErr) {
            console.error('Error getting FCM token:', tokenErr);
          }
        } else {
           new Notification('Entong Store 🚀', {
              body: 'Izin Notifikasi berhasil diberikan. Silakan login untuk menerima pemberitahuan.',
              icon: '/favicon.ico'
           });
        }
      } else {
        alert('Izin notifikasi ditolak. Anda dapat mengaktifkannya kapan saja melalui pengaturan browser Anda.');
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  // Safari iOS Specific Detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = ('standalone' in window.navigator) && (window.navigator as any).standalone;
  const showIOSGuide = isIOS && !isStandalone;

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      sessionStorage.setItem('push_banner_dismissed', 'true');
    } catch (e) {}
  };

  if (!showBanner || permissionStatus !== 'default') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[99999] bg-[#111b21] border-2 border-[#00E676] rounded-2xl shadow-2xl p-4 text-white animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#00E676]/15 border border-[#00E676]/30 flex items-center justify-center text-[#00E676] shrink-0">
          <Bell className="w-5 h-5 animate-bounce" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-black text-white flex items-center gap-1.5">
            <span>Aktifkan Notifikasi Web</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-bold">Penting</span>
          </h4>
          <p className="text-[11px] text-slate-300 mt-1 leading-snug">
            Dapatkan pemberitahuan langsung di HP/PC saat pesanan Joko/Gift Anda selesai atau ada pesan dari admin.
          </p>
          {showIOSGuide && (
            <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-200">
              <strong className="block mb-0.5">Khusus iPhone/iPad:</strong>
              Ketuk ikon Share (Bagikan) di Safari lalu pilih 'Add to Home Screen' untuk mengaktifkan notifikasi.
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleRequestPermission}
              className="px-3.5 py-2 bg-[#00E676] hover:bg-emerald-400 text-[#111b21] font-black rounded-xl text-xs shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Aktifkan Notifikasi</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Nanti Saja
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
