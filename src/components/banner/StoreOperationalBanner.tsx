import React, { useState, useEffect } from "react";
import { subscribeStoreSchedule, evaluateStoreStatus, StoreScheduleConfig } from "../../services/storeScheduleService";

export function StoreOperationalBanner() {
  const [config, setConfig] = useState<StoreScheduleConfig | null>(null);

  useEffect(() => {
    const unsub = subscribeStoreSchedule((newConfig) => {
      setConfig(newConfig);
    });
    return () => unsub();
  }, []);

  if (!config) return null;

  const status = evaluateStoreStatus(config);

  // 1. SAAT TOKO BUKA (FULLY_ACTIVE or TAKE_ORDER_ONLY):
  if (status.isOpen) {
    if (status.phase === 'TAKE_ORDER_ONLY') {
      return (
        <div className="w-full bg-[#081b2e] border-b border-cyan-500/20 px-3 sm:px-4 py-2 flex items-center gap-2.5 text-xs text-white select-none animate-in fade-in duration-200">
          <div className="w-6 h-6 rounded-lg bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-xs shrink-0 text-cyan-400">
            📢
          </div>
          <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-extrabold text-[10px] tracking-wider uppercase shrink-0">
            ● {status.statusLabel}
          </span>
          <p className="text-[11px] sm:text-xs font-semibold text-slate-200 truncate">
            {status.message}
          </p>
        </div>
      );
    }
    return null;
  }

  // 2. SAAT TOKO TUTUP:
  return (
    <div className="w-full bg-[#1c0f06] border-b border-amber-900/60 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 text-xs text-amber-300 select-none animate-in fade-in duration-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-rose-950/80 border border-rose-500/30 flex items-center justify-center text-xs shrink-0 text-rose-400">
          ⏰
        </div>
        <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[10px] tracking-wider uppercase shrink-0">
          ● {status.statusLabel}
        </span>
        <p className="text-[11px] sm:text-xs font-semibold text-amber-200 truncate">
          {status.message}
        </p>
      </div>
    </div>
  );
}
