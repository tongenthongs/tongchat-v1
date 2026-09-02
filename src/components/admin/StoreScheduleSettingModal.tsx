import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { StoreScheduleConfig, DEFAULT_SCHEDULE } from "../../services/storeScheduleService";

export default function StoreScheduleSettingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [form, setForm] = useState<StoreScheduleConfig>(DEFAULT_SCHEDULE);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const loadConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "store_schedule"));
        if (snap.exists()) {
          setForm({ ...DEFAULT_SCHEDULE, ...snap.data() });
        }
      } catch (e) {
        console.warn("Failed to load store schedule config:", e);
      }
    };
    loadConfig();
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "store_schedule"), {
        ...form,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert("✅ Jam operasional toko berhasil diperbarui dan tersinkronisasi ke semua device!");
      onClose();
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b1120] border border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <span>⏰</span> Atur Jam Operasional Toko
          </h2>
          <button 
            type="button" 
            aria-label="Tutup Pengaturan Jadwal"
            onClick={onClose} 
            className="text-slate-400 hover:text-white text-xs cursor-pointer p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          {/* Toggle Otomatis Berdasarkan Jam */}
          <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <div>
              <p className="font-bold text-white">Ikuti Jadwal Otomatis (WIB)</p>
              <p className="text-[10px] text-slate-400">Status toko berubah otomatis sesuai jam yang diatur.</p>
            </div>
            <input 
              type="checkbox"
              checked={form.isAutoSchedule}
              onChange={(e) => setForm({ ...form, isAutoSchedule: e.target.checked })}
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Override Manual jika tidak otomatis */}
          {!form.isAutoSchedule && (
            <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-amber-500/30">
              <div>
                <p className="font-bold text-amber-300">Status Manual Toko</p>
                <p className="text-[10px] text-slate-400">Pilih status paksa saat jadwal otomatis dimatikan.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, isOpenManual: !form.isOpenManual })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  form.isOpenManual 
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" 
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                }`}
              >
                {form.isOpenManual ? "🟢 Buka Paksa" : "🔴 Tutup Paksa"}
              </button>
            </div>
          )}

          {/* Jam Take Order Buka */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-semibold">1. Jam Mulai Buka / Terima Order (WIB):</label>
            <input 
              type="time" 
              value={form.openTime}
              onChange={(e) => setForm({ ...form, openTime: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Jam Mulai Aktif Chat Web */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-semibold">2. Jam Mulai Aktif Proses / Balas Web (WIB):</label>
            <input 
              type="time" 
              value={form.activeChatTime}
              onChange={(e) => setForm({ ...form, activeChatTime: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Jam Tutup */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-semibold">3. Jam Toko Tutup (WIB):</label>
            <input 
              type="time" 
              value={form.closeTime}
              onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Pesan Kustom Saat Tutup */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-semibold">Pesan Khusus (Opsional):</label>
            <textarea
              rows={2}
              value={form.customClosedNotice || ""}
              onChange={(e) => setForm({ ...form, customClosedNotice: e.target.value })}
              placeholder="Contoh: Toko libur sementara untuk maintenance..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "Menyimpan..." : "Simpan Jadwal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { StoreScheduleSettingModal };
