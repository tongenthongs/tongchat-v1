import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export default function MandatoryNotificationGate({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Cek apakah browser mendukung notifikasi
    if (typeof window === "undefined" || !("Notification" in window)) {
      setShowModal(false);
      return;
    }

    const currentPerm = Notification.permission;
    setPermissionState(currentPerm);

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setShowModal(false);
        return;
      }

      // Cek di DB apakah user sudah mengaktifkan notif
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const notifEnabled = userSnap.data()?.isNotificationEnabled;
          if (!notifEnabled || currentPerm !== "granted") {
            setShowModal(true);
          } else {
            setShowModal(false);
          }
        } else {
          setShowModal(true);
        }
      } catch (err) {
        console.warn("Error checking user notification state:", err);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleEnableNotification = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Daftarkan Service Worker
      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;
        } catch (swErr) {
          console.warn("SW register warning:", swErr);
        }
      }

      // 2. Minta Izin Notifikasi Browser
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission === "granted") {
        // Bunyikan test audio agar browser membuka policy audio
        try {
          const audio = new Audio(NOTIFICATION_SOUND_URL);
          audio.play().catch(() => {});
        } catch (audioErr) {
          console.warn("Audio play error:", audioErr);
        }

        // Simpan status aktif ke dokumen User di Firestore
        const user = auth.currentUser;
        if (user) {
          try {
            await updateDoc(doc(db, "users", user.uid), {
              isNotificationEnabled: true,
              notificationPermission: "granted",
              notificationGrantedAt: serverTimestamp(),
              devicePlatform: navigator.userAgent.includes("Mobile") ? "MOBILE" : "DESKTOP"
            });
          } catch (docErr) {
            console.warn("User doc update error:", docErr);
          }
        }

        // Tampilkan notifikasi percobaan instan
        if ("serviceWorker" in navigator) {
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
              reg.showNotification("🎉 Notifikasi Berhasil Aktif!", {
                body: "Kamu akan otomatis menerima notif saat admin siap gift itemmu!",
                icon: "/favicon.ico"
              });
            }
          } catch (notifErr) {
            console.warn("Test notification error:", notifErr);
          }
        }

        setShowModal(false);
      } else if (permission === "denied") {
        setErrorMessage(
          "Izin notifikasi diblokir oleh browser kamu! Klik ikon 🔒 Gembok di samping alamat web URL atas, lalu ubah izin Notifikasi menjadi 'Izinkan / Allow', lalu refresh web."
        );
      }
    } catch (err: any) {
      setErrorMessage("Gagal menyalakan notifikasi: " + (err?.message || "Pastikan website dibuka lewat link aman (HTTPS)."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {children}

      {/* POPUP MODAL WAJIB (MANDATORY GATEWAY) */}
      {showModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-cyan-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg shadow-cyan-500/20">
              🔔
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                Nyalakan Notifikasi Website
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                <b className="text-cyan-400">Wajib diaktifkan!</b> Agar HP kamu langsung berbunyi dan bergetar saat giliran pesananmu <b className="text-emerald-400">DIORDER / SIAP GIFT</b> tanpa perlu pantengin website terus menerus.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-left">
                <p className="text-[11px] text-rose-400 font-medium leading-normal">
                  ⚠️ {errorMessage}
                </p>
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleEnableNotification}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? "Mengaktifkan..." : "🔔 SAYA MENGERTI, AKTIFKAN NOTIFIKASI"}
              </button>

              <p className="text-[10px] text-slate-500">
                Pilih <b>"Izinkan / Allow"</b> pada jendela pop-up browser yang muncul.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { MandatoryNotificationGate };
