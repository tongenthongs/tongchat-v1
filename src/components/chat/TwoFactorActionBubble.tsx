import React, { useState } from "react";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface Props {
  chatId: string;
  orderId?: string;
  isResolved?: boolean;
}

export default function TwoFactorActionBubble({ chatId, orderId, isResolved = false }: Props) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolved, setResolved] = useState(isResolved);

  const handleConfirmTurnedOff = async () => {
    if (resolved || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const cleanOrderId = orderId || chatId.replace(/^room_/, '');

      // 1. Update status order menjadi "Siap Login!"
      if (cleanOrderId) {
        await updateDoc(doc(db, "orders", cleanOrderId), {
          status: "Siap Login!",
          orderStatus: "SIAP_LOGIN",
          statusCode: "SIAP_LOGIN",
          is2FAOff: true,
          updatedAt: serverTimestamp()
        }).catch((e) => console.warn("Order status update notice:", e));
      }

      // 2. Kirim pesan konfirmasi dari customer
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: "✅ Sudah saya matikan verifikasi 2 langkahnya min, akun sudah siap di-login!",
        sender: "customer",
        senderRole: "PELANGGAN",
        is2FAResponse: true,
        createdAt: serverTimestamp()
      });

      // 3. Update status room chat
      await updateDoc(doc(db, "chats", chatId), {
        orderBadge: "SIAP_LOGIN",
        orderStatus: "SIAP_LOGIN",
        lastMessage: "✅ Customer: Sudah saya matikan 2FA (Siap Login)",
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch((e) => console.warn("Chat status update notice:", e));

      setResolved(true);
    } catch (err) {
      console.error("Gagal update status 2FA:", err);
      alert("Gagal konfirmasi status. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="my-2 p-4 rounded-2xl bg-slate-900 border border-amber-500/40 text-slate-100 max-w-md shadow-xl space-y-3">
      {/* Header Info */}
      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
        <span className="text-base">⚠️</span>
        <span>BUTUH VERIFIKASI AKUN ROBLOX</span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        Halo kak! Saat admin mencoba login, akun Roblox kamu <b className="text-amber-300">meminta kode verifikasi (2FA)</b> dari email atau konfirmasi persetujuan (acc) dari aplikasi Roblox.
      </p>

      {/* Accordion Tutorial Matikan 2FA */}
      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-2">
        <button
          type="button"
          onClick={() => setShowTutorial(!showTutorial)}
          className="w-full flex items-center justify-between text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
        >
          <span>📖 Tutorial Cara Matikan Verifikasi 2 Langkah:</span>
          <span>{showTutorial ? "▲ Tutup" : "▼ Lihat"}</span>
        </button>

        {showTutorial && (
          <ol className="text-[11px] text-slate-400 list-decimal list-inside space-y-1 pt-1 border-t border-slate-800/80 leading-normal">
            <li>Buka aplikasi/web Roblox &gt; masuk ke menu <b>Settings (Pengaturan)</b>.</li>
            <li>Pilih tab <b>Security (Keamanan)</b>.</li>
            <li>Pada bagian <b>2-Step Verification</b>, nonaktifkan toggle <i>Email Codes</i> / <i>Authenticator App</i>.</li>
            <li>Masukkan password akun untuk mengonfirmasi penonaktifan.</li>
          </ol>
        )}
      </div>

      {/* Tombol Aksi Customer */}
      <div className="pt-1">
        {resolved ? (
          <div className="w-full py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-1.5">
            <span>✓</span> Verifikasi Dimatikan • Siap Login!
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConfirmTurnedOff}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-950/40"
          >
            {isSubmitting ? "Memproses..." : "✅ Sudah Saya Matikan (Siap Login!)"}
          </button>
        )}
      </div>
    </div>
  );
}
