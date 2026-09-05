import React, { useState, useEffect } from "react";
import { subscribeStoreSchedule, evaluateStoreStatus, StoreScheduleConfig, DEFAULT_BANNER } from "../../services/storeScheduleService";

const COLOR_CLOSED: Record<string, { bg: string; border: string; badge: string; text: string; dot: string }> = {
  amber:  { bg: 'bg-[#1c1106]', border: 'border-amber-500/25',  badge: 'bg-amber-600',  text: 'text-amber-200',  dot: 'bg-amber-400' },
  red:    { bg: 'bg-[#1c0608]', border: 'border-red-500/25',    badge: 'bg-red-700',    text: 'text-red-200',    dot: 'bg-red-400' },
  orange: { bg: 'bg-[#1c0c06]', border: 'border-orange-500/25', badge: 'bg-orange-600', text: 'text-orange-200', dot: 'bg-orange-400' },
  rose:   { bg: 'bg-[#1c0610]', border: 'border-rose-500/25',   badge: 'bg-rose-600',   text: 'text-rose-200',   dot: 'bg-rose-400' },
};

export function StoreOperationalBanner() {
  const [config, setConfig] = useState<StoreScheduleConfig | null>(null);

  useEffect(() => {
    const unsub = subscribeStoreSchedule(setConfig);
    // Re-evaluate setiap menit agar banner otomatis update saat jam berubah
    const interval = setInterval(() => setConfig(c => c ? { ...c } : c), 60000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  if (!config) return null;

  const banner = { ...DEFAULT_BANNER, ...(config.banner || {}) };

  // Banner dinonaktifkan dari admin
  if (!banner.enabled) return null;

  const status = evaluateStoreStatus(config);

  // HANYA tampilkan saat toko TUTUP — saat buka/take-order tidak ada banner
  if (status.isOpen) return null;

  const colors = COLOR_CLOSED[banner.closedColor] || COLOR_CLOSED.amber;

  // Teks: prioritaskan customClosedNotice dari settings/store, lalu banner.closedText
  const message = config.customClosedNotice?.trim() || banner.closedText || status.message;

  return (
    <div className={`w-full ${colors.bg} border-b ${colors.border} px-3 sm:px-5 py-2 flex items-center gap-2.5 select-none animate-in fade-in duration-300`}>
      {/* Ikon */}
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0`}>
        <span>⏰</span>
      </div>

      {/* Badge status */}
      <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${colors.badge} text-white font-black text-[10px] tracking-wider uppercase shrink-0`}>
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        {status.statusLabel}
      </span>

      {/* Teks pesan */}
      <div className="flex-1 overflow-hidden min-w-0">
        {banner.scrolling ? (
          <div className="overflow-hidden">
            <p className={`text-[11px] sm:text-xs font-semibold ${colors.text} whitespace-nowrap animate-[marquee_20s_linear_infinite]`}>
              {message}
            </p>
          </div>
        ) : (
          <p className={`text-[11px] sm:text-xs font-semibold ${colors.text} truncate`}>
            {message}
          </p>
        )}
      </div>

      {/* Waktu WIB realtime — kecil di kanan */}
      <span className={`text-[10px] font-mono ${colors.text} opacity-50 shrink-0 hidden sm:block`}>
        {new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB
      </span>
    </div>
  );
}
