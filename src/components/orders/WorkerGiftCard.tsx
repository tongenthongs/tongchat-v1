import React, { useState } from "react";
import { MessageCircle, ExternalLink, Copy, Check, UserPlus, Send, Sparkles } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function WorkerGiftCard({ onOpenHelp, orderData }: { onOpenHelp?: () => void; orderData?: any }) {
  const [copied, setCopied] = useState(false);
  const { adminWhatsappNumber } = useApp();
  const robloxProfileUrl = "https://www.roblox.com/id/users/11532845635/profile";

  const handleCopy = () => {
    navigator.clipboard.writeText(robloxProfileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const rawPhone = (adminWhatsappNumber || '081234567890').replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : rawPhone.startsWith('62') ? rawPhone : '62' + rawPhone;
    
    const invoice = orderData?.orderId || orderData?.id || '#ORD-GIFT';
    const robloxUser = orderData?.robloxUsername || orderData?.roblox_username || orderData?.game_username || 'Customer';
    const pkg = orderData?.package_name || orderData?.packageName || orderData?.itemGift || 'Item Gift Roblox';
    const price = Number(orderData?.price || orderData?.totalPrice || 0).toLocaleString('id-ID');

    const message = `Halo Admin Entong Store, saya mau request pengiriman pesanan Gift:\n- Invoice: ${invoice}\n- Username Roblox: @${robloxUser}\n- Paket: ${pkg}\n- Total: Rp ${price}\n\nSaya sudah add friend / standby in-game. Mohon diproses ya Min, terima kasih!\n\n⚠️ *Mohon dicek pembayarannya ya min, pembayaran saya BELUM diverifikasi. Tolong konfirmasi pembayaran setelah pesan ini diterima.*`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-[#0b1120] border border-emerald-500/30 rounded-3xl p-5 space-y-4 shadow-xl select-none relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* HEADER: STATUS & LABEL TAMBAH TEMAN */}
      <div className="space-y-1.5 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="text-xs font-bold text-slate-200">
              Pengiriman Gift In-Game Standby
            </span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Siap Kirim
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-snug">
          Silakan add akun worker resmi kami di Roblox, lalu klik <strong>Request Pengiriman</strong> agar gift langsung dikirimkan ke akun Anda!
        </p>
      </div>

      {/* TOMBOL UTAMA: REQUEST PENGIRIMAN WHATSAPP */}
      <button
        type="button"
        onClick={handleOpenWhatsApp}
        className="w-full py-3 px-4 rounded-2xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer active:scale-98 relative z-10"
      >
        <MessageCircle className="w-4 h-4 fill-current" />
        <span>Request Pengiriman Sekarang (via WhatsApp)</span>
        <span className="text-[10px] bg-slate-950/20 px-1.5 py-0.5 rounded">Respon Cepat</span>
      </button>

      {/* TOMBOL AKSI: SALIN LINK & ADD DI ROBLOX */}
      <div className="grid grid-cols-2 gap-2.5 relative z-10">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-[#070b14] hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          <span>{copied ? "Tersalin! ✓" : "Salin Link Worker"}</span>
        </button>

        <a
          href={robloxProfileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-md border border-emerald-500/30"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add di Roblox</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* FOOTER BANTUAN LIVECHAT IN-APP */}
      {onOpenHelp && (
        <div className="pt-2 border-t border-slate-800/80 relative z-10">
          <button
            type="button"
            onClick={onOpenHelp}
            className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>💬</span>
            <span>Konfirmasi di Live Chat Web</span>
          </button>
        </div>
      )}
    </div>
  );
}
