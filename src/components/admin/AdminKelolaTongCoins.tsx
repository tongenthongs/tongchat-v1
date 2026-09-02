import React, { useState } from "react";
import { mutateTongCoins, resolveUserWithData } from "../../services/tongCoinService";
import { Coins, Search, CheckCircle2, AlertCircle, RefreshCw, User, ShieldCheck } from "lucide-react";

interface AdminKelolaTongCoinsProps {
  currentUser?: any;
  onSuccess?: () => void;
}

export function AdminKelolaTongCoins({ currentUser, onSuccess }: AdminKelolaTongCoinsProps) {
  const [targetIdentifier, setTargetIdentifier] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [mutationType, setMutationType] = useState<"REFUND" | "MANUAL_ADD" | "TOPUP" | "DEDUCT">("REFUND");
  const [orderId, setOrderId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [resolvedUserPreview, setResolvedUserPreview] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; balance?: number } | null>(null);

  const handleCheckUser = async () => {
    if (!targetIdentifier.trim()) {
      alert("Masukkan username Roblox, nomor WhatsApp, atau UID customer.");
      return;
    }

    setIsCheckingUser(true);
    setResolvedUserPreview(null);
    setFeedback(null);

    try {
      const res = await resolveUserWithData(targetIdentifier);
      if (res) {
        setResolvedUserPreview(res);
      } else {
        alert(`Customer "${targetIdentifier}" tidak ditemukan di database.`);
      }
    } catch (e: any) {
      alert(`Error mencari customer: ${e.message}`);
    } finally {
      setIsCheckingUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetIdentifier.trim() || !amount) {
      alert("Harap isi username/WA/UID customer dan jumlah nominal TongCoins.");
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Nominal TongCoins harus berupa angka positif lebih dari 0.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const adminEmail = currentUser?.email || currentUser?.name || "Admin Entong";
      const result = await mutateTongCoins({
        identifier: targetIdentifier,
        amount: numAmount,
        type: mutationType,
        reason: reason.trim() || (mutationType === 'REFUND' ? `Refund pesanan ${orderId || '-'}` : "Penyesuaian saldo manual oleh admin"),
        orderId: orderId.trim() || "-",
        adminEmail
      });

      setFeedback({
        type: 'success',
        message: `Berhasil! Saldo TongCoins customer (${result.userName}) berhasil diperbarui.`,
        balance: result.newBalance
      });

      setAmount("");
      setReason("");
      setOrderId("");
      setResolvedUserPreview(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Gagal mutasi TongCoins:", err);
      setFeedback({
        type: 'error',
        message: err.message || "Gagal memproses mutasi saldo."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-xl space-y-5 shadow-2xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h2 className="text-base font-bold text-white flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Coins className="w-5 h-5" />
          </span>
          <div>
            <div>Tambah / Refund TongCoins Manual</div>
            <div className="text-[11px] font-normal text-slate-400">Atomic Firestore Transaction Engine</div>
          </div>
        </h2>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> 100% Realtime
        </span>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-3 border ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300' 
            : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <div>
            <div>{feedback.message}</div>
            {feedback.balance !== undefined && (
              <div className="mt-1 text-xs font-bold text-amber-300">
                Total Saldo Sekarang: {feedback.balance.toLocaleString('id-ID')} TC
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Identifier input with Preview button */}
        <div>
          <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
            Username Roblox / No WhatsApp / UID Customer
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={targetIdentifier}
                onChange={(e) => {
                  setTargetIdentifier(e.target.value);
                  setResolvedUserPreview(null);
                }}
                placeholder="Contoh: MamadV2123, 08123456789, atau UID"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            <button
              type="button"
              onClick={handleCheckUser}
              disabled={isCheckingUser || !targetIdentifier.trim()}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              {isCheckingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Cek</span>
            </button>
          </div>

          {/* User Preview Box */}
          {resolvedUserPreview && (
            <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-amber-500/30 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">
                    {resolvedUserPreview.data.name || resolvedUserPreview.data.username || resolvedUserPreview.data.robloxUsername || 'User'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Roblox: {resolvedUserPreview.data.robloxUsername || '-'} • WA: {resolvedUserPreview.data.whatsapp || resolvedUserPreview.data.phone || '-'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Saldo Saat Ini</div>
                <div className="text-xs font-black text-amber-400">
                  {Number(resolvedUserPreview.data.tongCoins ?? resolvedUserPreview.data.tc_balance ?? resolvedUserPreview.data.tongcoins ?? resolvedUserPreview.data.balance ?? 0).toLocaleString('id-ID')} TC
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mutation Type & Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Tipe Mutasi</label>
            <select
              value={mutationType}
              onChange={(e: any) => setMutationType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="REFUND">Refund Order</option>
              <option value="MANUAL_ADD">Add Manual (Bonus/Topup)</option>
              <option value="TOPUP">Top Up Langsung</option>
              <option value="DEDUCT">Potong Saldo (Koreksi)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Jumlah Koin (TC)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 35000"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono font-bold"
            />
          </div>
        </div>

        {/* Order ID & Reason */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Order ID (Opsional)</label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Contoh: ORD-161826"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Alasan / Catatan</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Refund pesanan joki batal"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Memproses Mutasi Atomik...</span>
            </>
          ) : (
            <>
              <Coins className="w-4 h-4" />
              <span>Simpan Mutasi Saldo TongCoins</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default AdminKelolaTongCoins;
