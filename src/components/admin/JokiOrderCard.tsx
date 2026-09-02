import React, { useState } from "react";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function JokiOrderCard({ order }: { order: any }) {
  const [isPrompting, setIsPrompting] = useState(false);

  const status = (order.statusCode || order.orderStatus || order.status || "BOOKING").toUpperCase();

  const handleRequest2FA = async () => {
    if (!order.chatId && !order.id) return;
    setIsPrompting(true);

    try {
      const targetChatId = order.chatId || order.id;

      // 1. Update status order menjadi Butuh Verifikasi
      await updateDoc(doc(db, "orders", order.id), {
        status: "Butuh Verifikasi",
        statusCode: "BUTUH_VERIFIKASI",
        orderStatus: "BUTUH_VERIFIKASI",
        updatedAt: serverTimestamp()
      });

      // 2. Kirim pesan prompt ke room chat
      await addDoc(collection(db, "chats", targetChatId, "messages"), {
        text: "⚠️ [SISTEM] Akun membutuhkan kode verifikasi 2-Step. Silakan periksa instruksi di bawah ini.",
        sender: "admin",
        senderRole: "RESMI",
        is2FAPrompt: true,
        orderId: order.id,
        createdAt: serverTimestamp()
      });

      // 3. Update room chat badge
      await updateDoc(doc(db, "chats", targetChatId), {
        orderBadge: "BUTUH_VERIFIKASI",
        orderStatus: "BUTUH_VERIFIKASI",
        lastMessage: "⚠️ Admin meminta verifikasi 2-Step Akun Roblox",
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      alert("Permintaan verifikasi 2FA berhasil dikirim ke chat customer!");
    } catch (err) {
      console.error(err);
      alert("Gagal mengirim permintaan verifikasi.");
    } finally {
      setIsPrompting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      {/* Header Info Order */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-white">@{order.robloxUsername || order.game_user_id || "User"}</span>
        
        {/* BADGE STATUS DINAMIS (SIAP LOGIN / BUTUH VERIFIKASI) */}
        {status === "SIAP_LOGIN" ? (
          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
            ⚡ Siap Login!
          </span>
        ) : status === "BUTUH_VERIFIKASI" ? (
          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
            ⏳ Menunggu 2FA
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {order.status || "Booking"}
          </span>
        )}
      </div>

      {/* Detail Item & Password */}
      <div className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 space-y-1">
        <p><span className="text-slate-500">Paket:</span> {order.packageName || order.package_name || "Joki Game"}</p>
        <p><span className="text-slate-500">Pass:</span> <span className="font-mono text-cyan-400">{order.accountPassword || order.game_password || "-"}</span></p>
      </div>

      {/* TOMBOL AKSI ADMIN */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleRequest2FA}
          disabled={isPrompting}
          className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
        >
          {isPrompting ? "Mengirim..." : "🛡️ Minta Verif 2FA"}
        </button>
      </div>
    </div>
  );
}

export { JokiOrderCard };
