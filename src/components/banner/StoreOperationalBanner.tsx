import React, { useState, useEffect } from "react";
import { subscribeStoreSchedule, evaluateStoreStatus, StoreScheduleConfig, DEFAULT_BANNER } from "../../services/storeScheduleService";

const COLOR_OPEN: Record<string, { bg: string; border: string; badge: string; text: string; dot: string }> = {
  green:   { bg: 'bg-[#071a0f]', border: 'border-emerald-500/25', badge: 'bg-emerald-600', text: 'text-emerald-200', dot: 'bg-emerald-400' },
  blue:    { bg: 'bg-[#071224]', border: 'border-blue-500/25',    badge: 'bg-blue-600',    text: 'text-blue-200',    dot: 'bg-blue-400' },
  cyan:    { bg: 'bg-[#061820]', border: 'border-cyan-500/25',    badge: 'bg-cyan-600',    text: 'text-cyan-200',    dot: 'bg-cyan-400' },
  emerald: { bg: 'bg-[#071a12]', border: 'border-emerald-400/25', badge: 'bg-emerald-500', text: 'text-emerald-100', dot: 'bg-emerald-300' },
};

const COLOR_CLOSED: Record<string, { bg: string; border: string; badge: string; text: string; dot: string }> = {
  amber:  { bg: 'bg-[#1c1106]', border: 'border-amber-500/25',  badge: 'bg-amber-600',  text: 'text-amber-200',  dot: 'bg-amber-400' },
  red:    { bg: 'bg-[#1c0608]', border: 'border-red-500/25',    badge: 'bg-red-700',    text: 'text-red-200',    dot: 'bg-red-400' },
  orange: { bg: 'bg-[#1c0c06]', border: 'border-orange-500/25', badge: 'bg-orange-600', text: 'text-orange-200', dot: 'bg-orange-400' },
  rose:   { bg: 'bg-[#1c0610]', border: 'border-rose-500/25',   badge: 'bg-rose-600',   text: 'text-rose-200',   dot: 'bg-rose-400' },
};

const COLOR_TAKE_ORDER = {
  bg: 'bg-[#06121c]', border: 'border-sky-500/25', badge: 'bg-sky-600', text: 'text-sky-200', dot: 'bg-sky-400'
};

export function StoreOperationalBanner() {
  const [config, setConfig] = useState<StoreScheduleConfig | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeStoreSchedule(setConfig);
    // Re-evaluate setiap menit agar banner otomatis update saat jam berubah
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  if (!config) return null;

  const banner = { ...DEFAULT_BANNER, ...(config.banner || {}) };

  // Jika banner dinonaktifkan dari admin
  if (!banner.enabled) return null;

  const status = evaluateStoreStatus(config);

  // Tentukan warna berdasarkan fase
  let colors;
  if (!status.isOpen) {
    colors = COLOR_CLOSED[banner.closedColor] || COLOR_CLOSED.amber;
  } else if (status.phase === 'TAKE_ORDER_ONLY') {
    colors = COLOR_TAKE_ORDER;
  } else {
    colors = COLOR_OPEN[banner.openColor] || COLOR_OPEN.green;
  }

  const statusEmoji = !status.isOpen ? '⏰' : status.phase === 'TAKE_ORDER_ONLY' ? '📢' : banner.emoji;
  const message = status.message;

  return (
    <div className={`w-full ${colors.bg} border-b ${colors.border} px-3 sm:px-5 py-2 flex items-center gap-2.5 select-none animate-in fade-in duration-300`}>
      {/* Ikon status */}
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 ${colors.bg} border ${colors.border}`}>
        <span>{statusEmoji}</span>
      </div>

      {/* Badge status */}
      <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${colors.badge} text-white font-black text-[10px] tracking-wider uppercase shrink-0`}>
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`} />
        {status.statusLabel}
      </span>

      {/* Teks pesan — scrolling jika diaktifkan */}
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
