import React from 'react';
import { MessageCircle, X, Sparkles, AlertTriangle, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface GiftDeliveryModalProps {
  order: any;
  onClose: () => void;
  onViewDetail?: () => void;
}

export const GiftDeliveryModal: React.FC<GiftDeliveryModalProps> = ({
  order,
  onClose,
  onViewDetail
}) => {
  const { adminWhatsappNumber } = useApp();
  if (!order) return null;

  const handleOpenWhatsApp = () => {
    const rawPhone = (adminWhatsappNumber || '081234567890').replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('0')
      ? '62' + rawPhone.slice(1)
      : rawPhone.startsWith('62')
        ? rawPhone
        : '62' + rawPhone;

    const invoice = order.orderId || order.id || '#ORD-GIFT';
    const robloxUser = order.robloxUsername || order.roblox_username || order.game_username || order.formData?.username || 'Customer';
    const pkg = order.package_name || order.packageName || order.itemGift || 'Item Gift Roblox';

    const message = `Order ID: ${invoice}
Username Roblox: @${robloxUser}
Status Bayar: Perlu Cek
Orderan: ${pkg}`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#0B0F19] border border-blue-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-blue-500/10 relative overflow-hidden text-slate-100 animate-in zoom-in-95 duration-200 space-y-5">

        {/* Glow accent */}
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400 block">
                Yeay, Sukses!
              </span>
              <h3 className="text-lg font-black text-white font-sans tracking-tight">
                Request Pengiriman
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="text-slate-500 hover:text-blue-400 p-1.5 rounded-xl hover:bg-blue-500/10 border border-transparent hover:border-blue-500/30 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner Text */}
        <div className="relative z-10 text-sm text-slate-300 leading-relaxed space-y-3">
          <p>
            Pesananmu sudah terbayar! Hubungi admin via{' '}
            <span className="text-blue-400 font-bold">WhatsApp</span> untuk memproses
            pengiriman Gift Gamepass-mu.
          </p>
          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-blue-500/20 text-xs space-y-2">
            <div className="flex items-center gap-2 text-blue-300 font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>Jam Operasional Pengiriman</span>
            </div>
            <ul className="space-y-1.5 text-slate-400">
              <li className="flex gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Gift Gamepass diproses jam <strong className="text-slate-200">13.00 – 21.00 WIB</strong> (1 siang – 9 malam).</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Kalau pesannya di luar jam itu, akan diproses saat admin aktif lagi.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Pengiriman butuh waktu sekitar <strong className="text-slate-200">5–12 jam</strong>.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Peringatan Penting */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl relative z-10">
          <div className="flex gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="block text-sm mb-0.5 text-amber-300">⚠️ PENTING:</strong>
              Harap tetap <strong className="text-amber-100">standby dan berada di dalam game (in-game)</strong> selama proses pengiriman berlangsung agar admin dapat mengirimkan gift ke akunmu dengan lancar.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 relative z-10 pt-1">
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full py-4 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/30 cursor-pointer active:scale-95 border border-blue-400/40"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Request Pengiriman Sekarang</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 px-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-bold text-sm transition-all border border-slate-700 hover:border-slate-600 cursor-pointer active:scale-95 text-center"
          >
            Tutup
          </button>

          {onViewDetail && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewDetail();
                }}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-bold underline underline-offset-2 transition cursor-pointer"
              >
                Lihat Detail Pesanan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
