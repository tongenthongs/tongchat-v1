import React, { useState, useEffect } from "react";

export default function WebNotificationPromptModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // 1. Cek apakah browser mendukung notifikasi
    if (!("Notification" in window)) return;

    // 2. Cek apakah user sudah pernah memilih "Nanti / Terima Resiko" atau sudah diizinkan
    const isSuppressed = localStorage.getItem("suppress_notif_modal") === "true";
    const currentPermission = Notification.permission;

    if (currentPermission === "denied") {
      setIsBlocked(true);
    }

    // Hanya munculkan jika izin masih 'default' atau 'denied' dan belum di-suppress
    if (currentPermission !== "granted" && !isSuppressed) {
      setIsOpen(true);
    }
  }, []);

  // Handler: Aktifkan Notifikasi Browser
  const handleEnableNotification = async () => {
    if (!("Notification" in window)) {
      alert("Browser Anda tidak mendukung web notification.");
      return;
    }

    setIsRequesting(true);

    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        // Trigger notifikasi sambutan/tes langsung
        new Notification("🔔 Notifikasi Web Aktif!", {
          body: "Kamu akan mendapatkan pemberitahuan instan saat pesanan DIORDER atau SELESAI.",
          icon: "/favicon.ico"
        });

        // Simpan flag agar popup tidak muncul lagi
        localStorage.setItem("suppress_notif_modal", "true");
        setIsOpen(false);
      } else if (permission === "denied") {
        setIsBlocked(true);
      }
    } catch (err) {
      console.error("Gagal meminta izin notifikasi:", err);
    } finally {
      setIsRequesting(false);
    }
  };

  // Handler: Nanti & Terima Resiko (Paksa Hilang / Stop Spam)
  const handleDismissRisk = () => {
    // Simpan ke localStorage agar tidak muncul lagi
    localStorage.setItem("suppress_notif_modal", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-[#0b1120] border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4 text-center">
        
        {/* Ikon Lonceng */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-2xl shadow-lg shadow-cyan-950/40">
          🔔
        </div>

        {/* Judul & Deskripsi */}
        <div className="space-y-2">
          <h2 className="text-base font-extrabold text-white">
            Nyalakan Notifikasi Website
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            <b className="text-cyan-400">Wajib diaktifkan!</b> Agar HP kamu langsung berbunyi dan bergetar saat giliran pesananmu <b className="text-emerald-400">DIORDER / SIAP GIFT</b> tanpa perlu pantengin website terus menerus.
          </p>
        </div>

        {/* Warning Jika Notifikasi Diblokir Browser */}
        {isBlocked && (
          <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px] text-left leading-relaxed">
            ⚠️ <b>Izin notifikasi diblokir oleh browser kamu!</b> Klik ikon 🔒 <b>Gembok</b> di samping alamat web URL atas, lalu ubah izin Notifikasi menjadi &apos;Izinkan / Allow&apos;, lalu refresh web.
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="space-y-2 pt-2">
          {/* Tombol 1: Saya Mengerti & Trigger Izin */}
          <button
            type="button"
            onClick={handleEnableNotification}
            disabled={isRequesting}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span>🔔</span>
            <span>{isRequesting ? "Memproses Izin..." : "SAYA MENGERTI, AKTIFKAN NOTIFIKASI"}</span>
          </button>

          {/* Tombol 2: Nanti & Terima Resiko (Auto Hilang & Tidak Spam Lagi) */}
          <button
            type="button"
            onClick={handleDismissRisk}
            className="w-full py-2.5 px-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-slate-200 font-bold text-xs transition-all cursor-pointer active:scale-95"
          >
            Nanti &amp; Terima Resiko
          </button>
        </div>

        <p className="text-[10px] text-slate-500">
          Pilih &quot;<b>Izinkan / Allow</b>&quot; pada jendela pop-up browser yang muncul.
        </p>
      </div>
    </div>
  );
}
