import React, { useState, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { submitFormAndRelinkOrder } from "../../services/formSubmissionRelinkService";

interface Props {
  chatId: string;
  formType: "GIFT" | "JOKI";
  onOpenProductModal?: (cat: "GIFT" | "JOKI") => void;
  onSuccessSubmitted: () => void;
}

export default function StrictOrderValidatedForm({
  chatId,
  formType,
  onOpenProductModal,
  onSuccessSubmitted
}: Props) {
  const [username, setUsername] = useState("");
  const [gamepass, setGamepass] = useState("");
  const [password, setPassword] = useState("");
  const [uangTerakhir, setUangTerakhir] = useState("");

  // Status Validasi Ketat
  const [isChecking, setIsChecking] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedOrderData, setVerifiedOrderData] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkTimeoutRef = useRef<any>(null);

  // Handler Perubahan Input Username (Langsung Kunci State)
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUsername(val);
    
    // KUNCI LANGSUNG: Batalkan verifikasi lama setiap kali karakter berubah
    setIsVerified(false);
    setVerifiedOrderData(null);
    setValidationError(null);

    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);

    const cleanInput = val.trim().replace(/^@/, '').toLowerCase();
    if (!cleanInput || cleanInput.length < 3) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const ordersRef = collection(db, "orders");
        // Ambil snapshot pesanan untuk pencocokan case-insensitive
        const snap = await getDocs(ordersRef);

        let matched: any = null;

        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const dbUser = String(data.robloxUsername || data.roblox_username || data.username || data.customer_name || data.customerName || '')
            .trim()
            .replace(/^@/, '')
            .toLowerCase();

          // Cek apakah username cocok
          if (dbUser === cleanInput) {
            const rawStatus = String(data.status || data.orderStatus || '').toLowerCase();
            // Hanya izinkan jika pesanan belum hangus/batal
            if (!['hangus', 'batal', 'dibatalkan'].includes(rawStatus)) {
              matched = { id: docSnap.id, ...data };
              break;
            }
          }
        }

        if (matched) {
          setIsVerified(true);
          setVerifiedOrderData(matched);
          setValidationError(null);
        } else {
          setIsVerified(false);
          setVerifiedOrderData(null);
          setValidationError("Orderan tidak ada atau belum buat. Silahkan order dulu!");
        }
      } catch (err) {
        console.error("Validation error:", err);
        setIsVerified(false);
        setValidationError("Gagal memeriksa database. Coba ketik ulang.");
      } finally {
        setIsChecking(false);
      }
    }, 400);
  };

  // Handler Submit yang Tidak Bisa Diterobos
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // BLOKIR TOTAL JIKA BELUM TERVERIFIKASI
    if (!isVerified || !verifiedOrderData) {
      alert("❌ Username belum terdaftar di database pesanan! Silakan lakukan pemesanan terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFormAndRelinkOrder({
        chatId: chatId,
        orderId: verifiedOrderData.id,
        formType: formType,
        username: username,
        gamepass: gamepass,
        password: password,
        uangTerakhir: uangTerakhir
      });

      // Reset status & panggil callback selesai
      onSuccessSubmitted();
    } catch (err: any) {
      console.error("Gagal mengirim form & relink order:", err);
      alert(`Gagal: ${err.message || "Terjadi kesalahan saat memproses pesanan."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-start gap-2.5 max-w-sm my-2">
      {/* Bot Avatar */}
      <div className="w-8 h-8 rounded-full bg-slate-900 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0 shadow-md">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5" />
        </svg>
      </div>

      {/* Form Container */}
      <form
        onSubmit={handleFormSubmit}
        className="bg-slate-900/95 border border-slate-800 p-4 rounded-2xl rounded-tl-none space-y-3 w-full shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-cyan-400">
            {formType === "GIFT" ? "🎁 Form Gamepass (wajib isi)" : "⚡ Form Joki Game"}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20">
            Wajib
          </span>
        </div>

        {/* INPUT USERNAME ROBLOX */}
        <div>
          <label className="text-[11px] font-semibold text-slate-300">Username Roblox:</label>
          <div className="relative mt-1">
            <input
              type="text"
              required
              value={username}
              onChange={handleUsernameChange}
              onKeyDown={(e) => {
                // Cegah tombol Enter jika belum verified
                if (e.key === "Enter" && !isVerified) e.preventDefault();
              }}
              placeholder="Ketik username roblox kamu..."
              className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none transition-all ${
                isVerified 
                  ? "border-emerald-500 focus:border-emerald-400" 
                  : validationError 
                    ? "border-rose-500 focus:border-rose-400" 
                    : "border-slate-800 focus:border-cyan-500"
              }`}
            />
            {isChecking && (
              <span className="absolute right-3 top-2.5 text-[10px] text-cyan-400 animate-pulse font-mono">
                Cek DB...
              </span>
            )}
          </div>

          {/* STATUS PENGECEKAN */}
          {isVerified && verifiedOrderData && (
            <div className="mt-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <span>✅</span> Order ditemukan: #{verifiedOrderData.orderId || verifiedOrderData.id.slice(0, 8)} ({verifiedOrderData.packageName || "Siap Proses"})
              </p>
            </div>
          )}

          {validationError && !isChecking && (
            <div className="mt-1.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
              <p className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                <span>❌</span> {validationError}
              </p>
              <button
                type="button"
                onClick={() => onOpenProductModal && onOpenProductModal(formType)}
                className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition-all cursor-pointer shadow-sm"
              >
                Buka Katalog Produk & Order Sekarang
              </button>
            </div>
          )}
        </div>

        {/* FIELD FORM KHUSUS */}
        {formType === "GIFT" ? (
          <div>
            <label className="text-[11px] font-semibold text-slate-300">Gamepass / Item:</label>
            <input
              type="text"
              required
              disabled={!isVerified}
              value={gamepass}
              onChange={(e) => setGamepass(e.target.value)}
              placeholder="Nama Gamepass / Link Gamepass"
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="text-[11px] font-semibold text-slate-300">Password Akun:</label>
              <input
                type="password"
                required
                disabled={!isVerified}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password Akun Roblox"
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300">Uang Terakhir di Game:</label>
              <input
                type="text"
                required
                disabled={!isVerified}
                value={uangTerakhir}
                onChange={(e) => setUangTerakhir(e.target.value)}
                placeholder="Contoh: 500.000 cash"
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
          </>
        )}

        {/* TOMBOL SUBMIT TERKUNCI TOTAL (DISABLED HINGGA VERIFIED) */}
        <button
          type="submit"
          disabled={!isVerified || isSubmitting}
          className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
            isVerified && !isSubmitting
              ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-lg shadow-emerald-500/20"
              : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 border border-slate-700/50"
          }`}
        >
          {isSubmitting
            ? "Menyimpan Form..."
            : isVerified
              ? "✈️ Kirim Form Pesanan"
              : "Kirim Form (Isi Username Terdaftar)"}
        </button>
      </form>
    </div>
  );
}

export { StrictOrderValidatedForm };
